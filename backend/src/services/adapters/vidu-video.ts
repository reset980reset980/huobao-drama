/**
 * Vidu 영상 생성 Adapter
 * 엔드포인트: /ent/v2/img2video
 * 인증: Authorization: Token {apiKey} (Bearer가 아님)
 * 특징: Vidu는 폴링 인터페이스를 제공하지 않아 Webhook 콜백으로 결과를 받습니다.
 */
import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types'
import { joinProviderUrl } from './url'

export class ViduVideoAdapter implements VideoProviderAdapter {
  provider = 'vidu'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'viduq3-turbo'

    const body: any = {
      model,
      images: [], // 호출 측에서 채웁니다.
      prompt: record.prompt,
    }

    // 추가 참조 이미지
    if (record.referenceMode === 'single' && record.imageUrl) {
      body.images.push(record.imageUrl)
    } else if (record.referenceMode === 'first_last') {
      if (record.firstFrameUrl) body.images.push(record.firstFrameUrl)
      if (record.lastFrameUrl) body.images.push(record.lastFrameUrl)
    } else if (record.referenceMode === 'multiple' && record.referenceImageUrls) {
      try {
        const refs = JSON.parse(record.referenceImageUrls)
        body.images.push(...refs)
      } catch {}
    }

    // 선택 파라미터
    if (record.duration) body.duration = record.duration
    if (record.aspectRatio) {
      // Vidu는 aspect ratio 대신 resolution 파라미터를 사용합니다.
      const ratioMap: Record<string, string> = {
        '16:9': '720p',
        '9:16': '720p',
        '1:1': '720p',
      }
      body.resolution = ratioMap[record.aspectRatio] || '720p'
    }

    return {
      url: joinProviderUrl(config.baseUrl, '', '/ent/v2/img2video'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${config.apiKey}`, // 주의: Bearer가 아닙니다.
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    if (result.task_id) {
      return { isAsync: true, taskId: result.task_id }
    }
    // 동기 반환(드문 경우)
    if (result.video_url) {
      return { isAsync: false, videoUrl: result.video_url }
    }
    throw new Error('No task_id in Vidu response')
  }

  /**
   * Vidu는 폴링 인터페이스를 제공하지 않습니다.
   * 폴링은 Webhook 콜백으로 처리되므로 이 메서드는 정상 경로에서 호출되지 않습니다.
   * 호출되더라도 즉시 종료되도록 도달 불가능한 요청을 반환합니다.
   */
  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    // Vidu는 폴링 엔드포인트가 없어 도달 불가능한 URL을 반환합니다.
    // 최종 상태는 Webhook 콜백으로 갱신됩니다.
    return {
      url: 'vidu://no-polling-endpoint',
      method: 'GET',
      headers: {},
      body: undefined,
    }
  }

  /**
   * Vidu는 폴링 엔드포인트가 없으므로 항상 processing으로 둡니다.
   * 실제 상태는 Webhook으로 갱신됩니다.
   */
  parsePollResponse(result: any): VideoPollResponse {
    return { status: 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return result.video_url || null
  }

  /**
   * Vidu 콜백 상태 매핑
   * Webhook 라우트가 콜백을 해석할 때 사용합니다.
   */
  static parseCallbackState(body: any): { status: 'completed' | 'failed'; videoUrl?: string; error?: string } {
    const state = body.state
    if (state === 'success') {
      return { status: 'completed', videoUrl: body.video_url }
    }
    if (state === 'failed') {
      return { status: 'failed', error: body.error || 'Vidu generation failed' }
    }
    return { status: 'failed', error: `Unknown state: ${state}` }
  }
}
