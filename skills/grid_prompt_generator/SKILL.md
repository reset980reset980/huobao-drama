---
name: grid_prompt_generator
description: 캐릭터, 장면, 그리드 이미지 프롬프트 생성 가이드
---

# 이미지 프롬프트 생성 가이드

이 Skill은 `grid_prompt_generator` Agent가 사용하는 규칙입니다. 세 가지 프롬프트를 지원합니다.

1. **캐릭터 이미지 프롬프트**: 캐릭터 외형과 분위기
2. **장면 이미지 프롬프트**: 장면의 분위기와 빛
3. **그리드 이미지 프롬프트**: 여러 샷을 한 장에 배치한 참고 이미지

상세 템플릿은 `reference/` 디렉터리를 참고합니다.

## 캐릭터 이미지 프롬프트

- `appearance`를 핵심 정보로 사용합니다.
- `personality`로 캐릭터의 분위기를 정합니다.
- `role`로 의상과 소품 방향을 보강합니다.
- `cinematic portrait`와 `consistent art style`을 포함합니다.
- 문자, 서명, 워터마크가 나오지 않게 합니다.

## 장면 이미지 프롬프트

- `location`을 기반으로 공간을 구성합니다.
- `time`으로 빛과 색감을 정합니다.
- atmospheric, moody, warm, cold 같은 분위기 단어를 적절히 사용합니다.
- `cinematic scene`과 `consistent art style`을 포함합니다.
- 문자, 서명, 워터마크가 나오지 않게 합니다.

## 그리드 이미지 프롬프트

### 첫 프레임 모드 (`first_frame`)

각 칸은 한 샷의 시작 화면입니다. 사용자가 지정한 `rows x cols` 총 칸 수를 정확히 지킵니다.

### 첫/끝 프레임 모드 (`first_last`)

각 샷의 시작과 끝을 리듬감 있게 배치합니다. 그래도 사용자가 지정한 총 칸 수를 정확히 지켜야 합니다.

### 다중 참조 모드 (`multi_ref`)

모든 칸은 같은 샷의 서로 다른 각도나 구도 참고 이미지입니다. 지정된 `rows x cols` 총 칸 수를 지킵니다.

## 공통 규칙

1. 프롬프트는 영어로 작성합니다.
2. 사용자가 지정한 `rows x cols grid layout`을 명확히 씁니다.
3. `consistent art style`을 포함해 스타일을 통일합니다.
4. `exactly N visible panels`를 명확히 요구합니다.
5. `no merged panels, no missing panels`를 명확히 요구합니다.
6. 칸 사이 구분선은 별도로 강조하지 않습니다.
7. 권장 크기는 칸당 960x540이며, 전체 이미지는 960×cols × 540×rows입니다.
8. 참조 이미지 매핑이 있으면 `이미지1/이미지2/...`와 `칸1/칸2/...`를 혼동하지 않습니다.
