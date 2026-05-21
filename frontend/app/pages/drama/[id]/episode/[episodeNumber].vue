<template>
  <div class="studio" v-if="drama">
    <header class="studio-topbar">
      <div class="studio-topbar-main">
        <button class="back-btn topbar-back" @click="navigateTo(`/drama/${dramaId}`)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          프로젝트로 돌아가기
        </button>
        <div class="studio-identity">
          <h1 class="studio-title">{{ drama.title }}</h1>
          <span class="studio-episode-chip">제 {{ episodeNumber }} 회</span>
          <div class="studio-meta-row">
            <span class="studio-meta-pill">{{ currentSubStageLabel }}</span>
            <span class="studio-meta-pill is-progress">{{ pipelineProgress }}/11</span>
            <span class="studio-meta-inline">{{ chars.length }} 캐릭터 · {{ sbs.length }} 샷</span>
          </div>
        </div>
      </div>

      <div class="studio-topbar-side">
        <div class="studio-actions">
          <button class="btn" @click="refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            새로고침
          </button>
          <button class="btn btn-primary" @click="panel = mergeUrl ? 'export' : (sbs.length ? 'production' : 'script')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {{ mergeUrl ? '완성본 보기' : (sbs.length ? '제작 계속' : '제작 시작') }}
          </button>
        </div>
      </div>
    </header>

    <div class="studio-body">
    <!-- ========== LEFT SIDEBAR ========== -->
    <aside class="sidebar">
      <nav class="pipeline">
        <div
          v-for="section in sidebarSections"
          :key="section.id"
          class="pipe-section"
        >
          <div class="pipe-section-label">{{ section.label }}</div>
          <button
            v-for="item in section.items"
            :key="item.key"
            :class="['pipe-item pipe-item-sub', { active: activeSubStepKey === item.key, done: item.done }]"
            @click="goSubStep(item.key)"
          >
            <span class="pipe-icon" :class="item.done ? 'icon-done' : activeSubStepKey === item.key ? 'icon-active' : ''">
              <svg v-if="item.done" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <component v-else :is="item.icon" :size="11" />
            </span>
            <span class="pipe-copy">
              <span class="pipe-label">{{ item.label }}</span>
              <span v-if="item.desc" class="pipe-sub">{{ item.desc }}</span>
            </span>
          </button>
        </div>
      </nav>

      <!-- Bottom: Progress + Refresh -->
      <div class="sidebar-bottom">
        <div class="progress-wrap">
          <div class="progress-head">
            <span class="progress-label">제작 진행률</span>
            <span class="progress-val">{{ pipelineProgress }}/11</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: (pipelineProgress / 11 * 100) + '%' }"></div>
          </div>
        </div>
        <div class="sidebar-jumper" v-if="sidebarJumpSteps.length">
          <button
            v-for="step in sidebarJumpSteps"
            :key="step.key"
            :class="['sidebar-jump-dot', { active: activeSubStepKey === step.key, done: step.done }]"
            @click="goSubStep(step.key)"
            :title="step.label"
          ></button>
        </div>
        <button class="refresh-btn" @click="refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          데이터 새로고침
        </button>
      </div>
    </aside>

    <!-- ========== MAIN CONTENT ========== -->
    <main class="main">
      <div v-if="activeSubSteps.length" class="stage-subnav">
        <button
          v-for="sub in activeSubSteps"
          :key="sub.key"
          :class="['stage-subnav-item', { active: activeSubStepKey === sub.key, done: sub.done }]"
          @click="goSubStep(sub.key)"
        >
          <span>{{ sub.label }}</span>
          <span v-if="sub.done" class="stage-subnav-dot"></span>
        </button>
      </div>

      <!-- ===== SCRIPT PANEL ===== -->
      <div v-if="panel === 'script'" class="content-panel">
        <!-- Step 0: Raw Content -->
        <div v-if="scriptStep === 0" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">01</span>
                <span class="step-name">원본 내용</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="rawLen" class="char-count">{{ rawLen }} 자</span>
              <button class="btn btn-sm" @click="saveRaw(); toast.success('저장됨')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                저장
              </button>
            </div>
          </div>
          <textarea
            class="fill-textarea"
            v-model="localRaw"
            placeholder="소설 원문, 이야기 개요 또는 스토리보드 설명을 붙여넣으세요..."
          />
        </div>

        <!-- Step 1: Rewrite -->
        <div v-else-if="scriptStep === 1" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">02</span>
                <span class="step-name">AI 수정</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="scriptLen" class="char-count">{{ scriptLen }} 자</span>
              <button v-if="rawContent" class="btn btn-sm" @click="skipRewrite">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/><path d="M13 18l6-6-6-6"/></svg>
                수정 건너뛰기
              </button>
              <button v-if="scriptContent" class="btn btn-sm" @click="doRewrite" :disabled="rn">
                <Loader2 v-if="rn && rt === 'script_rewriter'" :size="11" class="animate-spin" />
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                다시 수정
              </button>
            </div>
          </div>

          <div v-if="!scriptContent && !rn" class="step-empty">
            <div class="empty-visual">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <div class="empty-title">AI로 형식화된 극본 만들기</div>
            <div class="empty-desc">AI로 원본 내용을 형식화된 극본으로 정리하거나, 이 단계를 건너뛰고 원본 내용으로 캐릭터와 장면을 추출할 수 있습니다.</div>
            <div class="step-empty-actions">
              <button class="btn btn-primary" @click="doRewrite">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                수정 시작
              </button>
              <button class="btn" @click="skipRewrite">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M13 18l6-6-6-6"/></svg>
                수정 건너뛰기
              </button>
            </div>
          </div>
          <div v-else-if="rn && rt === 'script_rewriter'" class="step-loading">
            <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
            <div class="loading-text">극본을 수정하는 중...</div>
          </div>
          <textarea v-else class="fill-textarea" v-model="localScript" placeholder="형식화된 극본 내용..." />
        </div>

        <!-- Step 2: Extract -->
        <div v-else-if="scriptStep === 2" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">03</span>
                <span class="step-name">캐릭터와 장면 추출</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="chars.length" class="char-count">{{ chars.length }} 캐릭터 · {{ scenes.length }} 장면</span>
              <button v-if="chars.length" class="btn btn-sm" @click="doExtract" :disabled="rn">
                <Loader2 v-if="rn && rt === 'extractor'" :size="11" class="animate-spin" />
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                다시 추출
              </button>
            </div>
          </div>

          <div v-if="!chars.length && !rn" class="step-empty">
            <div class="empty-visual">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div class="empty-title">극본에서 캐릭터와 장면 추출</div>
            <div class="empty-desc">AI가 극본을 분석해 캐릭터 정보와 장면 목록을 추출하고 기존 프로젝트 데이터와 중복 없이 병합합니다</div>
            <button class="btn btn-primary" @click="doExtract">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              추출 시작
            </button>
          </div>
          <div v-else-if="rn && rt === 'extractor'" class="step-loading">
            <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
            <div class="loading-text">캐릭터와 장면을 추출하는 중...</div>
          </div>
          <div v-else class="extract-stage">
            <aside class="card extract-summary">
              <div class="extract-summary-kicker">Extraction Board</div>
              <div class="extract-summary-title">캐릭터와 장면 결과</div>
              <div class="extract-summary-desc">극본에서 추출한 캐릭터와 장면이 저장되었습니다. 이름, 역할, 설명이 다음 제작 단계로 바로 넘어가도 되는지 확인하세요.</div>
              <div class="extract-summary-stats">
                <div class="extract-summary-stat">
                  <span>캐릭터</span>
                  <strong>{{ chars.length }}</strong>
                </div>
                <div class="extract-summary-stat">
                  <span>장면</span>
                  <strong>{{ scenes.length }}</strong>
                </div>
              </div>
              <div class="extract-summary-note">캐릭터 설명이 너무 짧다면 음성 배정과 이미지 생성 전에 인물 특징을 보강하는 것이 좋습니다.</div>
            </aside>

            <div class="card extract-card">
              <div class="extract-card-head">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>캐릭터</span>
                <span class="tag tag-accent">{{ chars.length }}</span>
              </div>
              <div class="extract-list">
                <div v-for="c in chars" :key="c.id" class="extract-row">
                  <div class="char-avatar">{{ c.name?.[0] || '?' }}</div>
                  <div class="extract-info">
                    <div class="extract-name-row">
                      <div class="extract-name">{{ c.name }}</div>
                      <span class="tag">{{ c.role || '캐릭터' }}</span>
                    </div>
                    <div class="extract-meta wrap">{{ c.description || c.appearance || c.personality || '설명 없음' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card extract-card" v-if="scenes.length">
              <div class="extract-card-head">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>장면</span>
                <span class="tag tag-accent">{{ scenes.length }}</span>
              </div>
              <div class="extract-list">
                <div v-for="s in scenes" :key="s.id" class="extract-row">
                  <div class="scene-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="extract-info">
                    <div class="extract-name-row">
                      <div class="extract-name">{{ s.location }}</div>
                      <span v-if="s.time" class="tag">{{ s.time }}</span>
                    </div>
                    <div class="extract-meta wrap">{{ s.description || s.time || '장면 설명 보강 대기' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Voice Assignment -->
        <div v-else-if="scriptStep === 3" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">04</span>
                <span class="step-name">음색 배정</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="charsVoiced" class="char-count">{{ charsVoiced }}/{{ chars.length }} 배정됨</span>
              <span v-if="voiceSampleCount" class="char-count">{{ voiceSampleCount }}/{{ charsVoiced }} 미리듣기 파일</span>
              <button v-if="charsVoiced" class="btn btn-sm" @click="doVoice" :disabled="rn">
                <Loader2 v-if="rn && rt === 'voice_assigner'" :size="11" class="animate-spin" />
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                다시 배정
              </button>
              <button v-if="charsVoiced" class="btn btn-sm" @click="batchGenSamples">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19 5v14"/></svg>
                미리듣기 파일 생성
              </button>
            </div>
          </div>

          <div v-if="!charsVoiced && !rn" class="step-empty">
            <div class="empty-visual">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
            </div>
            <div class="empty-title">캐릭터에 적절한 음색 배정</div>
            <div class="empty-desc">AI가 캐릭터 특징에 맞는 TTS 음색을 자동 배정합니다</div>
            <button class="btn btn-primary" @click="doVoice">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              AI 자동 배정
            </button>
          </div>
          <div v-else-if="rn && rt === 'voice_assigner'" class="step-loading">
            <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
            <div class="loading-text">음색을 배정하는 중...</div>
          </div>
          <div v-else class="voice-stage">
            <aside class="card voice-stage-panel">
              <div class="voice-stage-kicker">Voice Casting</div>
              <div class="voice-stage-title">캐릭터 음성 배정대</div>
              <div class="voice-stage-desc">각 캐릭터에 맞는 음색을 선택한 뒤 미리듣기를 생성하세요. 음색 태그는 내레이션, 주연, 악역, 조연의 표현 방향을 빠르게 구분하는 데 도움이 됩니다.</div>
              <div class="voice-stage-stats">
                <div class="voice-stage-stat">
                  <span class="voice-stage-stat-label">배정됨</span>
                  <strong>{{ charsVoiced }}/{{ chars.length }}</strong>
                </div>
                <div class="voice-stage-stat">
                  <span class="voice-stage-stat-label">미리듣기 파일</span>
                  <strong>{{ voiceSampleCount }}/{{ charsVoiced }}</strong>
                </div>
              </div>
              <div class="voice-library-meta">
                <span>음색 라이브러리</span>
                <span>{{ voiceProfiles.length }} 개</span>
              </div>
              <div class="voice-library">
                <div v-for="voice in voiceProfiles" :key="voice.id" class="voice-library-item">
                  <div class="voice-library-head">
                    <span class="voice-library-name">{{ voice.label }}</span>
                    <span class="tag">{{ voice.gender }}</span>
                  </div>
                  <div class="voice-library-traits">{{ voice.traits }}</div>
                  <div class="voice-library-fit">{{ voice.suitable }}</div>
                </div>
              </div>
            </aside>

            <div class="voice-grid">
              <div v-for="c in chars" :key="c.id" class="card voice-card">
                <div class="voice-card-head">
                  <div class="voice-char">
                    <div class="char-avatar lg">{{ c.name?.[0] || '?' }}</div>
                    <div class="voice-name">
                      <div class="voice-name-row">
                        <div class="extract-name">{{ c.name }}</div>
                        <span class="tag" :class="(c.voice_style || c.voiceStyle) ? 'tag-success' : ''">{{ (c.voice_style || c.voiceStyle) ? '배정됨' : '배정 대기' }}</span>
                      </div>
                      <div class="extract-meta">{{ c.role || '캐릭터' }}</div>
                    </div>
                  </div>
                </div>

                <div class="voice-card-copy">
                  <div class="voice-card-text">{{ c.description || c.personality || c.appearance || '캐릭터 설명이 없습니다. 인물 역할에 맞춰 음색을 직접 선택할 수 있습니다.' }}</div>
                </div>

                <div class="voice-select-block">
                  <span class="voice-block-label">음색 선택</span>
                  <BaseSelect
                    :model-value="c.voice_style || c.voiceStyle || ''"
                    :options="voiceSelectOptions"
                    placeholder="음색 선택"
                    searchable
                    style="width:100%"
                    @update:model-value="updateCharVoice(c.id, $event)"
                  />
                </div>

                <div v-if="getVoiceProfile(c.voice_style || c.voiceStyle)" class="voice-profile-card">
                  <div class="voice-profile-head">
                    <span class="voice-profile-name">{{ getVoiceProfile(c.voice_style || c.voiceStyle)?.label }}</span>
                    <span class="tag">{{ getVoiceProfile(c.voice_style || c.voiceStyle)?.gender }}</span>
                  </div>
                  <div class="voice-profile-traits">{{ getVoiceProfile(c.voice_style || c.voiceStyle)?.traits }}</div>
                  <div class="voice-profile-fit">{{ getVoiceProfile(c.voice_style || c.voiceStyle)?.suitable }}</div>
                </div>

                <div class="voice-actions-row">
                  <button class="btn btn-sm" :disabled="!(c.voice_style || c.voiceStyle)" @click="genSample(c.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    {{ (c.voice_sample_url || c.voiceSampleUrl) ? '다시 미리듣기' : '미리듣기 생성' }}
                  </button>
                  <span class="dim" style="font-size:11px">{{ (c.voice_sample_url || c.voiceSampleUrl) ? '음성 샘플이 생성되어 바로 재생할 수 있습니다' : '생성 후 캐릭터 음성을 빠르게 확인할 수 있습니다' }}</span>
                </div>

                <div v-if="c.voice_sample_url || c.voiceSampleUrl" class="voice-player">
                  <audio :src="'/' + (c.voice_sample_url || c.voiceSampleUrl)" controls preload="none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Storyboard -->
        <div v-else-if="scriptStep === 4" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">05</span>
                <span class="step-name">스토리보드 목록</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="sbs.length" class="char-count">{{ sbs.length }} 샷 · {{ totalDuration }}s</span>
              <button v-if="sbs.length" class="btn btn-sm" @click="addShot">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                추가
              </button>
              <template v-if="!sbs.length">
                <span class="locked-config">영상모델 · {{ lockedVideoConfigLabel }}</span>
              </template>
              <button class="btn btn-sm" :disabled="rn" @click="doBreakdown">
                <Loader2 v-if="rt === 'storyboard_breaker'" :size="11" class="animate-spin" />
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {{ sbs.length ? '다시 분해' : 'AI 스토리보드 분해' }}
              </button>
            </div>
          </div>

          <div v-if="sbs.length" class="split-layout">
            <!-- Shot List -->
            <div class="shot-list">
              <div class="shot-list-head">
                <div>
                  <div class="shot-list-title">샷 순서</div>
                  <div class="shot-list-sub">샷 순서대로 내용과 소재 상태를 확인하세요</div>
                </div>
                <span class="tag mono">{{ totalDuration }}s</span>
              </div>
              <div class="shot-list-body">
                <div
                  v-for="(sb, i) in sbs"
                  :key="sb.id"
                  :class="['shot-item', { active: selectedSb?.id === sb.id }]"
                  @click="selectedSb = sb"
                >
                  <div class="shot-item-header">
                    <div class="shot-num">#{{ String(i+1).padStart(2,'0') }}</div>
                    <span class="tag" style="font-size:10px">{{ sb.shot_type || sb.shotType || '—' }}</span>
                    <span v-if="getStoryboardCharacterIds(sb).length" class="tag" style="font-size:10px">{{ getStoryboardCharacterIds(sb).length }} 캐릭터</span>
                    <div class="shot-status">
                      <div v-if="sb.imageUrl || sb.composedImage || sb.firstFrameImage" class="shot-dot has-img" title="이미지 생성됨"></div>
                      <div v-if="sb.videoUrl || sb.composedVideoUrl" class="shot-dot has-video" title="영상 생성됨"></div>
                      <div v-if="sb.dialogue" class="shot-dot has-dialogue" title="대사 있음"></div>
                    </div>
                  </div>
                  <div class="shot-body">
                    <div class="shot-desc">{{ sb.description || sb.title || '설명 없음' }}</div>
                  </div>
                  <div class="shot-meta">
                    <span class="mono dim" style="font-size:10px">{{ sb.duration || 10 }}s</span>
                    <span v-if="sb.location" class="shot-location">{{ sb.location }}</span>
                    <span v-if="getStoryboardCharacterNames(sb).length" class="shot-location">{{ getStoryboardCharacterNames(sb).join(' / ') }}</span>
                    <span v-if="sb.dialogue" class="shot-dialogue">{{ sb.dialogue }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Detail Panel -->
            <div class="detail-panel" v-if="selectedSb">
                <div class="detail-head">
                  <div class="detail-head-copy">
                    <span class="detail-head-title">샷 #{{ sbs.indexOf(selectedSb) + 1 }}</span>
                  <span class="detail-head-sub">{{ selectedSb.title || `샷 ${sbs.indexOf(selectedSb) + 1}` }} · {{ selectedSb.shot_type || selectedSb.shotType || '샷 크기 미설정' }}</span>
                  </div>
                  <span class="tag mono">{{ (selectedSb.duration || 10) }}s</span>
                  <button class="btn btn-ghost btn-icon ml-auto" style="color:var(--error)" @click="deleteShot(selectedSb)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
              </div>
              <div class="detail-body">
                <div class="detail-hero">
                  <div class="detail-hero-copy">
                    <div class="detail-hero-label">샷 개요</div>
                    <div class="detail-hero-text">{{ selectedSb.description || selectedSb.title || '현재 샷에 화면 설명이 없습니다. 핵심 동작과 구도를 먼저 보강하세요.' }}</div>
                    <div class="detail-status-row">
                      <span class="tag">{{ getSceneName(selectedSb) }}</span>
                      <span class="tag">{{ selectedSb.angle || '각도 미설정' }}</span>
                      <span class="tag">{{ selectedSb.movement || '카메라 움직임 미설정' }}</span>
                      <span class="tag" :class="getFirstFrame(selectedSb) ? 'tag-success' : ''">첫 프레임 {{ getFirstFrame(selectedSb) ? '생성됨' : '생성 대기' }}</span>
                      <span class="tag" :class="getLastFrame(selectedSb) ? 'tag-success' : ''">끝 프레임 {{ getLastFrame(selectedSb) ? '생성됨' : '생성 대기' }}</span>
                      <span class="tag" :class="hasVid(selectedSb) ? 'tag-success' : ''">영상 {{ hasVid(selectedSb) ? '생성됨' : '생성 대기' }}</span>
                    </div>
                  </div>
                  <div class="detail-preview-grid">
                    <div class="detail-preview-card">
                      <div class="detail-preview-title">첫 프레임</div>
                      <div class="detail-preview-media">
                        <img
                          v-if="getFirstFrame(selectedSb)"
                          :src="'/' + getFirstFrame(selectedSb)"
                          class="previewable-image"
                          @click.stop="openImageViewer('/' + getFirstFrame(selectedSb), `샷 #${sbs.indexOf(selectedSb) + 1} 첫 프레임`)"
                        />
                        <div v-else class="detail-preview-empty">생성 대기</div>
                      </div>
                    </div>
                    <div class="detail-preview-card">
                      <div class="detail-preview-title">끝 프레임</div>
                      <div class="detail-preview-media">
                        <img
                          v-if="getLastFrame(selectedSb)"
                          :src="'/' + getLastFrame(selectedSb)"
                          class="previewable-image"
                          @click.stop="openImageViewer('/' + getLastFrame(selectedSb), `샷 #${sbs.indexOf(selectedSb) + 1} 끝 프레임`)"
                        />
                        <div v-else class="detail-preview-empty">생성 대기</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="detail-section">
                  <div class="detail-section-head">
                    <span class="detail-section-title">샷 구조</span>
                    <span class="detail-section-copy">샷 크기, 각도, 카메라 움직임, 장면 연결, 길이</span>
                  </div>
                  <div class="field-grid field-grid-4">
                    <label class="field">
                      <span class="field-label">제목</span>
                      <input :value="selectedSb.title || ''" class="input"
                        @blur="updateField(selectedSb, 'title', $event.target.value)" placeholder="예: 눈밭 접근" />
                    </label>
                    <label class="field">
                      <span class="field-label">샷 크기</span>
                      <input
                        list="shot-type-list"
                        :value="selectedSb.shot_type || selectedSb.shotType || ''"
                        class="input"
                        placeholder="샷 크기 선택 또는 입력"
                        @change="updateField(selectedSb, 'shot_type', $event.target.value)"
                      />
                      <datalist id="shot-type-list">
                        <option v-for="t in shotTypes" :key="t" :value="t" />
                      </datalist>
                    </label>
                    <label class="field">
                      <span class="field-label">각도</span>
                      <input
                        list="shot-angle-list"
                        :value="selectedSb.angle || ''"
                        class="input"
                        placeholder="각도 선택 또는 입력"
                        @change="updateField(selectedSb, 'angle', $event.target.value)"
                      />
                      <datalist id="shot-angle-list">
                        <option v-for="t in shotAngles" :key="t" :value="t" />
                      </datalist>
                    </label>
                    <label class="field">
                      <span class="field-label">카메라 움직임</span>
                      <input
                        list="shot-movement-list"
                        :value="selectedSb.movement || ''"
                        class="input"
                        placeholder="카메라 움직임 선택 또는 입력"
                        @change="updateField(selectedSb, 'movement', $event.target.value)"
                      />
                      <datalist id="shot-movement-list">
                        <option v-for="t in shotMovements" :key="t" :value="t" />
                      </datalist>
                    </label>
                  </div>
                  <div class="field-grid field-grid-4">
                    <label class="field">
                      <span class="field-label">캐릭터 연결</span>
                      <div class="role-pills">
                        <button
                          v-for="char in chars"
                          :key="char.id"
                          type="button"
                          :class="['role-pill', { active: isStoryboardCharacterSelected(selectedSb, char.id) }]"
                          @click="toggleStoryboardCharacter(selectedSb, char.id)"
                        >
                          {{ char.name }}
                        </button>
                        <span v-if="!chars.length" class="dim" style="font-size:12px">현재 회차에는 캐릭터가 없습니다</span>
                      </div>
                    </label>
                    <label class="field">
                      <span class="field-label">장면 연결</span>
                      <select class="input" :value="selectedSb.scene_id || selectedSb.sceneId || ''"
                        @change="updateField(selectedSb, 'scene_id', $event.target.value ? Number($event.target.value) : null)">
                        <option value="">연결된 장면 없음</option>
                        <option v-for="scene in scenes" :key="scene.id" :value="scene.id">
                          {{ scene.location }} · {{ scene.time || '시간 미설정' }}
                        </option>
                      </select>
                    </label>
                    <label class="field">
                      <span class="field-label">장소</span>
                      <input :value="selectedSb.location || ''" class="input"
                        @blur="updateField(selectedSb, 'location', $event.target.value)" placeholder="장면 장소" />
                    </label>
                    <label class="field">
                      <span class="field-label">시간</span>
                      <input :value="selectedSb.time || ''" class="input"
                        @blur="updateField(selectedSb, 'time', $event.target.value)" placeholder="예: 심야 / 새벽" />
                    </label>
                    <label class="field">
                      <span class="field-label">길이</span>
                      <input :value="selectedSb.duration || 10" class="input" type="number" min="1" max="60"
                        @blur="updateField(selectedSb, 'duration', Number($event.target.value))" />
                    </label>
                  </div>
                </div>
                <div class="detail-section">
                  <div class="detail-section-head">
                    <span class="detail-section-title">화면 의미</span>
                    <span class="detail-section-copy">동작, 결과, 분위기와 대사</span>
                  </div>
                  <div class="field-grid field-grid-2">
                    <label class="field">
                      <span class="field-label">동작</span>
                      <textarea :value="selectedSb.action || ''" class="textarea" rows="3"
                        @blur="updateField(selectedSb, 'action', $event.target.value)" placeholder="누가 무엇을 하는지, 표정과 동작 디테일을 적으세요" />
                    </label>
                    <label class="field">
                      <span class="field-label">결과</span>
                      <textarea :value="selectedSb.result || ''" class="textarea" rows="3"
                        @blur="updateField(selectedSb, 'result', $event.target.value)" placeholder="샷 종료 시 상태 변화 또는 화면 결과" />
                    </label>
                  </div>
                  <div class="field-grid field-grid-2">
                    <label class="field">
                      <span class="field-label">화면 설명</span>
                      <textarea :value="selectedSb.description || ''" class="textarea" rows="4"
                        @blur="updateField(selectedSb, 'description', $event.target.value)" placeholder="화면 내용을 설명하세요..." />
                    </label>
                    <label class="field">
                      <span class="field-label">분위기</span>
                      <textarea :value="selectedSb.atmosphere || ''" class="textarea" rows="4"
                        @blur="updateField(selectedSb, 'atmosphere', $event.target.value)" placeholder="빛, 색감, 공기감, 환경 분위기" />
                    </label>
                  </div>
                  <label class="field">
                    <span class="field-label">대사 / 내레이션</span>
                    <textarea :value="selectedSb.dialogue || ''" class="textarea" rows="3"
                      @blur="updateField(selectedSb, 'dialogue', $event.target.value)" placeholder="캐릭터명: 대사 내용 또는 내레이션: 내용" />
                  </label>
                </div>
                <div class="detail-section">
                  <div class="detail-section-head">
                    <span class="detail-section-title">생성 프롬프트</span>
                    <span class="detail-section-copy">이미지, 영상, 배경음악, 효과음 생성에 각각 사용됩니다</span>
                  </div>
                  <label class="field">
                    <span class="field-label">정적 이미지 프롬프트</span>
                    <textarea :value="selectedSb.image_prompt || selectedSb.imagePrompt || ''" class="textarea" rows="4"
                      @blur="updateField(selectedSb, 'image_prompt', $event.target.value)" placeholder="첫 프레임, 끝 프레임, 샷 이미지에 사용할 단일 프레임 프롬프트" />
                  </label>
                  <label class="field">
                    <span class="field-label">영상 프롬프트</span>
                    <textarea :value="selectedSb.video_prompt || selectedSb.videoPrompt || ''" class="textarea" rows="5"
                      @blur="updateField(selectedSb, 'video_prompt', $event.target.value)" placeholder="3초 단위로 나눈 영상 프롬프트..." />
                  </label>
                  <div class="field-grid field-grid-2">
                    <label class="field">
                      <span class="field-label">배경음악 프롬프트</span>
                      <textarea :value="selectedSb.bgm_prompt || selectedSb.bgmPrompt || ''" class="textarea" rows="3"
                        @blur="updateField(selectedSb, 'bgm_prompt', $event.target.value)" placeholder="예: 낮게 깔리는 현악, 느린 전개" />
                    </label>
                    <label class="field">
                      <span class="field-label">효과음 프롬프트</span>
                      <textarea :value="selectedSb.sound_effect || selectedSb.soundEffect || ''" class="textarea" rows="3"
                        @blur="updateField(selectedSb, 'sound_effect', $event.target.value)" placeholder="예: 눈보라 소리, 눈 밟는 소리, 옷감 마찰음" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="rn && rt === 'storyboard_breaker'" class="step-loading">
            <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
            <div class="loading-text">스토리보드를 분해하고 프롬프트를 생성하는 중...</div>
          </div>

          <div v-else class="step-empty">
            <div class="empty-visual">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
                <rect x="2" y="2" width="20" height="20" rx="2.5"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/>
              </svg>
            </div>
            <div class="empty-title">극본을 스토리보드 순서로 분해</div>
            <div class="empty-desc">AI가 극본을 분석해 샷 목록과 영상 프롬프트를 생성합니다</div>
            <div class="locked-config-banner">현재 회차 영상 모델:{{ lockedVideoConfigLabel }}</div>
            <button class="btn btn-primary" @click="doBreakdown">
              <Loader2 v-if="rt === 'storyboard_breaker'" :size="13" class="animate-spin" />
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              AI 스토리보드 분해
            </button>
          </div>
        </div>

      </div>

      <!-- ===== PRODUCTION PANEL ===== -->
      <div v-else-if="panel === 'production'" class="content-panel">
        <!-- Guard: need script -->
        <div v-if="!scriptContent || !sbs.length" class="step-empty" style="flex:1">
          <div class="empty-visual">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <div class="empty-title">아직 준비되지 않았습니다</div>
          <div class="empty-desc">{{ !scriptContent ? '먼저 극본 작성을 완료하세요' : '먼저 스토리보드 분해를 완료하세요' }}</div>
          <button class="btn btn-primary" @click="panel = 'script'">극본으로 이동</button>
        </div>

        <template v-else>
          <div class="step-toolbar prod-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                <span class="step-name">제작작업대</span>
              </div>
            </div>
            <div class="prod-tabs">
              <button
                v-for="t in prodTabDefs"
                :key="t.id"
                :class="['prod-tab', { active: prodTab === t.id }]"
                @click="prodTab = t.id"
              >
                <component :is="t.icon" :size="11" />
                {{ t.label }}
                <span v-if="t.badge" class="prod-tab-badge">{{ t.badge }}</span>
              </button>
            </div>
            <div class="generation-mode-strip">
              <span :class="['generation-mode-dot', isManualGeneration ? 'manual' : 'api']"></span>
              <span>{{ isManualGeneration ? '수동/구독형 생성 모드' : 'API 자동 생성 모드' }}</span>
              <span class="dim">{{ isManualGeneration ? '프롬프트를 복사한 뒤 생성 결과를 파일 또는 URL로 등록합니다' : '설정된 API 키로 자동 생성합니다' }}</span>
            </div>
          </div>

          <!-- Sub: Characters -->
          <div v-if="prodTab === 'chars'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ visualChars.length }} 개 이미지 생성 대상 캐릭터</span>
              <span class="tag">{{ lockedImageConfigLabel }}</span>
              <span v-if="chars.length > visualChars.length" class="tag">내레이션은 음성만 유지</span>
              <div class="ml-auto flex gap-1">
                <button class="btn btn-sm" @click="handleBatchCharImages">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {{ isManualGeneration ? '일괄 프롬프트 복사' : '일괄 생성' }}
                </button>
              </div>
            </div>
            <div class="asset-grid">
              <div v-for="c in visualChars" :key="c.id" class="card asset-card">
                <div class="asset-cover">
                  <img
                    v-if="c.image_url || c.imageUrl"
                    :src="'/' + (c.image_url || c.imageUrl)"
                    class="previewable-image"
                    @click.stop="openImageViewer('/' + (c.image_url || c.imageUrl), `${c.name} 캐릭터 이미지`)"
                  />
                  <div v-else class="asset-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span class="asset-cover-badge" :class="(c.image_url || c.imageUrl) ? 'is-ready' : (isPendingCharImage(c.id) ? 'is-pending' : '')">{{ (c.image_url || c.imageUrl) ? '생성됨' : (isPendingCharImage(c.id) ? '생성 중' : '생성 대기') }}</span>
                </div>
                <div class="asset-body">
                  <div class="asset-name">{{ c.name }}</div>
                  <div class="asset-meta dim">{{ c.role || '캐릭터' }}</div>
                </div>
                <div class="asset-foot">
                  <span :class="['dot', (c.image_url || c.imageUrl) && 'ok', isPendingCharImage(c.id) && 'pending']" />
                  <span class="dim" style="font-size:10px">{{ (c.image_url || c.imageUrl) ? '생성됨' : (isPendingCharImage(c.id) ? '생성 중' : '생성 대기') }}</span>
                  <button class="btn btn-sm ml-auto" :disabled="isPendingCharImage(c.id)" @click="handleCharImage(c)">{{ isPendingCharImage(c.id) ? '생성 중' : (isManualGeneration ? '프롬프트/등록' : '생성') }}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub: Scenes -->
          <div v-else-if="prodTab === 'scenes'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ scenes.length }}개 장면</span>
              <span class="tag">{{ lockedImageConfigLabel }}</span>
              <div class="ml-auto flex gap-1">
                <button class="btn btn-sm" @click="handleBatchSceneImages">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {{ isManualGeneration ? '일괄 프롬프트 복사' : '일괄 생성' }}
                </button>
              </div>
            </div>
            <div class="asset-grid">
              <div v-for="s in scenes" :key="s.id" class="card asset-card">
                <div class="asset-cover wide">
                  <img
                    v-if="s.image_url || s.imageUrl"
                    :src="'/' + (s.image_url || s.imageUrl)"
                    class="previewable-image"
                    @click.stop="openImageViewer('/' + (s.image_url || s.imageUrl), `${s.location} 장면이미지`)"
                  />
                  <div v-else class="asset-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <span class="asset-cover-badge" :class="(s.image_url || s.imageUrl) ? 'is-ready' : (isPendingSceneImage(s.id) ? 'is-pending' : '')">{{ (s.image_url || s.imageUrl) ? '생성됨' : (isPendingSceneImage(s.id) ? '생성 중' : '생성 대기') }}</span>
                </div>
                <div class="asset-body">
                  <div class="asset-name">{{ s.location }}</div>
                  <div class="asset-meta dim">{{ s.time || '—' }}</div>
                </div>
                <div class="asset-foot">
                  <span :class="['dot', (s.image_url || s.imageUrl) && 'ok', isPendingSceneImage(s.id) && 'pending']" />
                  <span class="dim" style="font-size:10px">{{ (s.image_url || s.imageUrl) ? '생성됨' : (isPendingSceneImage(s.id) ? '생성 중' : '생성 대기') }}</span>
                  <button class="btn btn-sm ml-auto" :disabled="isPendingSceneImage(s.id)" @click="handleSceneImage(s)">{{ isPendingSceneImage(s.id) ? '생성 중' : (isManualGeneration ? '프롬프트/등록' : '생성') }}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub: Dubbing -->
          <div v-else-if="prodTab === 'dubbing'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ ttsEligibleCount }} 개 더빙 생성 가능</span>
              <span class="tag mono">{{ ttsGeneratedCount }}/{{ ttsEligibleCount }} 생성됨</span>
              <span class="tag">{{ lockedAudioConfigLabel }}</span>
              <div class="ml-auto flex gap-1">
                <button class="btn btn-sm" @click="handleBatchShotTTS">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  {{ isManualGeneration ? '일괄 프롬프트 복사' : '일괄 생성' }}
                </button>
              </div>
            </div>

            <div v-if="!ttsEligibleCount" class="step-empty" style="min-height:260px">
              <div class="empty-visual">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              </div>
              <div class="empty-title">현재 생성할 더빙이 없습니다</div>
              <div class="empty-desc">스토리보드에 “캐릭터명: 대사” 또는 “내레이션: 문안”을 입력하면 생성 대기 음성 샷이 여기에 표시됩니다.</div>
            </div>

            <div v-else class="dub-grid">
                <div v-for="(sb, i) in sbs.filter(hasDialogue)" :key="sb.id" class="card dub-card">
                  <div class="dub-head">
                    <div class="dub-copy">
                    <div class="dub-title">
                      <span class="frame-num">#{{ String(sb.storyboard_number || sb.storyboardNumber || i + 1).padStart(2, '0') }}</span>
                      <span class="frame-badge">{{ getDialogueSpeaker(sb) }}</span>
                    </div>
                    <div class="dub-desc">{{ getDialogueText(sb) || '텍스트 미입력' }}</div>
                    </div>
                    <span class="tag" :class="hasTTS(sb) ? 'tag-success' : ''">{{ hasTTS(sb) ? '생성됨' : '생성 대기' }}</span>
                  </div>
                <div class="dub-meta">
                  <span class="dim">{{ sb.shot_type || sb.shotType || '샷 크기 미설정' }}</span>
                  <span class="dim">{{ sb.duration || 10 }}s</span>
                  <span class="dim">{{ sb.location || '장소 미설정' }}</span>
                </div>
                <div class="dub-foot">
                  <audio v-if="hasTTS(sb)" :src="'/' + getTTSUrl(sb)" controls preload="none" class="dub-audio" />
                  <div v-else class="dim" style="font-size:12px">아직 음성 파일이 생성되지 않았습니다</div>
                  <button class="btn btn-sm ml-auto" @click="handleShotTTS(sb)">{{ isManualGeneration ? '프롬프트/등록' : '더빙 생성' }}</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub: Shots -->
          <div v-else-if="prodTab === 'shots'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ sbs.length }} 개 샷</span>
              <span class="tag mono">{{ shotImgCount }}/{{ sbs.length }} 프레임 이미지 있음</span>
              <span class="tag">{{ lockedImageConfigLabel }}</span>
              <div class="ml-auto flex gap-1">
                <BaseSelect v-model="frameMode" :options="frameModeOptions" placeholder="프레임 모드" searchable style="width:100px" />
                <button v-if="gridImagePath" class="btn btn-sm" @click="reopenGridPreview">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
                  현재 그리드 이미지 보기
                </button>
                <button class="btn btn-primary btn-sm" @click="openGridTool">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  그리드 이미지 도구
                </button>
              </div>
            </div>

            <div v-if="gridHistory.length" class="grid-history-panel">
              <div v-if="gridImagePath" class="latest-grid-strip">
                <button class="latest-grid-strip-thumb" @click="openImageViewer('/' + gridImagePath, '현재 그리드 이미지')">
                  <img :src="'/' + gridImagePath" class="previewable-image" />
                </button>
                <div class="latest-grid-strip-copy">
                  <div class="latest-grid-strip-head">
                    <span class="tag mono">{{ gridActualLayout.rows }}x{{ gridActualLayout.cols }}</span>
                    <span class="tag" v-if="gridRecoveredMode">{{ gridRecoveredMode }}</span>
                  </div>
                  <div class="latest-grid-strip-title">현재 그리드 이미지</div>
                  <div class="latest-grid-strip-meta">
                    <span v-if="gridRecoveredAt">{{ gridRecoveredAt }}</span>
                    <span>계속 분할하고 배정 가능</span>
                  </div>
                </div>
                <div class="latest-grid-strip-actions">
                  <button class="btn btn-sm" @click="reopenGridPreview">미리보기</button>
                  <button class="btn btn-primary btn-sm" @click="continueGridSplit">계속 분할</button>
                </div>
              </div>
              <div class="grid-history-head">
                <div>
                  <div class="grid-history-title">그리드 이미지 기록</div>
                  <div class="grid-history-subtitle">필요할 때 펼쳐 다른 그리드 이미지로 전환할 수 있으며 첫 화면을 기본으로 차지하지 않습니다</div>
                </div>
                <button class="btn btn-sm" @click="showAllGridHistory = !showAllGridHistory">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline :points="showAllGridHistory ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"/></svg>
                  {{ showAllGridHistory ? '그리드 이미지 기록 접기' : `전체 펼치기 (${gridHistory.length})` }}
                </button>
              </div>
              <div v-if="showAllGridHistory" class="grid-history-list">
                <button
                  v-for="item in gridHistory"
                  :key="item.id"
                  :class="['grid-history-item', { active: item.localPath === gridImagePath }]"
                  @click="selectGridHistory(item)"
                >
                  <div class="grid-history-thumb">
                    <img :src="'/' + item.localPath" class="previewable-image" />
                  </div>
                  <div class="grid-history-copy">
                    <div class="grid-history-tags">
                      <span class="tag mono">#{{ item.id }}</span>
                      <span class="tag mono">{{ item.layout.rows }}x{{ item.layout.cols }}</span>
                      <span class="tag">{{ item.modeLabel }}</span>
                    </div>
                    <div class="grid-history-meta">{{ item.createdAtLabel }}</div>
                  </div>
                </button>
              </div>
            </div>

            <div class="frame-scroll">
              <div class="frame-grid">
                <div v-for="(sb, i) in sbs" :key="sb.id"
                  :class="['frame-row', 'card', { active: selectedSb?.id === sb.id }]"
                  @click="selectedSb = sb">
                  <!-- Info: number + type + desc -->
                  <div class="frame-info">
                    <div class="frame-top">
                      <span class="frame-num">#{{ String(i+1).padStart(2,'0') }}</span>
                      <span class="frame-badge">{{ sb.shot_type || sb.shotType || '—' }}</span>
                    </div>
                    <div class="frame-desc">{{ sb.description || sb.title || '—' }}</div>
                    <div class="frame-meta">
                      <span :class="['dot', getFirstFrame(sb) && 'ok', isPendingShotFrame(sb.id, 'first_frame') && 'pending']" />
                      <span class="dim" style="font-size:11px">첫 프레임</span>
                      <span v-if="frameMode === 'first_last'" style="display:flex;align-items:center;gap:4px">
                        <span :class="['dot', getLastFrame(sb) && 'ok', isPendingShotFrame(sb.id, 'last_frame') && 'pending']" />
                        <span class="dim" style="font-size:11px">끝 프레임</span>
                      </span>
                    </div>
                  </div>
                  <!-- Thumbnails -->
                  <div class="frame-thumbs">
                    <div class="frame-thumb-wrap">
                      <div class="frame-thumb" @click.stop="!isPendingShotFrame(sb.id, 'first_frame') && handleShotFrame(sb, 'first_frame')">
                        <img
                          v-if="getFirstFrame(sb)"
                          :src="'/' + getFirstFrame(sb)"
                          class="previewable-image"
                          @click.stop="openImageViewer('/' + getFirstFrame(sb), `샷 #${String(i + 1).padStart(2, '0')} 첫 프레임`)"
                        />
                        <div v-else class="frame-thumb-empty">
                          <Loader2 v-if="isPendingShotFrame(sb.id, 'first_frame')" :size="14" class="animate-spin" />
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <span v-if="getFirstFrame(sb)" class="frame-re">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        </span>
                      </div>
                      <span class="frame-thumb-label">{{ isPendingShotFrame(sb.id, 'first_frame') ? '첫 프레임생성 중' : '첫 프레임' }}</span>
                    </div>
                    <div v-if="frameMode === 'first_last'" class="frame-thumb-wrap">
                      <div class="frame-thumb" @click.stop="!isPendingShotFrame(sb.id, 'last_frame') && handleShotFrame(sb, 'last_frame')">
                        <img
                          v-if="getLastFrame(sb)"
                          :src="'/' + getLastFrame(sb)"
                          class="previewable-image"
                          @click.stop="openImageViewer('/' + getLastFrame(sb), `샷 #${String(i + 1).padStart(2, '0')} 끝 프레임`)"
                        />
                        <div v-else class="frame-thumb-empty">
                          <Loader2 v-if="isPendingShotFrame(sb.id, 'last_frame')" :size="14" class="animate-spin" />
                          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <span v-if="getLastFrame(sb)" class="frame-re">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        </span>
                      </div>
                      <span class="frame-thumb-label">{{ isPendingShotFrame(sb.id, 'last_frame') ? '끝 프레임생성 중' : '끝 프레임' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Grid Tool Dialog -->
            <div v-if="gridDialog" class="overlay" @click.self="gridDialog = false">
              <div class="card grid-tool">
                <div class="grid-tool-head">
                  <span style="font-size:15px;font-weight:600;font-family:var(--font-display)">그리드 이미지 도구</span>
                  <button class="btn btn-ghost btn-icon ml-auto" @click="gridDialog = false">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <!-- Step 0: Config -->
                <div v-if="gridStep === 0" class="grid-tool-body">
                  <div class="grid-mode-tabs">
                    <button v-for="m in gridModes" :key="m.id"
                      :class="['grid-mode-tab', { active: gridMode === m.id }]"
                      @click="gridMode = m.id; gridSelected = []; gridSingleTarget = null; gridAssignmentsState = []">
                      <span style="font-weight:600">{{ m.label }}</span>
                      <span class="dim" style="font-size:11px">{{ m.desc }}</span>
                    </button>
                  </div>

                  <div class="grid-config">
                    <label class="field" style="flex:0 0 auto" v-if="gridMode !== 'multi_ref'">
                      <span class="field-label">그리드</span>
                      <BaseSelect v-model="gridLayout" :options="gridLayoutOptions" placeholder="그리드" style="width:90px" />
                    </label>
                    <div class="field" style="flex:1">
                      <span class="field-label">
                        {{ gridMode === 'multi_ref' ? '대상 샷 선택' : '샷 선택' }}
                        <span class="dim" v-if="gridMode !== 'multi_ref'">(선택됨 {{ gridSelected.length }})</span>
                      </span>
                    </div>
                    <div style="align-self:flex-end" v-if="gridMode !== 'multi_ref'">
                      <button class="btn btn-sm" @click="gridSelectAll">{{ gridSelected.length === sbs.length ? '전체 선택 해제' : '전체 선택' }}</button>
                    </div>
                  </div>

                  <div class="grid-pick-list">
                    <label v-for="(sb, i) in sbs" :key="sb.id"
                      :class="['grid-pick-item', { selected: gridMode === 'multi_ref' ? gridSingleTarget === sb.id : gridSelected.includes(sb.id) }]">
                      <input v-if="gridMode === 'multi_ref'" type="radio" :value="sb.id" v-model="gridSingleTarget" name="grid-target" />
                      <input v-else type="checkbox" :value="sb.id" v-model="gridSelected" />
                      <span class="mono" style="font-size:11px;width:28px">#{{ String(i+1).padStart(2,'0') }}</span>
                      <span class="truncate" style="flex:1;font-size:12px">{{ sb.description || sb.title || '—' }}</span>
                    </label>
                  </div>

                  <div class="grid-tool-foot">
                    <span v-if="gridCanStart" class="tag mono">{{ gridAutoLayout.rows }}x{{ gridAutoLayout.cols }} = {{ gridAutoLayout.rows * gridAutoLayout.cols }}칸</span>
                    <span class="dim" style="font-size:11px">{{ gridPromptLoading ? gridPromptStatus : gridSummary }}</span>
                    <button class="btn btn-primary ml-auto" :disabled="!gridCanStart || gridPromptLoading" @click="generateGridPrompt">
                      <Loader2 v-if="gridPromptLoading" :size="12" class="animate-spin" />
                      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      {{ gridPromptLoading ? '생성 중' : '프롬프트 생성' }}
                    </button>
                  </div>
                </div>

                <!-- Step 1: Prompt Preview -->
                <div v-else-if="gridStep === 1" class="grid-tool-body">
                  <div class="grid-prompt-summary">
                    <div class="grid-prompt-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      그리드 이미지 프롬프트
                      <span v-if="gridPromptSource" class="tag ml-8">{{ gridPromptSource === 'agent' ? 'AI 생성' : '템플릿 대체' }}</span>
                    </div>
                    <div class="grid-prompt-text">{{ gridPromptText || '（생성 대기）' }}</div>
                  </div>

                  <div class="grid-blank-preview" :style="gridBlankStyle">
                    <div v-for="(cell, i) in gridCellPrompts" :key="i" class="grid-blank-cell">
                      <div class="grid-blank-cell-index">#{{ cell.shot_number }} {{ {first_frame:'첫 프레임',last_frame:'끝 프레임',reference:'참조'}[cell.frame_type] || '' }}</div>
                      <div class="grid-blank-cell-desc">{{ cell.prompt }}</div>
                    </div>
                    <div v-for="i in Math.max(0, (gridAutoLayout.rows * gridAutoLayout.cols) - gridCellPrompts.length)" :key="'empty-'+i" class="grid-blank-cell empty">
                      <div class="grid-blank-cell-index">비어 있음</div>
                      <div class="grid-blank-cell-desc">—</div>
                    </div>
                  </div>

                  <div class="grid-tool-foot">
                    <button class="btn" @click="gridStep = 0">이전 단계</button>
                    <button class="btn ml-auto" @click="generateGridPrompt" :disabled="gridPromptLoading">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      다시 생성
                    </button>
                    <button class="btn btn-primary" @click="startGridGen">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      {{ isManualGeneration ? '프롬프트 복사/등록' : '그리드 이미지 생성' }}
                    </button>
                  </div>
                </div>

                <!-- Step 2: Generating -->
                <div v-else-if="gridStep === 2" class="grid-tool-body" style="align-items:center;justify-content:center;min-height:300px">
                  <Loader2 :size="28" class="animate-spin" style="color:var(--accent)" />
                  <div class="loading-text" style="margin-top:12px">그리드 이미지 생성 중...</div>
                  <div class="dim" style="font-size:11px;margin-top:6px">{{ gridStatusText }}</div>
                </div>

                <!-- Step 3: Preview -->
                <div v-else-if="gridStep === 3" class="grid-tool-body grid-tool-body-preview">
                  <div class="grid-preview-layout">
                    <div class="grid-preview-pane">
                      <div class="grid-preview-wrap">
                        <div class="grid-preview-stage">
                          <img
                            :src="'/' + gridImagePath"
                            class="grid-preview-img previewable-image"
                            @click.stop="openImageViewer('/' + gridImagePath, '그리드 이미지 미리보기')"
                          />
                          <div class="grid-overlay" :style="gridOverlayStyle">
                            <button
                              v-for="(a, i) in gridAssignments"
                              :key="i"
                              type="button"
                              :class="['grid-overlay-cell', activeGridCell === i && 'active']"
                              @click="focusGridCell(i)"
                            >
                              <span class="grid-cell-label">{{ gridCellLabel(a) }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="grid-adjust-summary">
                        <span class="tag mono">{{ gridActualLayout.rows }}x{{ gridActualLayout.cols }} = {{ gridActualLayout.rows * gridActualLayout.cols }}칸</span>
                        <span class="dim" style="font-size:12px">{{ gridAssignedCount }}/{{ gridAssignments.length }} 칸 배정됨</span>
                        <span class="tag" v-if="gridAssignedCount < gridAssignments.length">배정되지 않은 칸은 무시되며 스토리보드에 반영되지 않습니다</span>
                      </div>
                    </div>
                    <div class="grid-assignment-pane">
                      <div class="grid-assign-head">
                        <div class="grid-assign-title">칸 배정</div>
                        <div class="grid-assign-subtitle">분할 후 각 칸이 어느 스토리보드에 대응하는지 직접 정하세요</div>
                      </div>
                      <div v-if="gridAssignmentTotalPages > 1" class="grid-assign-pagination">
                        <button class="btn btn-sm" :disabled="gridAssignmentPage === 0" @click="gridAssignmentPage--">이전 페이지</button>
                        <span class="dim">제 {{ gridAssignmentPage + 1 }}/{{ gridAssignmentTotalPages }} 페이지</span>
                        <span class="dim">{{ gridAssignmentPageStart + 1 }}-{{ gridAssignmentPageEnd }} / {{ gridAssignments.length }}</span>
                        <button class="btn btn-sm ml-auto" :disabled="gridAssignmentPage >= gridAssignmentTotalPages - 1" @click="gridAssignmentPage++">다음 페이지</button>
                      </div>
                      <div class="grid-assign-columns">
                        <span>칸</span>
                        <span>샷</span>
                        <span>유형</span>
                        <span>현재 연결</span>
                      </div>
                      <div class="grid-assign-info">
                        <div v-for="item in pagedGridAssignments" :key="item.index" :class="['grid-assign-row', activeGridCell === item.index && 'active']">
                          <span class="grid-assign-index">칸{{ item.index + 1 }}</span>
                          <BaseSelect
                            :model-value="item.assignment.storyboard_id"
                            :options="gridAssignmentShotOptions"
                            placeholder="샷 선택"
                            @update:model-value="updateGridAssignment(item.index, 'storyboard_id', $event)"
                          />
                          <BaseSelect
                            :model-value="item.assignment.frame_type"
                            :options="gridFrameTypeOptions"
                            placeholder="프레임 유형"
                            style="width:100%"
                            @update:model-value="updateGridAssignment(item.index, 'frame_type', $event)"
                          />
                          <span class="grid-assign-bind">{{ gridCellTitle(item.assignment.storyboard_id) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="grid-tool-foot">
                    <button class="btn" @click="gridStep = 1">돌아가기</button>
                    <button class="btn btn-primary ml-auto" @click="doGridSplit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                      분할하고 배정
                    </button>
                  </div>
                </div>

                <!-- Step 4: Done -->
                <div v-else-if="gridStep === 4" class="grid-tool-body" style="align-items:center;justify-content:center;min-height:200px">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <div style="font-size:17px;font-weight:700;font-family:var(--font-display);margin-top:8px">배정 완료</div>
                  <div class="dim" style="font-size:13px;margin-top:4px">{{ gridAssignedCount }} 칸 배정됨</div>
                  <button class="btn btn-primary" style="margin-top:16px" @click="gridDialog = false; refresh()">닫기</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub: Videos -->
          <div v-else-if="prodTab === 'videos'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ sbs.length }} 개 샷</span>
              <span class="tag mono">{{ shotVidCount }}/{{ sbs.length }} 생성됨</span>
              <div class="ml-auto flex gap-1">
                <button class="btn btn-sm" @click="handleBatchVideos">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  {{ isManualGeneration ? '영상 프롬프트 일괄 복사' : '영상 일괄 생성' }}
                </button>
              </div>
            </div>
            <div class="prod-grid">
              <div v-for="(sb, i) in sbs" :key="sb.id" class="card prod-card">
                <div class="prod-cover">
                  <video
                    v-if="hasVid(sb)"
                    :src="'/' + getVideoUrl(sb)"
                    class="prod-video"
                    controls
                    preload="metadata"
                    playsinline
                  />
                  <img
                    v-else-if="hasImg(sb)"
                    :src="'/' + getStoryboardCover(sb)"
                    class="previewable-image"
                    @click.stop="openImageViewer('/' + getStoryboardCover(sb), `샷 #${String(i + 1).padStart(2, '0')} 참조 이미지`)"
                  />
                  <div v-else class="prod-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  </div>
                  <span class="prod-idx">#{{ String(i+1).padStart(2,'0') }}</span>
                  <span v-if="hasComposed(sb)" class="prod-overlay-badge">합성됨</span>
                </div>
                <div class="prod-info">
                  <div class="prod-desc truncate">{{ sb.description || sb.title || '—' }}</div>
                  <div class="prod-meta-line">{{ sb.shot_type || sb.shotType || '샷 크기 미설정' }} · {{ sb.duration || 10 }}s</div>
                  <div class="prod-dots">
                    <span :class="['dot', hasImg(sb) && 'ok']" /><span style="font-size:10px">이미지</span>
                    <span :class="['dot', hasVid(sb) && 'ok', isPendingVideo(sb.id) && 'pending']" /><span style="font-size:10px">{{ isPendingVideo(sb.id) ? '영상 생성 중' : '영상' }}</span>
                  </div>
                  <div v-if="videoFailMessage(sb.id)" class="prod-error">{{ videoFailMessage(sb.id) }}</div>
                </div>
                <div class="prod-actions">
                  <button class="btn btn-sm" :disabled="isPendingVideo(sb.id)" @click="handleVideo(sb)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    {{ isPendingVideo(sb.id) ? '생성 중' : (isManualGeneration ? '프롬프트/등록' : '영상 생성') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sub: Compose -->
          <div v-else-if="prodTab === 'compose'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ sbs.length }} 개 샷</span>
              <span class="tag mono">{{ composedCount }}/{{ sbs.length }} 합성됨</span>
              <div class="ml-auto flex gap-1">
                <button class="btn btn-sm" @click="batchCompose">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  일괄 합성
                </button>
              </div>
            </div>
            <div class="prod-grid">
              <div v-for="(sb, i) in sbs" :key="sb.id" class="card prod-card">
                <div class="prod-cover">
                  <video
                    v-if="hasComposed(sb)"
                    :src="'/' + getComposedVideoUrl(sb)"
                    class="prod-video"
                    controls
                    preload="metadata"
                    playsinline
                  />
                  <video
                    v-else-if="hasVid(sb)"
                    :src="'/' + getVideoUrl(sb)"
                    class="prod-video"
                    controls
                    preload="metadata"
                    playsinline
                  />
                  <img
                    v-else-if="hasImg(sb)"
                    :src="'/' + getStoryboardCover(sb)"
                    class="previewable-image"
                    @click.stop="openImageViewer('/' + getStoryboardCover(sb), `샷 #${String(i + 1).padStart(2, '0')} 참조 이미지`)"
                  />
                  <div v-else class="prod-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  </div>
                  <span class="prod-idx">#{{ String(i+1).padStart(2,'0') }}</span>
                  <span v-if="hasComposed(sb)" class="prod-overlay-badge">합성됨</span>
                </div>
                <div class="prod-info">
                  <div class="prod-desc truncate">{{ sb.description || sb.title || '—' }}</div>
                  <div class="prod-meta-line">{{ sb.shot_type || sb.shotType || '샷 크기 미설정' }} · {{ sb.duration || 10 }}s</div>
                  <div class="prod-dots">
                    <span :class="['dot', hasVid(sb) && 'ok']" /><span style="font-size:10px">영상</span>
                    <span :class="['dot', hasTTS(sb) && 'ok']" /><span style="font-size:10px">더빙</span>
                    <span :class="['dot', hasComposed(sb) && 'ok', isPendingCompose(sb.id) && 'pending']" /><span style="font-size:10px">{{ isPendingCompose(sb.id) ? '합성 중' : '합성' }}</span>
                  </div>
                  <div v-if="composeFailMessage(sb.id)" class="prod-error">{{ composeFailMessage(sb.id) }}</div>
                </div>
                <div class="prod-actions">
                  <button class="btn btn-sm" :disabled="!hasVid(sb) || isPendingCompose(sb.id)" @click="doCompose(sb)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    {{ isPendingCompose(sb.id) ? '합성 중' : (hasComposed(sb) ? '다시 합성' : '합성 시작') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Production Navigator -->
        </template>
      </div>

      <!-- ===== EXPORT PANEL ===== -->
      <div v-else class="content-panel">
        <div v-if="!sbs.length" class="step-empty" style="flex:1">
          <div class="empty-visual">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div class="empty-title">아직 준비되지 않았습니다</div>
          <div class="empty-desc">먼저 스토리보드와 제작 과정을 완료하세요</div>
          <button class="btn btn-primary" @click="panel = 'script'">극본으로 이동</button>
        </div>
        <div v-else class="export-split">
          <div class="export-main">
            <template v-if="mergeUrl">
              <video :src="'/' + mergeUrl" controls class="export-video" />
              <div class="export-bar">
                <span class="tag tag-success">이어붙이기 완료</span>
                <span class="dim" style="font-size:12px">{{ sbs.length }} 샷 · {{ totalDuration }}s</span>
                <a :href="'/' + mergeUrl" download class="btn btn-primary ml-auto">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  영상 다운로드
                </a>
              </div>
            </template>
            <template v-else>
              <div class="step-empty">
                <div class="empty-visual">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </div>
                <div class="empty-title">전체 회차 영상 이어붙이기</div>
                <div class="empty-desc">{{ composedCount }}개의 합성된 샷을 완성 영상으로 이어붙입니다</div>
                <button class="btn btn-primary" :disabled="composedCount === 0" @click="doMerge" style="margin-top:12px">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  이어붙이기 시작
                </button>
              </div>
            </template>
          </div>
          <div class="export-list">
            <div class="export-list-head">샷 개요</div>
            <div class="export-list-body">
              <div v-for="(sb, i) in sbs" :key="sb.id" class="exp-row">
                <span class="mono dim" style="font-size:10px">#{{ String(i+1).padStart(2,'0') }}</span>
                <span class="truncate" style="flex:1;font-size:11px">{{ sb.description || sb.title || '—' }}</span>
                <span :class="['dot', hasComposed(sb) && 'ok']" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showBottomBubble" class="step-bubble">
        <button
          v-if="panel === 'script'"
          class="bubble-btn"
          :disabled="scriptStep === 0"
          @click="goPrevStep"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          {{ prevStepLabel || '이전 단계' }}
        </button>
        <button
          v-else-if="panel === 'production'"
          class="bubble-btn"
          :disabled="prodTabIdx === 0"
          @click="prodTabIdx = Math.max(0, prodTabIdx - 1)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          {{ prodTabDefs[Math.max(0, prodTabIdx - 1)]?.label || '이전 단계' }}
        </button>

        <div class="bubble-dots">
          <button
            v-for="step in bubbleSteps"
            :key="step.key"
            :class="['bubble-dot', { done: step.done, current: step.key === activeBubbleKey }]"
            @click="goSubStep(step.key)"
            :title="step.label"
          ></button>
        </div>

        <button
          v-if="panel === 'script'"
          class="bubble-btn primary"
          :disabled="!canGoNext"
          @click="goNextStep"
        >
          {{ nextStepLabel || '다음 단계' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        <button
          v-else-if="panel === 'production'"
          class="bubble-btn primary"
          :disabled="panel === 'production' && prodTab === 'compose' && !canExport"
          @click="goNextProd"
        >
          {{ prodTabIdx < prodTabDefs.length - 1 ? (prodTabDefs[prodTabIdx + 1]?.label || '다음 단계') : '내보내기로 이동' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      <div v-if="manualDialog.open" class="overlay manual-asset-overlay" @click.self="closeManualDialog">
        <div class="card manual-asset-dialog">
          <div class="manual-asset-head">
            <div>
              <div class="manual-asset-title">{{ manualDialog.title }}</div>
              <div class="manual-asset-subtitle">프롬프트를 외부 구독형 서비스나 Codex $imagegen에 사용한 뒤 결과를 등록하세요</div>
            </div>
            <button class="btn btn-ghost btn-icon" @click="closeManualDialog">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="manual-asset-body">
            <div class="manual-prompt-panel">
              <div class="manual-prompt-head">
                <span>생성 프롬프트</span>
                <button class="btn btn-sm" @click="copyPrompt(manualDialog.prompt, '생성 프롬프트')">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  복사
                </button>
              </div>
              <textarea class="manual-prompt-text" :value="manualDialog.prompt" readonly rows="10"></textarea>
            </div>
            <div class="manual-register-panel">
              <label class="field">
                <span class="field-label">결과 파일</span>
                <input class="input" type="file" :accept="manualDialog.accept" @change="onManualFileChange" />
              </label>
              <label class="field">
                <span class="field-label">URL 또는 저장 경로</span>
                <input class="input" v-model="manualDialog.url" placeholder="https://... 또는 static/..." />
              </label>
              <div class="manual-register-hint">
                파일을 선택하면 프로젝트 저장소로 업로드합니다. 이미 저장된 파일은 `static/...` 경로를 입력해 연결할 수 있습니다.
              </div>
            </div>
          </div>
          <div class="manual-asset-foot">
            <button class="btn" @click="closeManualDialog">닫기</button>
            <button class="btn btn-primary ml-auto" @click="submitManualAsset">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              결과 연결
            </button>
          </div>
        </div>
      </div>

      <div v-if="imageViewer.open && imageViewer.src" class="overlay image-viewer-overlay" @click.self="closeImageViewer">
        <div class="card image-viewer-dialog">
          <div class="image-viewer-head">
            <div class="image-viewer-title">{{ imageViewer.title || '이미지 미리보기' }}</div>
            <button class="btn btn-ghost btn-icon" @click="closeImageViewer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="image-viewer-body">
            <img :src="imageViewer.src" :alt="imageViewer.title || '이미지 미리보기'" class="image-viewer-img" />
          </div>
        </div>
      </div>
    </main>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import {
  Users, MapPin, Video, ImageIcon, Layers, Mic2, FileText, FolderKanban, Clapperboard, Download,
} from 'lucide-vue-next'
import { dramaAPI, episodeAPI, storyboardAPI, characterAPI, sceneAPI, imageAPI, videoAPI, composeAPI, mergeAPI, gridAPI, aiConfigAPI, voicesAPI, uploadAPI } from '~/composables/useApi'
import { useAgent } from '~/composables/useAgent'
import BaseSelect from '~/components/BaseSelect.vue'

definePageMeta({ layout: 'studio' })

const route = useRoute()
const dramaId = Number(route.params.id)
const episodeNumber = Number(route.params.episodeNumber)

const drama = ref(null), episode = ref(null), chars = ref([]), scenes = ref([]), sbs = ref([]), mergeData = ref(null)
const panel = ref('script')
const { running: rn, runningType: rt, run: runAgent } = useAgent()

const localRaw = ref(''), localScript = ref('')
const rawContent = computed(() => episode.value?.content || '')
const scriptContent = computed(() => episode.value?.script_content || episode.value?.scriptContent || '')
const epId = computed(() => episode.value?.id || 0)
const rawLen = computed(() => localRaw.value.replace(/\s/g, '').length || 0)
const scriptLen = computed(() => localScript.value.replace(/\s/g, '').length || 0)
const charsVoiced = computed(() => chars.value.filter(c => c.voice_style || c.voiceStyle).length)
const voiceSampleCount = computed(() => chars.value.filter(c => c.voice_sample_url || c.voiceSampleUrl).length)
const composedCount = computed(() => sbs.value.filter(s => s.composed_video_url || s.composedVideoUrl).length)
const mergeUrl = computed(() => mergeData.value?.merged_url || mergeData.value?.mergedUrl || null)

const scriptStep = ref(0)
const prodTab = ref('chars')
const prodTabIdx = computed({
  get: () => prodTabDefs.value.findIndex(t => t.id === prodTab.value),
  set: (v) => { prodTab.value = prodTabDefs.value[v]?.id || 'chars' },
})
const frameMode = ref('first')
const fallbackVoiceProfiles = [
  { id: 'alloy', label: 'Alloy', gender: '중성', traits: '균형감, 자연스러움, 절제됨', suitable: '범용 내레이션、내레이션、안정적인 출력이 필요한 캐릭터' },
  { id: 'echo', label: 'Echo', gender: '남성 음성', traits: '낮고 안정적이며 침착함', suitable: '성숙한 남성、아버지 세대、내레이션、압박감 있는 캐릭터' },
  { id: 'fable', label: 'Fable', gender: '남성 음성', traits: '따뜻함, 서사감, 강한 표현력', suitable: '남자 주인공、성장형 캐릭터、서사 담당' },
  { id: 'onyx', label: 'Onyx', gender: '남성 음성', traits: '깊고 힘 있으며 권위적', suitable: '악역、강한 캐릭터、주도형 인물' },
  { id: 'nova', label: 'Nova', gender: '여성 음성', traits: '부드러움, 달콤함, 친근함', suitable: '여자 주인공、어머니、부드러운 조연' },
  { id: 'shimmer', label: 'Shimmer', gender: '여성 음성', traits: '밝음, 활발함, 젊음', suitable: '소녀、경쾌한 캐릭터、톡톡 튀는 조연' },
]
const geminiVoiceProfiles = [
  { id: 'Kore', label: 'Kore', gender: '중성', traits: '단단함, 명료함, 안정감', suitable: '내레이션、주도적인 인물、진지한 장면' },
  { id: 'Puck', label: 'Puck', gender: '남성 음성', traits: '밝음, 경쾌함, 에너지', suitable: '젊은 남성、활발한 캐릭터、코믹한 장면' },
  { id: 'Charon', label: 'Charon', gender: '남성 음성', traits: '정보 전달형, 침착함', suitable: '설명、차분한 남성、안정적인 대사' },
  { id: 'Fenrir', label: 'Fenrir', gender: '남성 음성', traits: '흥분감, 강한 표현', suitable: '갈등 장면、강한 남성、긴장감 있는 대사' },
  { id: 'Aoede', label: 'Aoede', gender: '여성 음성', traits: '산뜻함, 부드러움', suitable: '여자 주인공、밝은 조연、따뜻한 장면' },
  { id: 'Leda', label: 'Leda', gender: '여성 음성', traits: '젊음, 맑음', suitable: '소녀、젊은 여성、감정선이 가벼운 장면' },
  { id: 'Sulafat', label: 'Sulafat', gender: '중성', traits: '따뜻함, 안정감', suitable: '감성 내레이션、차분한 인물、위로하는 대사' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix', gender: '여성 음성', traits: '부드러움, 섬세함', suitable: '성숙한 여성、감정 연기、속삭이는 장면' },
]
const voiceProfiles = ref(fallbackVoiceProfiles)
const voiceSelectOptions = computed(() => voiceProfiles.value.map(v => ({ label: `${v.label} · ${v.traits}`, value: v.id })))
const videoConfigSelectOptions = computed(() => videoConfigs.value.map(c => {
  let modelName = ''
  try { const m = JSON.parse(c.model || '[]'); modelName = Array.isArray(m) ? (m[0] || '') : (m || '') } catch { modelName = c.model || '' }
  const label = modelName ? `${modelName} (${c.provider})` : `${c.name} (${c.provider})`
  return { label, value: c.id }
}))
const frameModeOptions = [{ label: '첫 프레임만', value: 'first' }, { label: '첫/끝 프레임', value: 'first_last' }]
const gridLayoutOptions = [
  { label: '2x2', value: '2x2' },
  { label: '3x3', value: '3x3' },
  { label: '4x4', value: '4x4' },
  { label: '5x5', value: '5x5' },
]
const imageConfigs = ref([])
const videoConfigs = ref([])
const audioConfigs = ref([])
const pendingCharImageIds = ref([])
const pendingSceneImageIds = ref([])
const pendingShotFrameKeys = ref([])
const pendingVideoIds = ref([])
const pendingComposeIds = ref([])
const failedVideoMessages = ref({})
const failedComposeMessages = ref({})
const imageViewer = ref({ open: false, src: '', title: '' })
const GENERATION_MODE_KEY = 'huobao:generation-mode'
const generationMode = ref('api')
const isManualGeneration = computed(() => generationMode.value === 'manual')
const manualDialog = reactive({
  open: false,
  title: '',
  kind: 'uploads',
  accept: '',
  prompt: '',
  url: '',
  file: null,
  onSave: null,
})

function configLabel(config) {
  if (!config) return '설정 없음'
  let modelName = ''
  try { const m = JSON.parse(config.model || '[]'); modelName = Array.isArray(m) ? (m[0] || '') : (m || '') } catch { modelName = config.model || '' }
  return modelName ? `${config.name} · ${modelName} (${config.provider})` : `${config.name} (${config.provider})`
}

function isPendingCharImage(id) {
  return pendingCharImageIds.value.includes(id)
}

function openImageViewer(src, title = '') {
  if (!src) return
  imageViewer.value = { open: true, src, title }
}

function closeImageViewer() {
  imageViewer.value = { open: false, src: '', title: '' }
}

function handleImageViewerKeydown(event) {
  if (event.key === 'Escape' && imageViewer.value.open) closeImageViewer()
}

onMounted(() => {
  generationMode.value = localStorage.getItem(GENERATION_MODE_KEY) || 'api'
  window.addEventListener('keydown', handleImageViewerKeydown)
  window.addEventListener('storage', handleGenerationModeStorage)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleImageViewerKeydown)
  window.removeEventListener('storage', handleGenerationModeStorage)
})

function handleGenerationModeStorage(event) {
  if (event.key === GENERATION_MODE_KEY) generationMode.value = event.newValue || 'api'
}

function isPendingSceneImage(id) {
  return pendingSceneImageIds.value.includes(id)
}

function framePendingKey(id, frameType) {
  return `${id}:${frameType}`
}

function isPendingShotFrame(id, frameType) {
  return pendingShotFrameKeys.value.includes(framePendingKey(id, frameType))
}

function isPendingVideo(id) {
  return pendingVideoIds.value.includes(id)
}

function videoFailMessage(id) {
  return failedVideoMessages.value[id] || ''
}

function isPendingCompose(id) {
  return pendingComposeIds.value.includes(id)
}

function composeFailMessage(id) {
  return failedComposeMessages.value[id] || ''
}

function isNarratorCharacter(char) {
  const text = `${char?.name || ''} ${char?.role || ''}`.toLowerCase()
  return text.includes('내레이션') || text.includes('narrator') || text.includes('오프 보이스')
}

const visualChars = computed(() => chars.value.filter(c => !isNarratorCharacter(c)))

const lockedImageConfigId = computed(() => episode.value?.image_config_id || episode.value?.imageConfigId || null)
const lockedVideoConfigId = computed(() => episode.value?.video_config_id || episode.value?.videoConfigId || null)
const lockedAudioConfigId = computed(() => episode.value?.audio_config_id || episode.value?.audioConfigId || null)
const lockedAudioProvider = computed(() => audioConfigs.value.find(c => c.id === lockedAudioConfigId.value)?.provider || '')
const lockedImageConfigLabel = computed(() => configLabel(imageConfigs.value.find(c => c.id === lockedImageConfigId.value)))
const lockedVideoConfigLabel = computed(() => configLabel(videoConfigs.value.find(c => c.id === lockedVideoConfigId.value)))
const lockedAudioConfigLabel = computed(() => configLabel(audioConfigs.value.find(c => c.id === lockedAudioConfigId.value)))

// Grid tool state
const gridDialog = ref(false)
const gridStep = ref(0)
const gridLayout = ref('3x3')
const gridMode = ref('first_frame')
const gridSelected = ref([])
const gridSingleTarget = ref(null)
const gridGenId = ref(null)
const gridImagePath = ref('')
const gridStatusText = ref('')
const gridActualLayout = ref({ rows: 3, cols: 3 })
const gridRecoveredAt = ref('')
const gridRecoveredMode = ref('')
const gridPromptText = ref('')
const gridCellPrompts = ref([])
const gridPromptSource = ref('')
const gridPromptLoading = ref(false)
const gridPromptStatus = ref('')
const gridAssignmentsState = ref([])
const gridActiveShotIds = ref([])
const gridHistory = ref([])
const showAllGridHistory = ref(false)
const activeGridCell = ref(0)
const gridAssignmentPage = ref(0)
const gridStorageKey = computed(() => `huobao:grid:${dramaId}:${epId.value || episodeNumber}`)

const gridModes = [
  { id: 'first_frame', label: '첫 프레임', desc: '각 칸 = 한 샷의 첫 프레임' },
  { id: 'first_last', label: '첫/끝 프레임', desc: '각 샷은 한 줄 사용: 왼쪽 첫 프레임, 오른쪽 끝 프레임' },
  { id: 'multi_ref', label: '다중 참조', desc: '모든 칸 = 같은 샷의 참조 이미지' },
]

const gridLayoutShape = computed(() => {
  const [rows, cols] = String(gridLayout.value || '3x3').split('x').map(Number)
  return {
    rows: rows || 3,
    cols: cols || 3,
  }
})
const gridTotalCells = computed(() => {
  return gridLayoutShape.value.rows * gridLayoutShape.value.cols
})

const gridCanStart = computed(() => {
  if (gridMode.value === 'multi_ref') return !!gridSingleTarget.value
  return gridSelected.value.length > 0
})

const gridSummary = computed(() => {
  if (gridMode.value === 'multi_ref') {
    const idx = sbs.value.findIndex(s => s.id === gridSingleTarget.value) + 1
    return gridSingleTarget.value ? `${gridLayoutShape.value.rows}x${gridLayoutShape.value.cols} 참조 이미지 → 샷 #${idx}` : '샷 하나를 선택하세요'
  }
  if (!gridSelected.value.length) return '샷을 선택하세요'
  const count = gridSelected.value.length
  if (gridMode.value === 'first_last') {
    const { rows, cols } = gridLayoutShape.value
    return `${count}개 샷 → ${rows}x${cols} 그리드(첫/끝 프레임 흐름으로 생성한 뒤 분할 후 직접 배정)`
  }
  const { rows, cols } = gridLayoutShape.value
  const cells = rows * cols
  return `${count} 개 샷 → ${rows}x${cols} 그리드(먼저 그리드 이미지를 생성한 뒤 분할 후 직접 배정)`
})

function createGridAssignments() {
  return Array.from({ length: gridActualLayout.value.rows * gridActualLayout.value.cols }, () => ({
    storyboard_id: null,
    frame_type: 'first_frame',
  }))
}

const gridAssignments = computed(() => gridAssignmentsState.value)
const gridAssignableShotIds = computed(() => {
  const assignedIds = [...new Set(gridAssignments.value.map(item => item?.storyboard_id).filter(Boolean))]
  const ids = Array.isArray(gridActiveShotIds.value) && gridActiveShotIds.value.length
    ? gridActiveShotIds.value
    : assignedIds.length
      ? assignedIds
    : gridMode.value === 'multi_ref'
      ? (gridSingleTarget.value ? [gridSingleTarget.value] : [])
      : gridSelected.value.length
        ? [...gridSelected.value]
        : sbs.value.map(s => s.id)
  return ids.filter(id => sbs.value.some(s => s.id === id))
})
const gridAssignmentShotOptions = computed(() => [
  { label: '미배정', value: null },
  ...gridAssignableShotIds.value.map((id) => {
    const index = sbs.value.findIndex(s => s.id === id) + 1
    const sb = sbs.value.find(s => s.id === id)
    return {
      label: `#${String(index).padStart(2, '0')} ${sb?.title || sb?.description || '샷'}`,
      value: id,
    }
  }),
])
const gridFrameTypeOptions = computed(() => {
  return [
    { label: '첫 프레임', value: 'first_frame' },
    { label: '끝 프레임', value: 'last_frame' },
    { label: '참조 이미지', value: 'reference' },
  ]
})
const gridAssignedCount = computed(() => gridAssignments.value.filter(item => !!item.storyboard_id).length)
const gridAssignmentPageSize = computed(() => {
  if (gridAssignments.value.length >= 25) return 8
  if (gridAssignments.value.length >= 16) return 10
  if (gridAssignments.value.length >= 9) return 9
  return Math.max(1, gridAssignments.value.length || 1)
})
const gridAssignmentTotalPages = computed(() => Math.max(1, Math.ceil(gridAssignments.value.length / gridAssignmentPageSize.value)))
const gridAssignmentPageStart = computed(() => gridAssignmentPage.value * gridAssignmentPageSize.value)
const gridAssignmentPageEnd = computed(() => Math.min(gridAssignments.value.length, gridAssignmentPageStart.value + gridAssignmentPageSize.value))
const pagedGridAssignments = computed(() => {
  return gridAssignments.value
    .slice(gridAssignmentPageStart.value, gridAssignmentPageEnd.value)
    .map((assignment, offset) => ({
      assignment,
      index: gridAssignmentPageStart.value + offset,
    }))
})

function resetGridAssignments() {
  gridAssignmentsState.value = createGridAssignments()
  activeGridCell.value = 0
  gridAssignmentPage.value = 0
}

function gridCellLabel(a) {
  if (!a?.storyboard_id) return '미배정'
  const idx = sbs.value.findIndex(s => s.id === a.storyboard_id) + 1
  const suffix = { first_frame: '첫', last_frame: '끝', reference: '참조' }[a.frame_type] || ''
  return `#${idx}${suffix ? ` ${suffix}` : ''}`
}

function gridCellTitle(id) {
  if (!id) return '미배정'
  const idx = sbs.value.findIndex(s => s.id === id) + 1
  const sb = sbs.value.find(s => s.id === id)
  return `#${String(idx).padStart(2, '0')} ${sb?.title || sb?.description || '샷'}`
}

function updateGridAssignment(index, field, value) {
  const next = [...gridAssignmentsState.value]
  next[index] = { ...next[index], [field]: value }
  gridAssignmentsState.value = next
  activeGridCell.value = index
  if (gridImagePath.value) persistGridImagePath(gridImagePath.value)
}

function focusGridCell(index) {
  activeGridCell.value = index
  gridAssignmentPage.value = Math.floor(index / gridAssignmentPageSize.value)
}

const gridOverlayStyle = computed(() => {
  const { rows, cols } = gridActualLayout.value
  return { 'grid-template-columns': `repeat(${cols}, 1fr)`, 'grid-template-rows': `repeat(${rows}, 1fr)` }
})

const gridAutoLayout = computed(() => {
  return gridLayoutShape.value
})

const gridBlankStyle = computed(() => {
  const { rows, cols } = gridAutoLayout.value
  return { 'grid-template-columns': `repeat(${cols}, 1fr)`, 'grid-template-rows': `repeat(${rows}, 1fr)` }
})

// Production step helpers
function prodStepDone(id) {
  if (id === 'chars') return !visualCharTotal.value || charImgCount.value === visualCharTotal.value
  if (id === 'scenes') return !!scenes.value.length && sceneImgCount.value === scenes.value.length
  if (id === 'dubbing') return !!sbs.value.length && (!ttsEligibleCount.value || ttsGeneratedCount.value === ttsEligibleCount.value)
  if (id === 'shots') return !!sbs.value.length && shotImgCount.value === sbs.value.length
  if (id === 'videos') return !!sbs.value.length && shotVidCount.value === sbs.value.length
  if (id === 'compose') return !!sbs.value.length && composedCount.value === sbs.value.length
  return false
}
const canExport = computed(() => !!sbs.value.length && composedCount.value === sbs.value.length)
function goNextProd() {
  if (prodTabIdx.value < prodTabDefs.value.length - 1) {
    prodTabIdx.value++
  } else {
    panel.value = 'export'
  }
}

// Script step navigation
const stepLabels = ['원본 내용', 'AI 수정', '추출', '음색', '스토리보드']
const prevStepLabel = computed(() => scriptStep.value > 0 ? stepLabels[scriptStep.value - 1] : '')
const nextStepLabel = computed(() => {
  if (scriptStep.value === 4) return '제작으로 이동'
  return stepLabels[scriptStep.value + 1] || ''
})
const canGoNext = computed(() => {
  if (scriptStep.value === 0) return !!localRaw.value.trim()
  if (scriptStep.value === 1) return !!localScript.value.trim() || !!scriptContent.value
  if (scriptStep.value === 2) return chars.value.length > 0
  if (scriptStep.value === 3) return charsVoiced.value > 0
  if (scriptStep.value === 4) return sbs.value.length > 0
  return false
})
function goPrevStep() { if (scriptStep.value > 0) scriptStep.value-- }
function goNextStep() {
  if (scriptStep.value === 0 && localRaw.value.trim()) { saveRaw() }
  if (scriptStep.value === 1 && localScript.value.trim()) { saveScr() }
  if (scriptStep.value === 4) { panel.value = 'production'; return }
  if (canGoNext.value) scriptStep.value++
}

function gridSelectAll() {
  if (gridSelected.value.length === sbs.value.length) gridSelected.value = []
  else gridSelected.value = sbs.value.map(s => s.id)
}

function openGridTool() {
  gridStep.value = 0
  gridSelected.value = []
  gridSingleTarget.value = null
  gridActiveShotIds.value = []
  gridPromptText.value = ''
  gridCellPrompts.value = []
  gridPromptSource.value = ''
  gridPromptStatus.value = ''
  gridAssignmentsState.value = []
  gridDialog.value = true
}

function persistGridImagePath(value) {
  if (typeof window === 'undefined') return
  if (!value) {
    window.localStorage.removeItem(gridStorageKey.value)
    return
  }
  const current = restoreGridState() || {}
  const entries = current.entries || {}
  entries[value] = {
    generationId: gridGenId.value,
    layout: gridActualLayout.value,
    shotIds: gridActiveShotIds.value,
    assignments: gridAssignmentsState.value,
    recoveredAt: gridRecoveredAt.value,
    recoveredMode: gridRecoveredMode.value,
  }
  const payload = {
    activeImagePath: value,
    entries,
  }
  window.localStorage.setItem(gridStorageKey.value, JSON.stringify(payload))
}

function restoreGridState() {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(gridStorageKey.value)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return { activeImagePath: raw, entries: { [raw]: {} } }
  }
}

function applyGridState(imagePath, meta = {}) {
  gridImagePath.value = imagePath || ''
  gridGenId.value = meta.generationId || meta.id || null
  if (meta.layout?.rows && meta.layout?.cols) gridActualLayout.value = meta.layout
  if (Array.isArray(meta.shotIds)) gridActiveShotIds.value = meta.shotIds
  else gridActiveShotIds.value = []
  if (Array.isArray(meta.assignments)) gridAssignmentsState.value = meta.assignments
  else gridAssignmentsState.value = []
  gridRecoveredAt.value = meta.recoveredAt || meta.createdAtLabel || ''
  gridRecoveredMode.value = meta.recoveredMode || meta.modeLabel || ''
}

function selectGridHistory(item) {
  const cached = restoreGridState()
  const cachedEntry = cached?.entries?.[item.localPath] || {}
  applyGridState(item.localPath, {
    ...item,
    ...cachedEntry,
    generationId: cachedEntry.generationId || item.id,
    recoveredAt: cachedEntry.recoveredAt || item.createdAtLabel,
    recoveredMode: cachedEntry.recoveredMode || item.modeLabel,
  })
  if (!gridAssignmentsState.value.length) resetGridAssignments()
  persistGridImagePath(item.localPath)
}

function reopenGridPreview() {
  if (!gridImagePath.value) {
    openGridTool()
    return
  }
  gridDialog.value = true
  if (!gridAssignmentsState.value.length) resetGridAssignments()
  gridStep.value = 3
}

function parseGridLayoutFromFrameType(value) {
  const match = String(value || '').match(/grid_[^_]+_(\d+)x(\d+)$/)
  if (!match) return null
  return { rows: Number(match[1]) || 3, cols: Number(match[2]) || 3 }
}

function continueGridSplit() {
  if (!gridImagePath.value) {
    toast.warning('계속 자를 수 있는 그리드 이미지가 없습니다')
    return
  }
  if (!gridAssignmentsState.value.length) resetGridAssignments()
  gridDialog.value = true
  gridStep.value = 3
}

function getGridPromptShotIds() {
  if (gridMode.value === 'multi_ref') return gridSingleTarget.value ? [gridSingleTarget.value] : []
  if (gridMode.value === 'first_last') return [...gridSelected.value]
  return gridSelected.value.slice(0, gridTotalCells.value)
}

async function generateGridPrompt() {
  if (!gridCanStart.value) {
    toast.warning('먼저 샷을 선택하세요')
    return
  }
  gridPromptLoading.value = true
  gridPromptStatus.value = 'AI로 그리드 프롬프트를 생성하는 중...'
  gridPromptText.value = ''
  gridCellPrompts.value = []
  gridPromptSource.value = ''
  try {
    const shotIds = getGridPromptShotIds()
    const { rows, cols } = gridAutoLayout.value

    const res = await gridAPI.prompt({
      storyboard_ids: shotIds,
      drama_id: dramaId,
      episode_id: epId.value,
      rows,
      cols,
      mode: gridMode.value,
    })

    gridPromptText.value = res?.grid_prompt || ''
    gridCellPrompts.value = Array.isArray(res?.cell_prompts) ? res.cell_prompts : []
    gridPromptSource.value = res?.source || ''

    if (gridPromptText.value) {
      resetGridAssignments()
      gridPromptStatus.value = gridPromptSource.value === 'agent' ? 'AI 프롬프트가 생성되었습니다' : '템플릿 프롬프트를 사용했습니다'
      gridStep.value = 1
    } else {
      gridPromptStatus.value = ''
      toast.error('프롬프트 생성 실패')
    }
  } catch (e) {
    gridPromptStatus.value = ''
    toast.error(e?.message || '프롬프트 생성 실패')
  } finally {
    gridPromptLoading.value = false
  }
}

async function startGridGen() {
  let rows, cols, ids
  if (gridMode.value === 'multi_ref') {
    rows = gridAutoLayout.value.rows; cols = gridAutoLayout.value.cols; ids = [gridSingleTarget.value]
  } else {
    rows = gridAutoLayout.value.rows; cols = gridAutoLayout.value.cols; ids = gridSelected.value.slice(0, gridTotalCells.value)
    if (gridMode.value === 'first_last') ids = [...gridSelected.value]
  }
  gridActiveShotIds.value = ids.filter(Boolean)
  gridActualLayout.value = { rows, cols }
  if (!gridAssignmentsState.value.length) resetGridAssignments()
  if (isManualGeneration.value) {
    const prompt = gridPromptText.value || ''
    await copyPrompt(prompt, '그리드 이미지 프롬프트')
    openManualDialog({
      title: '그리드 이미지 수동 등록',
      kind: 'images',
      accept: 'image/*',
      prompt,
      onSave: async (path) => {
        const modePart = gridMode.value || 'manual'
        await registerManualImage({
          path,
          prompt,
          frameType: `grid_${modePart}_${rows}x${cols}`,
        })
        gridImagePath.value = path
        gridActualLayout.value = { rows, cols }
        persistGridImagePath(path)
        gridStep.value = 3
      },
    })
    return
  }
  gridStep.value = 2
  gridStatusText.value = '생성 요청 제출 중...'
  try {
    const res = await gridAPI.generate({
      storyboard_ids: ids,
      drama_id: dramaId,
      rows,
      cols,
      mode: gridMode.value,
      custom_prompt: gridPromptText.value || undefined,
    })
    gridGenId.value = res.image_generation_id
    gridActualLayout.value = res.grid || { rows, cols }
    gridStatusText.value = '이미지 생성 대기 중...'
    pollGridStatus()
  } catch (e) {
    toast.error(e.message)
    gridStep.value = 0
  }
}

async function pollGridStatus() {
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 3000))
    try {
      const res = await gridAPI.status(gridGenId.value)
      gridStatusText.value = `상태: ${res.status}`
      if (res.status === 'completed' && res.local_path) {
        gridImagePath.value = res.local_path
        gridGenId.value = gridGenId.value || res.id || null
        persistGridImagePath(res.local_path)
        gridStep.value = 3
        return
      }
      if (res.status === 'failed') {
        toast.error(res.error_msg || '생성 실패')
        gridStep.value = 0
        return
      }
    } catch {}
  }
  toast.error('생성 시간 초과'); gridStep.value = 0
}

async function loadLatestGridImage() {
  try {
    const rows = await imageAPI.list({ drama_id: dramaId })
    const list = Array.isArray(rows) ? rows : []
    const grids = list
      .filter((row) => row?.status === 'completed' && String(row?.frame_type || row?.frameType || '').startsWith('grid_') && (row?.local_path || row?.localPath))
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))
      .map((row) => {
        const frameType = String(row?.frame_type || row?.frameType || '')
        const parsedLayout = parseGridLayoutFromFrameType(frameType) || { rows: 3, cols: 3 }
        return {
          id: row.id,
          localPath: row?.local_path || row?.localPath || '',
          layout: parsedLayout,
          modeLabel: frameType.replace(/^grid_/, '').replace(/_/g, ' · '),
          createdAtLabel: row?.created_at || row?.createdAt || '',
        }
      })

    gridHistory.value = grids

    const cached = restoreGridState()
    const preferredPath = cached?.activeImagePath && grids.some(item => item.localPath === cached.activeImagePath)
      ? cached.activeImagePath
      : grids[0]?.localPath
    const current = grids.find(item => item.localPath === preferredPath)
    if (current) {
      const cachedEntry = cached?.entries?.[current.localPath] || {}
      applyGridState(current.localPath, {
        ...current,
        ...cachedEntry,
        generationId: cachedEntry.generationId || current.id,
        recoveredAt: cachedEntry.recoveredAt || current.createdAtLabel,
        recoveredMode: cachedEntry.recoveredMode || current.modeLabel,
      })
      if (!gridAssignmentsState.value.length) resetGridAssignments()
      persistGridImagePath(current.localPath)
      return
    }
  } catch {}

  const cached = restoreGridState()
  if (cached?.activeImagePath) {
    const cachedEntry = cached?.entries?.[cached.activeImagePath] || {}
    applyGridState(cached.activeImagePath, {
      ...cachedEntry,
      recoveredAt: cachedEntry.recoveredAt || '',
      recoveredMode: cachedEntry.recoveredMode || '',
    })
  }
}

async function doGridSplit() {
  const { rows, cols } = gridActualLayout.value
  try {
    const assignments = gridAssignments.value
      .filter(item => !!item.storyboard_id)
      .map(item => ({ storyboard_id: item.storyboard_id, frame_type: item.frame_type }))
    if (!assignments.length) {
      toast.warning('최소 한 칸을 배정하세요')
      return
    }
    await gridAPI.split({ image_generation_id: gridGenId.value, rows, cols, assignments })
    persistGridImagePath(gridImagePath.value)
    gridStep.value = 4
    toast.success('분할 배정 완료')
  } catch (e) {
    toast.error(e.message)
  }
}

const charImgCount = computed(() => visualChars.value.filter(c => c.image_url || c.imageUrl).length)
const sceneImgCount = computed(() => scenes.value.filter(s => s.image_url || s.imageUrl).length)
const ttsEligibleCount = computed(() => sbs.value.filter(s => hasDialogue(s)).length)
const ttsGeneratedCount = computed(() => sbs.value.filter(s => hasDialogue(s) && hasTTS(s)).length)
const shotImgCount = computed(() => sbs.value.filter(s => s.first_frame_image || s.firstFrameImage || s.last_frame_image || s.lastFrameImage || s.composed_image || s.composedImage).length)
const shotVidCount = computed(() => sbs.value.filter(s => s.video_url || s.videoUrl).length)
const visualCharTotal = computed(() => visualChars.value.length)

const prodTabDefs = computed(() => [
  { id: 'chars', label: '캐릭터 이미지', icon: Users, badge: visualCharTotal.value ? `${charImgCount.value}/${visualCharTotal.value}` : '' },
  { id: 'scenes', label: '장면 이미지', icon: MapPin, badge: sceneImgCount.value ? `${sceneImgCount.value}/${scenes.value.length}` : '' },
  { id: 'dubbing', label: '더빙 생성', icon: Mic2, badge: '' },
  { id: 'shots', label: '샷 이미지', icon: ImageIcon, badge: shotImgCount.value ? `${shotImgCount.value}/${sbs.value.length}` : '' },
  { id: 'videos', label: '영상 생성', icon: Video, badge: shotVidCount.value ? `${shotVidCount.value}/${sbs.value.length}` : '' },
  { id: 'compose', label: '영상 합성', icon: Layers, badge: composedCount.value ? `${composedCount.value}/${sbs.value.length}` : '' },
])

const mainStageDefs = [
  { id: 'script', label: '극본', desc: '내용 수정 및 정리', icon: FileText },
  { id: 'assets', label: '자산', desc: '캐릭터, 장면, 음색', icon: FolderKanban },
  { id: 'storyboard', label: '스토리보드', desc: '샷 제작 및 합성', icon: Clapperboard },
  { id: 'export', label: '내보내기', desc: '이어붙이기와 완성본 출력', icon: Download },
]

const sidebarSections = computed(() => ([
  {
    id: 'script',
    label: '극본',
    items: [
      { key: 'script:raw', label: '원본 내용', desc: '', icon: FileText, done: !!rawContent.value },
      { key: 'script:rewrite', label: 'AI 수정', desc: '', icon: FileText, done: !!scriptContent.value },
      { key: 'script:extract', label: '추출', desc: '', icon: Users, done: !!chars.value.length },
      { key: 'script:voice', label: '음색', desc: '', icon: Mic2, done: !!chars.value.length && charsVoiced.value === chars.value.length },
      { key: 'script:storyboard', label: '스토리보드', desc: '', icon: Clapperboard, done: !!sbs.value.length },
    ],
  },
  {
    id: 'production',
    label: '제작',
    items: [
      { key: 'prod:chars', label: '캐릭터 이미지', desc: '', icon: Users, done: prodStepDone('chars') },
      { key: 'prod:scenes', label: '장면 이미지', desc: '', icon: MapPin, done: prodStepDone('scenes') },
      { key: 'prod:dubbing', label: '더빙 생성', desc: '', icon: Mic2, done: prodStepDone('dubbing') },
      { key: 'prod:shots', label: '샷 이미지', desc: '', icon: ImageIcon, done: prodStepDone('shots') },
      { key: 'prod:videos', label: '영상 생성', desc: '', icon: Video, done: prodStepDone('videos') },
      { key: 'prod:compose', label: '영상 합성', desc: '', icon: Layers, done: prodStepDone('compose') },
    ],
  },
  {
    id: 'export',
    label: '내보내기',
    items: [
      { key: 'export:merge', label: '이어붙여 내보내기', desc: '', icon: Download, done: !!mergeUrl.value },
    ],
  },
]))

const activeMainStage = computed(() => {
  if (panel.value === 'export') return 'export'
  if (panel.value === 'production') {
    return ['chars', 'scenes'].includes(prodTab.value) ? 'assets' : 'storyboard'
  }
  if (scriptStep.value <= 1) return 'script'
  if (scriptStep.value <= 3) return 'assets'
  return 'storyboard'
})

function mainStageDone(stageId) {
  if (stageId === 'script') return !!scriptContent.value
  if (stageId === 'assets') {
    const charsReady = !!chars.value.length && charsVoiced.value === chars.value.length
    const charImagesReady = !visualCharTotal.value || charImgCount.value === visualCharTotal.value
    const sceneImagesReady = !scenes.value.length || sceneImgCount.value === scenes.value.length
    return charsReady && charImagesReady && sceneImagesReady
  }
  if (stageId === 'storyboard') {
    if (!sbs.value.length) return false
    const ttsReady = !ttsEligibleCount.value || ttsGeneratedCount.value === ttsEligibleCount.value
    return ttsReady
      && shotImgCount.value === sbs.value.length
      && shotVidCount.value === sbs.value.length
      && composedCount.value === sbs.value.length
  }
  if (stageId === 'export') return !!mergeUrl.value
  return false
}

function goMainStage(stageId) {
  if (stageId === 'script') {
    panel.value = 'script'
    scriptStep.value = Math.min(scriptStep.value, 1)
    return
  }
  if (stageId === 'assets') {
    const hasAssetWorkspace = !!visualCharTotal.value || !!scenes.value.length
    const hasPendingAssetGeneration = (visualCharTotal.value && charImgCount.value < visualCharTotal.value)
      || (scenes.value.length && sceneImgCount.value < scenes.value.length)
    if (panel.value === 'production' || hasPendingAssetGeneration || hasAssetWorkspace) {
      panel.value = 'production'
      prodTab.value = ['chars', 'scenes'].includes(prodTab.value) ? prodTab.value : 'chars'
      return
    }
    panel.value = 'script'
    scriptStep.value = chars.value.length ? 3 : 2
    return
  }
  if (stageId === 'storyboard') {
    if (panel.value === 'production') {
      prodTab.value = ['dubbing', 'shots', 'videos', 'compose'].includes(prodTab.value) ? prodTab.value : 'dubbing'
      return
    }
    panel.value = 'script'
    scriptStep.value = 4
    return
  }
  panel.value = 'export'
}

const activeSubSteps = computed(() => {
  if (activeMainStage.value === 'script') {
    return [
      { key: 'script:raw', label: '원본 내용', done: !!rawContent.value },
      { key: 'script:rewrite', label: 'AI 수정', done: !!scriptContent.value },
    ]
  }
  if (activeMainStage.value === 'assets') {
    return [
      { key: 'script:extract', label: '추출캐릭터장면', done: !!chars.value.length },
      { key: 'script:voice', label: '음색 배정', done: !!chars.value.length && charsVoiced.value === chars.value.length },
      { key: 'prod:chars', label: '캐릭터 이미지', done: !visualCharTotal.value || charImgCount.value === visualCharTotal.value },
      { key: 'prod:scenes', label: '장면 이미지', done: !scenes.value.length || sceneImgCount.value === scenes.value.length },
    ]
  }
  if (activeMainStage.value === 'storyboard') {
    return [
      { key: 'script:storyboard', label: '스토리보드 분해', done: !!sbs.value.length },
      { key: 'prod:dubbing', label: '더빙 생성', done: !ttsEligibleCount.value || ttsGeneratedCount.value === ttsEligibleCount.value },
      { key: 'prod:shots', label: '샷 이미지', done: !!sbs.value.length && shotImgCount.value === sbs.value.length },
      { key: 'prod:videos', label: '영상 생성', done: !!sbs.value.length && shotVidCount.value === sbs.value.length },
      { key: 'prod:compose', label: '영상 합성', done: !!sbs.value.length && composedCount.value === sbs.value.length },
    ]
  }
  return [
    { key: 'export:merge', label: '이어붙여 내보내기', done: !!mergeUrl.value },
  ]
})

const activeSubStepKey = computed(() => {
  if (panel.value === 'script') {
    if (scriptStep.value === 0) return 'script:raw'
    if (scriptStep.value === 1) return 'script:rewrite'
    if (scriptStep.value === 2) return 'script:extract'
    if (scriptStep.value === 3) return 'script:voice'
    return 'script:storyboard'
  }
  if (panel.value === 'production') return `prod:${prodTab.value}`
  return 'export:merge'
})

const sidebarJumpSteps = computed(() => {
  const section = sidebarSections.value.find((item) => item.items.some(step => step.key === activeSubStepKey.value))
  return section?.items || []
})

const bubbleSteps = computed(() => {
  if (panel.value === 'script') {
    return [
      { key: 'script:raw', label: '원본 내용', done: !!rawContent.value },
      { key: 'script:rewrite', label: 'AI 수정', done: !!scriptContent.value },
      { key: 'script:extract', label: '추출', done: !!chars.value.length },
      { key: 'script:voice', label: '음색', done: !!chars.value.length && charsVoiced.value === chars.value.length },
      { key: 'script:storyboard', label: '스토리보드', done: !!sbs.value.length },
    ]
  }
  if (panel.value === 'production') {
    return prodTabDefs.value.map(step => ({
      key: `prod:${step.id}`,
      label: step.label,
      done: prodStepDone(step.id),
    }))
  }
  return []
})

const activeBubbleKey = computed(() => {
  if (panel.value === 'script') return activeSubStepKey.value
  if (panel.value === 'production') return `prod:${prodTab.value}`
  return ''
})

const showBottomBubble = computed(() => panel.value === 'script' || panel.value === 'production')

function goSubStep(key) {
  if (key.startsWith('script:')) {
    panel.value = 'script'
    const stepMap = {
      'script:raw': 0,
      'script:rewrite': 1,
      'script:extract': 2,
      'script:voice': 3,
      'script:storyboard': 4,
    }
    scriptStep.value = stepMap[key] ?? 0
    return
  }
  if (key.startsWith('prod:')) {
    panel.value = 'production'
    prodTab.value = key.replace('prod:', '')
    return
  }
  panel.value = 'export'
}

const pipelineProgress = computed(() => {
  let p = 0
  if (rawContent.value) p++
  if (scriptContent.value) p++
  if (chars.value.length) p++
  if (charsVoiced.value) p++
  if (sbs.value.length) p++
  if (sbs.value.length && (!ttsEligibleCount.value || ttsGeneratedCount.value === ttsEligibleCount.value)) p++
  if (sbs.value.some(s => s.composed_image || s.composedImage)) p++
  if (sbs.value.some(s => s.video_url || s.videoUrl)) p++
  if (sbs.value.length && composedCount.value === sbs.value.length) p++
  if (mergeUrl.value) p++
  return p
})

const currentStageLabel = computed(() => {
  if (panel.value === 'script') return `극본 단계 · ${stepLabels[scriptStep.value]}`
  if (panel.value === 'production') return `제작 단계 · ${prodTabDefs.value[prodTabIdx.value]?.label || '제작'}`
  return mergeUrl.value ? '내보내기 단계 · 완성본 생성됨' : '내보내기 단계 · 이어붙이기 대기'
})

const currentMainStageLabel = computed(() => {
  const current = mainStageDefs.find(stage => stage.id === activeMainStage.value)
  return current?.label || '작업대'
})

const currentSubStageLabel = computed(() => {
  const current = activeSubSteps.value.find(step => step.key === activeSubStepKey.value)
  return current?.label || currentStageLabel.value
})

function updateCharVoice(charId, voiceId) {
  characterAPI.update(charId, { voice_style: voiceId, voice_provider: lockedAudioProvider.value || undefined })
  const c = chars.value.find(ch => ch.id === charId)
  if (c) {
    c.voice_style = voiceId
    c.voiceStyle = voiceId
    c.voice_provider = lockedAudioProvider.value || ''
    c.voiceProvider = lockedAudioProvider.value || ''
    c.voice_sample_url = ''
    c.voiceSampleUrl = ''
  }
}
function getVoiceProfile(voiceId) {
  return voiceProfiles.value.find(v => v.id === voiceId) || null
}
const totalDuration = computed(() => sbs.value.reduce((s, sb) => s + (sb.duration || 10), 0))

const selectedSb = ref(null)
const shotTypes = [
  '초원경', '원경', '풀샷', '미디엄샷', '미디엄 클로즈업', '클로즈샷', '클로즈업', '익스트림 클로즈업',
  '투샷', '쓰리샷', '군상', '뒷모습', '측면', '정면', '하이앵글', '로우앵글',
  '오버숄더', '주관 시점', '항공샷', '무빙샷',
]
const shotAngles = ['아이레벨', '로우앵글', '하이앵글', '측면 촬영', '후면 촬영', '사선 측면', '주관 시점', '오버숄더']
const shotMovements = ['고정', '푸시인', '풀아웃', '팬', '트래킹', '팔로우', '틸트/크레인', '핸드헬드', '오비트']

function updateField(sb, field, value) {
  const current = sb[field] ?? sb[toCamel(field)]
  if (current === value) return
  sb[field] = value
  const camelField = toCamel(field)
  if (camelField !== field) sb[camelField] = value
  storyboardAPI.update(sb.id, { [field]: value })
}

function toCamel(field) {
  return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function getStoryboardCharacterIds(sb) {
  return sb?.character_ids || sb?.characterIds || []
}

function getStoryboardCharacterNames(sb) {
  const ids = getStoryboardCharacterIds(sb)
  return chars.value.filter(char => ids.includes(char.id)).map(char => char.name)
}

function isStoryboardCharacterSelected(sb, charId) {
  return getStoryboardCharacterIds(sb).includes(charId)
}

function toggleStoryboardCharacter(sb, charId) {
  const currentIds = getStoryboardCharacterIds(sb)
  const nextIds = currentIds.includes(charId)
    ? currentIds.filter(id => id !== charId)
    : [...currentIds, charId]
  updateField(sb, 'character_ids', nextIds)
}

function getSceneName(sb) {
  const sceneId = sb?.scene_id || sb?.sceneId
  if (!sceneId) return '연결된 장면 없음'
  const scene = scenes.value.find(s => s.id === sceneId)
  return scene ? `${scene.location} · ${scene.time || '시간 미설정'}` : `장면 #${sceneId}`
}

async function deleteShot(sb) {
  if (!confirm('이 샷을 삭제할까요?')) return
  const idx = sbs.value.indexOf(sb)
  await storyboardAPI.del(sb.id)
  await refresh()
  if (sbs.value.length) selectedSb.value = sbs.value[Math.min(idx, sbs.value.length - 1)]
  else selectedSb.value = null
}

const scriptSteps = computed(() => {
  const hasScript = !!scriptContent.value
  const hasChars = chars.value.length > 0 && hasScript
  const hasVoice = charsVoiced.value > 0 && hasChars
  const hasSbs = sbs.value.length > 0
  return [
    { label: '원본 내용', state: rawContent.value ? 'done' : 'active', spinning: false },
    { label: 'AI 수정', state: hasScript ? 'done' : (rawContent.value ? 'active' : ''), spinning: rt.value === 'script_rewriter' },
    { label: '추출', state: hasChars ? 'done' : (hasScript ? 'active' : ''), spinning: rt.value === 'extractor' },
    { label: '음색', state: hasVoice ? 'done' : (hasChars ? 'active' : ''), spinning: rt.value === 'voice_assigner' },
    { label: '스토리보드', state: hasSbs ? 'done' : (hasVoice ? 'active' : ''), spinning: rt.value === 'storyboard_breaker' },
  ]
})

watch(rawContent, v => { localRaw.value = v }, { immediate: true })
watch(scriptContent, v => { localScript.value = v }, { immediate: true })

async function refresh() {
  try {
    drama.value = await dramaAPI.get(dramaId)
    const ep = drama.value.episodes?.find(e => (e.episode_number || e.episodeNumber) === episodeNumber)
    if (ep) {
      episode.value = ep
      try { chars.value = await episodeAPI.characters(ep.id) } catch { chars.value = [] }
      try { scenes.value = await episodeAPI.scenes(ep.id) } catch { scenes.value = [] }
      sbs.value = await episodeAPI.storyboards(ep.id)
      if (sbs.value.length && !selectedSb.value) selectedSb.value = sbs.value[0]

      const epHasContent = !!(episode.value?.content)
      const epHasScript = !!(episode.value?.script_content || episode.value?.scriptContent)
      const epHasSbs = sbs.value.length > 0

      if (epHasSbs) scriptStep.value = 4
      else if (epHasScript && chars.value.some(c => c.voice_style || c.voiceStyle)) scriptStep.value = 3
      else if (epHasScript && chars.value.length) scriptStep.value = 2
      else if (epHasScript || epHasContent) scriptStep.value = 1
      else scriptStep.value = 0
      await loadLatestGridImage()
    }
  } catch (e) {
    toast.error(e.message)
  }
  try { mergeData.value = await mergeAPI.status(epId.value) } catch {}
}

function saveRaw() { episodeAPI.update(epId.value, { content: localRaw.value }); episode.value.content = localRaw.value }
function saveScr() { episodeAPI.update(epId.value, { script_content: localScript.value }); episode.value.script_content = localScript.value }
function doRewrite() { saveRaw(); runAgent('script_rewriter', '극본을 읽고 형식화된 극본으로 수정한 뒤 저장하세요', dramaId, epId.value, refresh) }
function skipRewrite() {
  const raw = (localRaw.value || rawContent.value || '').trim()
  if (!raw) {
    toast.warning('먼저 원본 내용을 입력하세요')
    return
  }
  localScript.value = raw
  saveScr()
  toast.success('AI 수정을 건너뛰었습니다. 현재 원본 내용을 바로 사용합니다')
  scriptStep.value = 2
}
function doExtract() { saveScr(); runAgent('extractor', '극본에서 모든 캐릭터와 장면 정보를 추출하고 프로젝트 기존 데이터와 자동으로 중복 제거해 병합하세요', dramaId, epId.value, refresh) }
function doVoice() { runAgent('voice_assigner', '모든 캐릭터에 적절한 음색을 배정하세요', dramaId, epId.value, refresh) }
async function batchGenSamples() {
  const pending = chars.value.filter(c => (c.voice_style || c.voiceStyle) && !(c.voice_sample_url || c.voiceSampleUrl))
  if (!pending.length) {
    toast.info(charsVoiced.value ? '모든 캐릭터의 미리듣기 파일이 생성되었습니다' : '먼저 음색을 배정하세요')
    return
  }
  toast.info(`미리듣기 ${pending.length} 개를 안전 모드로 순차 생성합니다`)
  const results = await runSequentially(pending, c => characterAPI.voiceSample(c.id, epId.value), SAFE_BATCH_DELAY_MS.tts)
  const okCount = results.filter(r => r.status === 'fulfilled').length
  const failCount = results.length - okCount
  if (okCount) toast.success(`생성됨 ${okCount} 개 미리듣기 파일`)
  if (failCount) toast.error(`${failCount} 개 미리듣기 파일 생성 실패`)
  await refresh()
}
function doBreakdown() {
  const cfg = videoConfigs.value.find(c => c.id === lockedVideoConfigId.value)
  const label = cfg ? `${cfg.name} (${cfg.provider})` : '기본값'
  runAgent('storyboard_breaker', `스토리보드를 분해하고 영상 프롬프트를 생성하세요. 영상 모델: ${label}. 해당 모델의 특성과 길이 제한에 맞는 영상 프롬프트를 생성하세요.`, dramaId, epId.value, refresh)
}
async function genSample(id) { try { await characterAPI.voiceSample(id, epId.value); toast.success('미리듣기가 생성되었습니다'); refresh() } catch (e) { toast.error(e.message) } }
async function addShot() { await storyboardAPI.create({ episode_id: epId.value, storyboard_number: sbs.value.length + 1, title: `샷${sbs.value.length + 1}`, duration: 10 }); refresh() }

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const SAFE_BATCH_DELAY_MS = {
  tts: 25000,
  image: 12000,
  video: 20000,
  compose: 3000,
}

function watchAsyncResult(check, attempts = 24, delay = 2500) {
  void (async () => {
    for (let i = 0; i < attempts; i++) {
      await sleep(delay)
      await refresh()
      if (check()) return
    }
  })()
}

async function runSequentially(items, task, delayMs = 0) {
  const results = []
  for (const [index, item] of items.entries()) {
    try {
      results.push({ status: 'fulfilled', value: await task(item) })
    } catch (reason) {
      results.push({ status: 'rejected', reason })
    }
    if (delayMs > 0 && index < items.length - 1) await sleep(delayMs)
  }
  return results
}

async function copyPrompt(text, label = '프롬프트') {
  const value = String(text || '').trim()
  if (!value) {
    toast.warning(`${label}가 비어 있습니다`)
    return false
  }
  await navigator.clipboard.writeText(value)
  toast.success(`${label}를 복사했습니다`)
  return true
}

function buildCharacterImagePrompt(char) {
  return [
    `Use case: illustration-story`,
    `Asset type: character reference image`,
    `Primary request: ${char.name} character portrait for a short-form drama`,
    char.appearance ? `Subject: ${char.appearance}` : '',
    char.description ? `Character description: ${char.description}` : '',
    char.personality ? `Mood/personality: ${char.personality}` : '',
    char.role ? `Role: ${char.role}` : '',
    'Style/medium: cinematic high-quality character concept art, consistent drama style',
    'Composition/framing: front-facing portrait, clear face and outfit, clean background',
    'Constraints: no text, no watermark, no logo',
  ].filter(Boolean).join('\n')
}

function buildSceneImagePrompt(scene) {
  return [
    'Use case: illustration-story',
    'Asset type: scene reference image',
    `Primary request: ${scene.location} scene background for a short-form drama`,
    scene.time ? `Time: ${scene.time}` : '',
    scene.prompt ? `Scene/backdrop: ${scene.prompt}` : '',
    'Style/medium: cinematic scene, high-quality lighting, consistent drama style',
    'Constraints: no text, no watermark, no logo',
  ].filter(Boolean).join('\n')
}

function buildTtsPrompt(sb) {
  return [
    `샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id} 더빙`,
    `화자: ${getDialogueSpeaker(sb)}`,
    `대사: ${getDialogueText(sb)}`,
    `권장 분위기: ${sb.atmosphere || sb.action || '장면 감정에 맞는 자연스러운 연기'}`,
  ].filter(Boolean).join('\n')
}

function buildVideoManualPrompt(sb) {
  return [
    `Use case: video-generation`,
    `Asset type: short-form drama shot video`,
    `Primary request: ${sb.video_prompt || sb.videoPrompt || sb.description || sb.title || ''}`,
    `Duration: ${Number(sb.duration || 5)} seconds`,
    sb.location ? `Location: ${sb.location}` : '',
    sb.time ? `Time: ${sb.time}` : '',
    sb.dialogue ? `Dialogue/narration: ${sb.dialogue}` : '',
    sb.bgm_prompt || sb.bgmPrompt ? `BGM: ${sb.bgm_prompt || sb.bgmPrompt}` : '',
    sb.sound_effect || sb.soundEffect ? `Sound effects: ${sb.sound_effect || sb.soundEffect}` : '',
    getFirstFrame(sb) ? `First frame reference: ${getFirstFrame(sb)}` : '',
    getLastFrame(sb) ? `Last frame reference: ${getLastFrame(sb)}` : '',
  ].filter(Boolean).join('\n')
}

function openManualDialog({ title, kind, accept, prompt, onSave }) {
  manualDialog.open = true
  manualDialog.title = title
  manualDialog.kind = kind || 'uploads'
  manualDialog.accept = accept || ''
  manualDialog.prompt = prompt || ''
  manualDialog.url = ''
  manualDialog.file = null
  manualDialog.onSave = onSave
}

function closeManualDialog() {
  manualDialog.open = false
  manualDialog.onSave = null
}

function onManualFileChange(event) {
  manualDialog.file = event.target.files?.[0] || null
}

async function submitManualAsset() {
  try {
    let path = ''
    if (manualDialog.file) {
      const uploaded = await uploadAPI.file(manualDialog.file, manualDialog.kind)
      path = uploaded.path || uploaded.url || ''
    } else if (manualDialog.url.trim()) {
      const uploaded = await uploadAPI.fromUrl(manualDialog.url.trim(), manualDialog.kind)
      path = uploaded.path || uploaded.url || manualDialog.url.trim()
    }
    if (!path) {
      toast.warning('파일을 선택하거나 URL/저장 경로를 입력하세요')
      return
    }
    await manualDialog.onSave?.(path)
    toast.success('수동 생성 결과를 연결했습니다')
    closeManualDialog()
    await refresh()
  } catch (e) {
    toast.error(e.message || '수동 결과 연결 실패')
  }
}

function joinManualPrompts(items, buildLine) {
  return items.map((item, idx) => {
    const title = buildLine(item, idx)
    return [`[${title}]`, item.prompt].filter(Boolean).join('\n')
  }).join('\n\n---\n\n')
}

async function registerManualImage({ path, prompt, storyboardId, sceneId, characterId, frameType }) {
  return imageAPI.manual({
    local_path: path,
    prompt,
    drama_id: dramaId,
    storyboard_id: storyboardId,
    scene_id: sceneId,
    character_id: characterId,
    frame_type: frameType,
  })
}

function handleCharImage(char) {
  if (!isManualGeneration.value) {
    genCharImg(char.id)
    return
  }
  const prompt = buildCharacterImagePrompt(char)
  openManualDialog({
    title: `${char.name} 캐릭터 이미지 수동 등록`,
    kind: 'images',
    accept: 'image/*',
    prompt,
    onSave: async (path) => {
      await registerManualImage({ path, prompt, characterId: char.id, frameType: 'character_reference' })
      await characterAPI.update(char.id, { image_url: path, local_path: path })
    },
  })
}

async function handleBatchCharImages() {
  if (!isManualGeneration.value) {
    batchCharImages()
    return
  }
  const pending = visualChars.value.filter(c => !(c.image_url || c.imageUrl))
  if (!pending.length) {
    toast.info('모든 캐릭터 이미지가 등록되었습니다')
    return
  }
  const text = joinManualPrompts(
    pending.map(char => ({ char, prompt: buildCharacterImagePrompt(char) })),
    ({ char }, idx) => `캐릭터 ${idx + 1}: ${char.name}`,
  )
  await copyPrompt(text, '캐릭터 이미지 일괄 프롬프트')
}

function handleSceneImage(scene) {
  if (!isManualGeneration.value) {
    genSceneImg(scene.id)
    return
  }
  const prompt = buildSceneImagePrompt(scene)
  openManualDialog({
    title: `${scene.location} 장면 이미지 수동 등록`,
    kind: 'images',
    accept: 'image/*',
    prompt,
    onSave: async (path) => {
      await registerManualImage({ path, prompt, sceneId: scene.id, frameType: 'scene_reference' })
      await sceneAPI.update(scene.id, { image_url: path, local_path: path, status: 'completed' })
    },
  })
}

async function handleBatchSceneImages() {
  if (!isManualGeneration.value) {
    batchSceneImages()
    return
  }
  const pending = scenes.value.filter(s => !(s.image_url || s.imageUrl))
  if (!pending.length) {
    toast.info('모든 장면 이미지가 등록되었습니다')
    return
  }
  const text = joinManualPrompts(
    pending.map(scene => ({ scene, prompt: buildSceneImagePrompt(scene) })),
    ({ scene }, idx) => `장면 ${idx + 1}: ${scene.location}`,
  )
  await copyPrompt(text, '장면 이미지 일괄 프롬프트')
}

async function genCharImg(id) {
  try {
    if (!isPendingCharImage(id)) pendingCharImageIds.value.push(id)
    await characterAPI.generateImage(id, epId.value)
    toast.success('캐릭터 이미지 생성 중')
    await refresh()
    watchAsyncResult(() => {
      const char = chars.value.find(c => c.id === id)
      const done = !!(char?.image_url || char?.imageUrl)
      if (done) pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
      return done
    })
  } catch (e) {
    pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
    toast.error(e.message)
  }
}
function batchCharImages() {
  const ids = visualChars.value.filter(c => !(c.image_url || c.imageUrl)).map(c => c.id)
  if (!ids.length) { toast.info('모든 캐릭터 이미지가 생성되었습니다'); return }
  pendingCharImageIds.value = [...new Set([...pendingCharImageIds.value, ...ids])]
  ;(async () => {
    toast.info(`캐릭터 이미지 ${ids.length} 개를 안전 모드로 순차 생성합니다`)
    const results = await runSequentially(ids, id => characterAPI.generateImage(id, epId.value), SAFE_BATCH_DELAY_MS.image)
    const failCount = results.filter(r => r.status === 'rejected').length
    if (failCount) toast.error(`${failCount} 개 캐릭터 이미지 요청 실패`)
    else toast.success('캐릭터 이미지 일괄 생성 중')
    await refresh()
    watchAsyncResult(() => ids.every(id => {
      const char = chars.value.find(c => c.id === id)
      const done = !!(char?.image_url || char?.imageUrl)
      if (done) pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
      return done
    }), 36)
  })().catch(e => {
    pendingCharImageIds.value = pendingCharImageIds.value.filter(item => !ids.includes(item))
    toast.error(e.message)
  })
}
async function genSceneImg(id) {
  try {
    if (!isPendingSceneImage(id)) pendingSceneImageIds.value.push(id)
    await sceneAPI.generateImage(id, epId.value)
    toast.success('장면 이미지 생성 중')
    await refresh()
    watchAsyncResult(() => {
      const scene = scenes.value.find(s => s.id === id)
      const done = !!(scene?.image_url || scene?.imageUrl)
      if (done) pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
      return done
    })
  } catch (e) {
    pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
    toast.error(e.message)
  }
}
function batchSceneImages() {
  const ids = scenes.value.filter(s => !(s.image_url || s.imageUrl)).map(s => s.id)
  if (!ids.length) { toast.info('모든 장면 이미지가 생성되었습니다'); return }
  pendingSceneImageIds.value = [...new Set([...pendingSceneImageIds.value, ...ids])]
  ;(async () => {
    toast.info(`장면 이미지 ${ids.length} 개를 안전 모드로 순차 생성합니다`)
    const results = await runSequentially(ids, id => sceneAPI.generateImage(id, epId.value), SAFE_BATCH_DELAY_MS.image)
    const failCount = results.filter(r => r.status === 'rejected').length
    if (failCount) toast.error(`${failCount} 개 장면 이미지 요청 실패`)
    else toast.success('장면 이미지 일괄 생성 중')
    await refresh()
  })().catch(e => toast.error(e.message))
  watchAsyncResult(() => ids.every(id => {
    const scene = scenes.value.find(s => s.id === id)
    const done = !!(scene?.image_url || scene?.imageUrl)
    if (done) pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
    return done
  }), 36)
}

const IGNORE_TTS_SPEAKERS = /^(환경음|환경음|효과음|효과음|sfx|sound ?effect|bgm|배경음|배경음악|ambient)$/i
const IGNORE_TTS_TEXT = /^(없음|없음대사|대사 없음|없음내레이션|필요 없음더빙|필요 없음대사|none|null|n\/a|na|환경음|환경음|효과음|효과음|순수효과음|순수환경음|만 있음환경음|만환경음|배경음|배경음악|bgm|sfx|ambient)$/i

function getDialogueSpeakerRaw(sb) {
  const dialogue = sb?.dialogue?.trim() || ''
  const match = dialogue.match(/^(.+?)[:：]/)
  return match ? match[1].replace(/[（(].+?[)）]/g, '').trim() : ''
}

function getDialogueText(sb) {
  const dialogue = sb?.dialogue?.trim() || ''
  return dialogue ? dialogue.replace(/^.+?[:：]\s*/, '').trim() : ''
}

function isTTSIgnorable(sb) {
  const speaker = getDialogueSpeakerRaw(sb)
  const text = getDialogueText(sb)
  if (!sb?.dialogue?.trim()) return true
  if (speaker && IGNORE_TTS_SPEAKERS.test(speaker)) return true
  if (!text) return true
  if (IGNORE_TTS_TEXT.test(text)) return true
  return false
}

function hasDialogue(sb) { return !isTTSIgnorable(sb) }
function hasTTS(sb) { return !!(sb?.tts_audio_url || sb?.ttsAudioUrl) }
function getTTSUrl(sb) { return sb?.tts_audio_url || sb?.ttsAudioUrl || '' }
function getDialogueSpeaker(sb) {
  const speaker = getDialogueSpeakerRaw(sb)
  if (!speaker) return '내레이션'
  return speaker
}
async function genShotTTS(sb) {
  try {
    await storyboardAPI.generateTTS(sb.id)
    toast.success(`샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id} 더빙 생성됨`)
    await refresh()
  } catch (e) { toast.error(e.message) }
}
async function batchShotTTS() {
  const pending = sbs.value.filter(sb => hasDialogue(sb) && !hasTTS(sb))
  if (!pending.length) {
    toast.info(ttsEligibleCount.value ? '모든 샷 더빙이 생성되었습니다' : '현재 생성할 대사나 내레이션이 없습니다')
    return
  }
  toast.info(`샷 더빙 ${pending.length} 개를 안전 모드로 순차 생성합니다`)
  const results = await runSequentially(pending, sb => storyboardAPI.generateTTS(sb.id), SAFE_BATCH_DELAY_MS.tts)
  const okCount = results.filter(r => r.status === 'fulfilled').length
  const failCount = results.length - okCount
  if (okCount) toast.success(`생성됨 ${okCount} 개 샷 더빙`)
  if (failCount) toast.error(`${failCount} 개샷 더빙 생성 실패`)
  await refresh()
}

function handleShotTTS(sb) {
  if (!isManualGeneration.value) {
    genShotTTS(sb)
    return
  }
  const prompt = buildTtsPrompt(sb)
  openManualDialog({
    title: `샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id} 더빙 수동 등록`,
    kind: 'audio',
    accept: 'audio/*',
    prompt,
    onSave: async (path) => {
      await storyboardAPI.update(sb.id, { tts_audio_url: path })
    },
  })
}

async function handleBatchShotTTS() {
  if (!isManualGeneration.value) {
    batchShotTTS()
    return
  }
  const pending = sbs.value.filter(sb => hasDialogue(sb) && !hasTTS(sb))
  if (!pending.length) {
    toast.info(ttsEligibleCount.value ? '모든 샷 더빙이 등록되었습니다' : '현재 생성할 대사나 내레이션이 없습니다')
    return
  }
  const text = joinManualPrompts(
    pending.map(sb => ({ sb, prompt: buildTtsPrompt(sb) })),
    ({ sb }, idx) => `더빙 ${idx + 1}: 샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id}`,
  )
  await copyPrompt(text, '더빙 일괄 프롬프트')
}

function getFirstFrame(s) { return s?.first_frame_image || s?.firstFrameImage || null }
function getLastFrame(s) { return s?.last_frame_image || s?.lastFrameImage || null }
function getStoryboardCover(s) { return s?.composed_image || s?.composedImage || getFirstFrame(s) || getLastFrame(s) || null }
function getVideoUrl(s) { return s?.video_url || s?.videoUrl || null }
function getComposedVideoUrl(s) { return s?.composed_video_url || s?.composedVideoUrl || null }
function hasImg(s) { return !!getStoryboardCover(s) }
function hasVid(s) { return !!getVideoUrl(s) }
function hasComposed(s) { return !!getComposedVideoUrl(s) }

function getShotReferenceImages(sb) {
  const refs = []
  const pushRef = (value) => {
    if (!value || refs.includes(value) || refs.length >= 6) return
    refs.push(value)
  }
  const sceneId = sb?.scene_id || sb?.sceneId
  const scene = scenes.value.find(item => item.id === sceneId)
  pushRef(scene?.image_url || scene?.imageUrl)
  for (const charId of getStoryboardCharacterIds(sb)) {
    const char = chars.value.find(item => item.id === charId)
    pushRef(char?.image_url || char?.imageUrl)
  }
  for (const ref of getRefs(sb)) {
    pushRef(ref)
  }
  const first = getFirstFrame(sb)
  const last = getLastFrame(sb)
  pushRef(first)
  pushRef(last)
  return refs.filter(Boolean).slice(0, 6)
}

function buildShotImagePrompt(sb, frameType) {
  const title = sb.title || ''
  const description = sb.image_prompt || sb.imagePrompt || sb.description || ''
  const shotType = sb.shot_type || sb.shotType || ''
  const angle = sb.angle || ''
  const movement = sb.movement || ''
  const location = sb.location || getSceneName(sb)
  const time = sb.time || ''
  const charactersText = getStoryboardCharacterNames(sb).join('、')
  const action = sb.action || ''
  const atmosphere = sb.atmosphere || ''
  const frameHint = frameType === 'first_frame'
    ? '이 샷의 시작 키프레임을 생성하되 관계 형성과 동작 시작 순간을 강조하세요'
    : '이 샷의 종료 키프레임을 생성하되 동작 종료, 감정의 도착점 또는 결과 상태를 강조하세요'

  return [
    title ? `샷 제목：${title}` : '',
    description ? `화면 설명：${description}` : '',
    shotType ? `샷 크기：${shotType}` : '',
    angle ? `카메라 위치：${angle}` : '',
    movement ? `카메라 움직임：${movement}` : '',
    charactersText ? `캐릭터：${charactersText}` : '',
    location ? `장소：${location}` : '',
    time ? `시간：${time}` : '',
    action ? `동작：${action}` : '',
    atmosphere ? `분위기：${atmosphere}` : '',
    frameHint,
  ].filter(Boolean).join('；')
}

async function genShotFrame(sb, frameType) {
  const prompt = buildShotImagePrompt(sb, frameType)
  const referenceImages = getShotReferenceImages(sb)
  const key = framePendingKey(sb.id, frameType)
  try {
    if (!pendingShotFrameKeys.value.includes(key)) pendingShotFrameKeys.value.push(key)
    const body = {
      storyboard_id: sb.id,
      drama_id: dramaId,
      prompt,
      frame_type: frameType,
      reference_images: referenceImages.length ? referenceImages : undefined,
    }
    await imageAPI.generate(body)
    toast.success(frameType === 'first_frame' ? '첫 프레임생성 중' : '끝 프레임생성 중')
    await refresh()
    watchAsyncResult(() => {
      const target = sbs.value.find(s => s.id === sb.id)
      const done = frameType === 'first_frame' ? !!getFirstFrame(target) : !!getLastFrame(target)
      if (done) pendingShotFrameKeys.value = pendingShotFrameKeys.value.filter(item => item !== key)
      return done
    })
  } catch (e) {
    pendingShotFrameKeys.value = pendingShotFrameKeys.value.filter(item => item !== key)
    toast.error(e.message)
  }
}

function handleShotFrame(sb, frameType) {
  if (!isManualGeneration.value) {
    genShotFrame(sb, frameType)
    return
  }
  const prompt = buildShotImagePrompt(sb, frameType)
  const frameLabel = frameType === 'first_frame' ? '첫 프레임' : '끝 프레임'
  openManualDialog({
    title: `샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id} ${frameLabel} 수동 등록`,
    kind: 'images',
    accept: 'image/*',
    prompt,
    onSave: async (path) => {
      await registerManualImage({ path, prompt, storyboardId: sb.id, frameType })
      await storyboardAPI.update(sb.id, { [frameType === 'first_frame' ? 'first_frame_image' : 'last_frame_image']: path })
    },
  })
}

async function genVid(sb) {
  const params = {
    storyboard_id: sb.id,
    drama_id: dramaId,
    prompt: sb.video_prompt || sb.videoPrompt || '',
    duration: Number(sb.duration || 5),
  }
  const first = getFirstFrame(sb)
  const last = getLastFrame(sb)
  const refs = getRefs(sb)
  if (first && last) { Object.assign(params, { reference_mode: 'first_last', first_frame_url: first, last_frame_url: last }) }
  else if (refs.length) { Object.assign(params, { reference_mode: 'multiple', reference_image_urls: [first, ...refs].filter(Boolean) }) }
  else if (first) { Object.assign(params, { reference_mode: 'single', image_url: first }) }
  try {
    delete failedVideoMessages.value[sb.id]
    if (!isPendingVideo(sb.id)) pendingVideoIds.value.push(sb.id)
    const generation = await videoAPI.generate(params)
    toast.success('영상 생성 중')
    await refresh()
    await pollVideoGeneration(generation?.id, sb.id)
  } catch (e) {
    pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== sb.id)
    toast.error(e.message)
  }
}

function handleVideo(sb) {
  if (!isManualGeneration.value) {
    genVid(sb)
    return
  }
  const prompt = buildVideoManualPrompt(sb)
  openManualDialog({
    title: `샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id} 영상 수동 등록`,
    kind: 'videos',
    accept: 'video/*',
    prompt,
    onSave: async (path) => {
      await storyboardAPI.update(sb.id, { video_url: path })
    },
  })
}
async function pollVideoGeneration(generationId, storyboardId) {
  if (!generationId) {
    watchAsyncResult(() => {
      const target = sbs.value.find(s => s.id === storyboardId)
      const done = !!(target?.video_url || target?.videoUrl)
      if (done) pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
      return done
    }, 60, 4000)
    return
  }
  for (let i = 0; i < 120; i++) {
    await sleep(4000)
    try {
      const res = await videoAPI.get(generationId)
      await refresh()
      if (res?.status === 'completed') {
        pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
        delete failedVideoMessages.value[storyboardId]
        toast.success('영상 생성 완료')
        return
      }
      if (res?.status === 'failed') {
        pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
        failedVideoMessages.value = {
          ...failedVideoMessages.value,
          [storyboardId]: res?.error_msg || res?.errorMsg || '영상 생성 실패',
        }
        toast.error(failedVideoMessages.value[storyboardId])
        return
      }
    } catch {}
  }
  pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
  failedVideoMessages.value = {
    ...failedVideoMessages.value,
    [storyboardId]: '영상 생성 시간 초과',
  }
  toast.error('영상 생성 시간 초과')
}
async function doCompose(sb) {
  try {
    delete failedComposeMessages.value[sb.id]
    if (!isPendingCompose(sb.id)) pendingComposeIds.value.push(sb.id)
    await composeAPI.shot(sb.id)
    toast.success('합성 완료')
    pendingComposeIds.value = pendingComposeIds.value.filter(item => item !== sb.id)
    refresh()
  } catch (e) {
    pendingComposeIds.value = pendingComposeIds.value.filter(item => item !== sb.id)
    failedComposeMessages.value = {
      ...failedComposeMessages.value,
      [sb.id]: e.message,
    }
    toast.error(e.message)
  }
}
async function batchVideos() {
  const pending = sbs.value.filter(s => !hasVid(s))
  if (!pending.length) {
    toast.info('모든 샷 영상이 생성되었습니다')
    return
  }
  const pendingIds = pending.map(s => s.id)
  pendingVideoIds.value = [...new Set([...pendingVideoIds.value, ...pendingIds])]
  toast.info(`영상 ${pending.length} 개를 안전 모드로 순차 생성합니다`)
  const results = await runSequentially(pending, sb => genVid(sb), SAFE_BATCH_DELAY_MS.video)
  const failCount = results.filter(r => r.status === 'rejected').length
  if (failCount) toast.error(`${failCount} 개 영상 생성 요청 실패`)
  await refresh()
}
async function handleBatchVideos() {
  if (!isManualGeneration.value) {
    void batchVideos()
    return
  }
  const pending = sbs.value.filter(s => !hasVid(s))
  if (!pending.length) {
    toast.info('모든 샷 영상이 등록되었습니다')
    return
  }
  const text = joinManualPrompts(
    pending.map(sb => ({ sb, prompt: buildVideoManualPrompt(sb) })),
    ({ sb }, idx) => `영상 ${idx + 1}: 샷 #${sb.storyboard_number || sb.storyboardNumber || sb.id}`,
  )
  await copyPrompt(text, '영상 일괄 프롬프트')
}
async function batchCompose() {
  await composeAPI.all(epId.value)
  pendingComposeIds.value = [...new Set(sbs.value.filter(sb => !!sb.video_url || !!sb.videoUrl).map(sb => sb.id))]
  toast.success('일괄 합성을 시작했습니다')
  pollComposeStatus()
}
async function doMerge() {
  await mergeAPI.merge(epId.value); toast.success('이어붙이는 중...')
  const poll = setInterval(async () => {
    try { mergeData.value = await mergeAPI.status(epId.value) } catch {}
    if (mergeData.value?.status === 'completed' || mergeData.value?.status === 'failed') {
      clearInterval(poll)
      mergeData.value.status === 'completed' ? toast.success('이어붙이기 완료') : toast.error('이어붙이기 실패')
    }
  }, 3000)
}

async function pollComposeStatus() {
  for (let i = 0; i < 120; i++) {
    await sleep(3000)
    try {
      const res = await composeAPI.status(epId.value)
      await refresh()
      const items = Array.isArray(res?.items) ? res.items : []
      const processingIds = items.filter(item => item.status === 'compose_processing').map(item => item.id)
      pendingComposeIds.value = processingIds

      const failedItems = items.filter(item => item.status === 'compose_failed')
      if (failedItems.length) {
        const next = { ...failedComposeMessages.value }
        failedItems.forEach((item) => {
          next[item.id] = item.error_msg || item.errorMsg || '영상 합성 실패'
        })
        failedComposeMessages.value = next
      }

      if (!processingIds.length) {
        if (failedItems.length) toast.error(`${failedItems.length} 개 샷 합성 실패`)
        else toast.success('일괄 합성 완료')
        return
      }
    } catch {}
  }
}
function getRefs(sb) {
  const raw = sb.reference_images || sb.referenceImages
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

async function loadConfigs() {
  try {
    const [imgCfgs, vidCfgs, audCfgs] = await Promise.all([
      aiConfigAPI.list('image'),
      aiConfigAPI.list('video'),
      aiConfigAPI.list('audio'),
    ])
    imageConfigs.value = imgCfgs || []
    videoConfigs.value = vidCfgs || []
    audioConfigs.value = audCfgs || []
  } catch (e) { console.error('Failed to load AI configs', e) }
}

function inferVoiceGender(name, desc = []) {
  const text = `${name} ${Array.isArray(desc) ? desc.join(' ') : ''}`
  if (/[남성|청년|중장년 남성|선배|boy|man|male]/i.test(text)) return '남성 음성'
  if (/[여성|소녀|성숙한 여성|할머니|girl|woman|female]/i.test(text)) return '여성 음성'
  return '중성'
}

function mapVoiceProfile(v) {
  const desc = Array.isArray(v.description) ? v.description : []
  return {
    id: v.voice_id,
    label: v.voice_name || v.voice_id,
    gender: inferVoiceGender(v.voice_name || v.voice_id, desc),
    traits: desc.length ? desc.slice(0, 2).join('、') : `${v.language || '다국어'}음색`,
    suitable: desc.length > 2 ? desc.slice(2).join('、') : `${v.language || '범용'}캐릭터`,
  }
}

function fallbackVoicesForProvider(provider) {
  return String(provider || '').toLowerCase() === 'gemini' ? geminiVoiceProfiles : fallbackVoiceProfiles
}

async function loadVoices() {
  try {
    const provider = lockedAudioProvider.value || 'minimax'
    const rows = await voicesAPI.list(provider)
    voiceProfiles.value = rows?.length ? rows.map(mapVoiceProfile) : fallbackVoicesForProvider(provider)
  } catch (e) {
    console.error('Failed to load voices', e)
    voiceProfiles.value = fallbackVoicesForProvider(lockedAudioProvider.value)
  }
}

watch([lockedAudioConfigId, audioConfigs], () => { loadVoices() }, { deep: true })
onMounted(() => { refresh(); loadConfigs(); loadVoices() })
</script>

<style scoped>
/* ===== Studio Layout ===== */
.studio {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: 14px;
  gap: 12px;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.7), transparent 28%),
    linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0)),
    var(--bg-base);
}

.studio-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 18px;
  background: rgba(252, 253, 255, 0.84);
  border: 1px solid rgba(27, 41, 64, 0.08);
  box-shadow: 0 14px 36px rgba(20, 32, 54, 0.07), 0 3px 10px rgba(20, 32, 54, 0.04);
  backdrop-filter: blur(16px);
}

.studio-topbar-main,
.sidebar,
.main {
  background: rgba(252, 253, 255, 0.84);
  border: 1px solid rgba(27, 41, 64, 0.08);
  box-shadow: 0 18px 48px rgba(20, 32, 54, 0.08), 0 4px 14px rgba(20, 32, 54, 0.05);
  backdrop-filter: blur(16px);
}

.studio-topbar-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
  background: transparent;
  min-width: 0;
}

.topbar-back {
  width: auto;
  min-width: 76px;
  padding: 0 8px;
  height: 28px;
  border-radius: 999px;
  white-space: nowrap;
  font-size: 11px;
}

.studio-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.studio-overline {
  display: none;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.studio-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.studio-title {
  font-size: 14px;
  line-height: 1;
  letter-spacing: -0.04em;
  white-space: nowrap;
}

.studio-episode-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(19, 51, 121, 0.08);
  color: var(--accent-text);
  font-size: 9px;
  font-weight: 700;
}

.studio-meta-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  min-width: 0;
}

.studio-meta-pill {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(18, 25, 42, 0.05);
  color: var(--text-2);
  font-size: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.studio-meta-pill.is-stage {
  background: rgba(19, 51, 121, 0.08);
  color: var(--accent-text);
}
.studio-meta-pill.is-progress {
  background: rgba(45, 122, 69, 0.08);
  color: var(--success);
}
.studio-meta-inline {
  font-size: 9px;
  color: var(--text-3);
  font-weight: 600;
  white-space: nowrap;
}

.studio-topbar-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.studio-actions {
  display: flex;
  gap: 6px;
}
.studio-topbar .btn {
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  white-space: nowrap;
}

.studio-body {
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  flex: 1;
}

/* ===== Sidebar ===== */
.sidebar {
  width: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  border-radius: 28px;
}
.back-btn {
  width: 40px; height: 40px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(27, 41, 64, 0.1); border-radius: 14px;
  background: rgba(255,255,255,0.8); color: var(--text-2);
  cursor: pointer; transition: all 0.15s;
  box-shadow: var(--shadow-xs);
}
.back-btn:hover { background: #fff; color: var(--text-0); }

/* Pipeline Nav */
.pipeline { flex: 1; overflow-y: auto; padding: 16px 14px 12px; display: flex; flex-direction: column; gap: 12px; }
.pipe-section { display: flex; flex-direction: column; gap: 4px; }
.pipe-section-label {
  font-size: 10px; font-weight: 700; color: #95a1b6;
  text-transform: uppercase; letter-spacing: 0.1em;
  padding: 2px 8px 3px;
}
.pipe-item {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
  padding: 7px 10px;
  border-radius: 17px;
  font-size: 12px; font-weight: 600;
  background: none; border: 1px solid transparent; color: var(--text-2); cursor: pointer;
  transition: all 0.14s; width: 100%; text-align: left;
}
.pipe-item:hover { background: rgba(255,255,255,0.3); color: var(--text-0); }
.pipe-item.active {
  background: rgba(255,255,255,0.94);
  color: var(--text-0);
  border-color: rgba(27, 41, 64, 0.05);
  box-shadow: 0 8px 18px rgba(19, 33, 56, 0.045);
}
.pipe-item.done { color: var(--success); }
.pipe-item-sub {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  padding: 7px 10px;
  position: relative;
  min-height: 42px;
}

.pipe-item-sub:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 18px;
  top: 25px;
  bottom: -7px;
  width: 1px;
  background: rgba(27, 41, 64, 0.07);
}

.pipe-icon {
  width: 17px; height: 17px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(246,248,252,0.98); border: 1px solid rgba(18,25,42,0.08);
  color: #aab4c6; flex-shrink: 0; transition: all 0.15s;
  position: relative;
  z-index: 1;
}
.pipe-item.active .pipe-icon { background: rgba(19, 51, 121, 0.07); border-color: rgba(19, 51, 121, 0.1); color: var(--accent-text); }
.pipe-item.done .pipe-icon { background: rgba(45, 122, 69, 0.96); border-color: rgba(45,122,69,0.18); color: #fff; }
.icon-active { background: var(--accent-dark) !important; border-color: var(--accent-dark) !important; color: #fff !important; }
.icon-done { background: var(--success) !important; border-color: var(--success) !important; color: #fff !important; }

.pipe-label { flex: 1; font-size: 11.5px; }
.pipe-copy { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pipe-sub {
  font-size: 8.5px;
  line-height: 1.35;
  color: var(--text-3);
  font-weight: 500;
}
.pipe-badge {
  font-size: 9px; font-weight: 700; padding: 1px 5px;
  border-radius: 99px; background: var(--bg-3); color: var(--text-3);
  font-family: var(--font-mono);
}
.pipe-badge.badge-done { background: var(--success-bg); color: var(--success); }
.pipe-spinner { width: 10px; height: 10px; border: 1.5px solid var(--accent-bg); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Sidebar Bottom */
.sidebar-bottom {
  padding: 12px 14px 14px;
  border-top: 1px solid rgba(27, 41, 64, 0.08);
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.72));
}
.sidebar-jumper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 3px 0 2px;
}
.sidebar-jump-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: none;
  background: rgba(45, 122, 69, 0.22);
  cursor: pointer;
  transition: transform 0.14s, background 0.14s, box-shadow 0.14s;
}
.sidebar-jump-dot:hover {
  transform: scale(1.08);
}
.sidebar-jump-dot.active {
  background: var(--accent-dark);
  box-shadow: 0 0 0 2px rgba(76, 125, 255, 0.14);
}
.sidebar-jump-dot.done {
  background: var(--success);
}
.sidebar-jump-dot.active.done {
  background: #1e3f8a;
}
.progress-wrap { display: flex; flex-direction: column; gap: 5px; }
.progress-head { display: flex; justify-content: space-between; }
.progress-label { font-size: 10.5px; color: var(--text-3); font-weight: 500; }
.progress-val { font-size: 10.5px; color: var(--text-2); font-family: var(--font-mono); font-weight: 600; }
.progress-track { height: 6px; background: rgba(194, 207, 227, 0.92); border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent-gradient); border-radius: 99px; transition: width 0.5s var(--ease-out); }
.refresh-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; font-size: 11.5px; color: var(--text-2);
  background: rgba(255,255,255,0.86); border: 1px solid rgba(27, 41, 64, 0.08); border-radius: 999px;
  cursor: pointer; transition: all 0.15s;
}
.refresh-btn:hover { background: #fff; color: var(--text-0); }

/* ===== Main Content ===== */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; min-height: 0; border-radius: 30px; }
.content-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; min-height: 0; }
.stage-subnav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.52));
  overflow-x: auto;
  flex-shrink: 0;
}
.stage-subnav-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  background: rgba(255,255,255,0.7);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}
.stage-subnav-item:hover {
  background: #fff;
  color: var(--text-0);
}
.stage-subnav-item.active {
  background: rgba(19, 51, 121, 0.08);
  border-color: rgba(19, 51, 121, 0.12);
  color: #1e3f8a;
}
.stage-subnav-item.done {
  color: var(--text-1);
}
.stage-subnav-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--success);
  box-shadow: 0 0 0 4px rgba(45, 122, 69, 0.1);
}

/* Toolbar */
.step-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.42)); flex-shrink: 0;
}
.prod-toolbar { background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.42)); }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.step-indicator { display: flex; align-items: center; gap: 8px; }
.step-num {
  width: 26px; height: 26px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(19, 51, 121, 0.08);
  font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent-text); letter-spacing: 0.05em;
}
.step-name { font-size: 13px; font-weight: 700; color: var(--text-1); font-family: var(--font-display); }
.char-count { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }

/* Editor Area */
.step-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.fill-textarea {
  flex: 1; border: none; border-radius: 0; padding: 26px 28px;
  font-size: 13.5px; line-height: 1.9; resize: none; outline: none;
  font-family: var(--font-body); background: linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.12)); color: var(--text-0);
}
.fill-textarea:focus { box-shadow: none; }

/* Step Empty State */
.step-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; min-height: 300px; gap: 10px; padding: 46px;
  animation: fadeIn 0.3s var(--ease-out);
}
.empty-visual {
  width: 72px; height: 72px; border-radius: 22px;
  background: rgba(255,255,255,0.8); color: var(--accent);
  border: 1px solid rgba(27, 41, 64, 0.08);
  box-shadow: var(--shadow-sm);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.empty-title { font-size: 22px; font-weight: 700; font-family: var(--font-display); color: var(--text-0); }
.empty-desc { font-size: 13px; color: var(--text-2); max-width: 420px; text-align: center; line-height: 1.8; }
.step-empty-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }

/* Step Loading */
.step-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 12px;
}
.loading-text { font-size: 13px; color: var(--text-2); }

/* Step Navigator Bubble */
.step-bubble {
  position: static;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.58));
  border-top: 1px solid rgba(27, 41, 64, 0.08);
  margin-top: auto;
}
.bubble-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 500;
  border: 1px solid rgba(27, 41, 64, 0.08); background: rgba(255,255,255,0.84); color: var(--text-2); cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.bubble-btn:hover:not(:disabled) { background: #fff; color: var(--text-0); }
.bubble-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.bubble-btn.primary { margin-left: auto; background: linear-gradient(135deg, #557ff4, #345fcc); color: #fff; box-shadow: 0 6px 16px rgba(53, 95, 206, 0.2); border-color: transparent; }
.bubble-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
.bubble-btn.primary:disabled { filter: none; box-shadow: none; opacity: 0.5; }
.bubble-dots { display: flex; gap: 7px; padding: 0 4px; }
.bubble-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(143, 160, 184, 0.4); cursor: pointer; transition: all 0.15s;
  border: none;
}
.bubble-dot.done { background: var(--success); }
.bubble-dot.current { background: var(--accent-dark); transform: scale(1.2); box-shadow: 0 0 0 2px rgba(76, 125, 255, 0.14); }

/* Extract grid */
.extract-stage { flex: 1; min-height: 0; overflow: hidden; padding: 12px 16px; display: grid; grid-template-columns: 280px minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
.extract-summary { padding: 16px; display: flex; flex-direction: column; gap: 14px; align-self: stretch; position: sticky; top: 0; max-height: 100%; }
.extract-summary-kicker { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); }
.extract-summary-title { font-size: 20px; line-height: 1.05; font-family: var(--font-display); color: var(--text-0); }
.extract-summary-desc { font-size: 12px; color: var(--text-2); line-height: 1.7; }
.extract-summary-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.extract-summary-stat { padding: 10px 12px; border-radius: 14px; background: rgba(19, 51, 121, 0.05); border: 1px solid rgba(19, 51, 121, 0.08); display: flex; flex-direction: column; gap: 4px; }
.extract-summary-stat span { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.extract-summary-stat strong { font-size: 18px; color: var(--text-0); font-family: var(--font-display); }
.extract-summary-note { padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.56); border: 1px solid rgba(27, 41, 64, 0.08); font-size: 11px; line-height: 1.7; color: var(--text-2); }
.extract-card { overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
.extract-card-head {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 14px; font-size: 12px; font-weight: 600;
  border-bottom: 1px solid var(--border); background: var(--bg-1);
  color: var(--text-1);
}
.extract-list { padding: 8px 14px; flex: 1; min-height: 0; overflow-y: auto; }
.extract-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; }
.extract-row + .extract-row { border-top: 1px solid var(--border); }
.char-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--accent-bg); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; flex-shrink: 0;
}
.scene-icon {
  width: 30px; height: 30px; border-radius: 6px;
  background: var(--bg-2); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3); flex-shrink: 0;
}
.extract-info { min-width: 0; }
.extract-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.extract-name { font-size: 13px; font-weight: 600; }
.extract-meta { font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.extract-meta.wrap { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* Voice grid */
.voice-stage { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 16px; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 12px; }
.voice-stage-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-self: start;
  position: sticky;
  top: 0;
  min-height: 0;
  max-height: calc(100vh - 210px);
  overflow: hidden;
}
.voice-stage-kicker { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); }
.voice-stage-title { font-size: 20px; line-height: 1.05; font-family: var(--font-display); color: var(--text-0); }
.voice-stage-desc { font-size: 12px; color: var(--text-2); line-height: 1.7; }
.voice-stage-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.voice-stage-stat { padding: 10px 12px; border-radius: 14px; background: rgba(19, 51, 121, 0.05); border: 1px solid rgba(19, 51, 121, 0.08); display: flex; flex-direction: column; gap: 3px; }
.voice-stage-stat-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
.voice-stage-stat strong { font-size: 18px; color: var(--text-0); font-family: var(--font-display); }
.voice-library-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}
.voice-library {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.voice-library-item { padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.56); border: 1px solid rgba(27, 41, 64, 0.08); display: flex; flex-direction: column; gap: 4px; }
.voice-library-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.voice-library-name { font-size: 13px; font-weight: 700; color: var(--text-0); }
.voice-library-traits { font-size: 11px; color: var(--text-1); }
.voice-library-fit { font-size: 10px; color: var(--text-3); line-height: 1.5; }

.voice-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; align-content: start; }
.voice-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; border-radius: 22px; min-height: 0; }
.voice-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.voice-char { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.voice-name { min-width: 0; flex: 1; }
.voice-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.voice-card-copy { min-height: 58px; }
.voice-card-text { font-size: 12px; line-height: 1.7; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.voice-select-block { display: flex; flex-direction: column; gap: 6px; }
.voice-block-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.voice-profile-card { padding: 12px; border-radius: 16px; background: linear-gradient(135deg, rgba(19, 51, 121, 0.08), rgba(255,255,255,0.78)); border: 1px solid rgba(19, 51, 121, 0.1); display: flex; flex-direction: column; gap: 4px; }
.voice-profile-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.voice-profile-name { font-size: 13px; font-weight: 700; color: var(--accent-text); }
.voice-profile-traits { font-size: 11px; color: var(--text-1); }
.voice-profile-fit { font-size: 10px; color: var(--text-2); line-height: 1.5; }
.voice-actions-row { display: flex; align-items: center; gap: 8px; }
.voice-player audio { width: 100%; height: 30px; border-radius: var(--radius); }
.char-avatar.lg { width: 38px; height: 38px; font-size: 16px; }

/* Split layout (storyboard) */
.split-layout { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.shot-list { width: 296px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid var(--border); background: var(--bg-0); }
.shot-list-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 12px 10px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.06);
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(10px);
}
.shot-list-title { font-size: 13px; font-weight: 700; color: var(--text-0); }
.shot-list-sub { margin-top: 3px; font-size: 11px; color: var(--text-3); line-height: 1.45; }
.shot-list-body { padding: 6px; }
.shot-item {
  position: relative; padding: 10px 11px; cursor: pointer;
  border: 1px solid transparent; border-left: 3px solid transparent;
  transition: all 0.15s;
  display: flex; flex-direction: column; gap: 5px;
  border-radius: 14px;
}
.shot-item + .shot-item { margin-top: 6px; }
.shot-item:hover { background: var(--bg-hover); border-color: rgba(27, 41, 64, 0.06); }
.shot-item.active {
  background: var(--bg-0);
  border-left-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent-glow);
  z-index: 1;
}
.shot-item-header { display: flex; align-items: center; gap: 8px; }
.shot-num {
  font-size: 11px; font-family: var(--font-mono); font-weight: 700;
  color: var(--accent); background: var(--accent-bg);
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  letter-spacing: 0.03em;
}
.shot-item.active .shot-num { background: var(--accent); color: #fff; }
.shot-status { display: flex; gap: 4px; margin-left: auto; flex-shrink: 0; }
.shot-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.shot-dot.has-img { background: var(--success); }
.shot-dot.has-video { background: var(--info); }
.shot-dot.has-dialogue { background: var(--warning); }
.shot-body { }
.shot-desc { font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-1); }
.shot-item.active .shot-desc { color: var(--text-0); }
.shot-meta { display: flex; align-items: center; gap: 6px; }
.shot-location {
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.shot-dialogue {
  font-size: 10px; color: var(--text-3); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding-left: 2px; border-left: 2px solid var(--border);
  padding-left: 6px;
}

.detail-panel { flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-width: 0; }
.detail-head { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.detail-head-copy { display: flex; flex-direction: column; gap: 2px; }
.detail-head-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.detail-head-sub { font-size: 11px; color: var(--text-3); }
.detail-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.9fr);
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(20,39,82,0.08), rgba(255,255,255,0.68));
  border: 1px solid rgba(27, 41, 64, 0.08);
}
.detail-hero-copy { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.detail-hero-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--text-3);
}
.detail-hero-text { font-size: 13px; color: var(--text-1); line-height: 1.7; }
.detail-status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.detail-preview-card { display: flex; flex-direction: column; gap: 6px; }
.detail-preview-title { font-size: 11px; font-weight: 700; color: var(--text-2); }
.detail-preview-media {
  position: relative; aspect-ratio: 16/9; overflow: hidden;
  border-radius: 14px; background: rgba(18,25,42,0.08);
  border: 1px solid rgba(27, 41, 64, 0.08);
}
.detail-preview-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.detail-preview-empty {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: var(--text-3); font-size: 12px;
}
.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(27, 41, 64, 0.08);
}
.detail-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-section-title { font-size: 12px; font-weight: 700; color: var(--text-0); }
.detail-section-copy { font-size: 11px; color: var(--text-3); }

/* Field */
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 500; color: var(--text-1); }
.field-row { display: flex; gap: 12px; }
.field-grid { display: grid; gap: 12px; }
.field-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.locked-config {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(19, 51, 121, 0.08);
  border: 1px solid rgba(19, 51, 121, 0.12);
  color: var(--text-1);
  font-size: 11px;
  font-weight: 600;
}
.locked-config-banner {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-2);
}
.role-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.role-pill {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(27, 41, 64, 0.12);
  background: rgba(255,255,255,0.86);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.role-pill:hover { border-color: var(--accent); color: var(--text-0); }
.role-pill.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  box-shadow: 0 8px 18px rgba(29, 77, 176, 0.18);
}

/* Production tabs */
.prod-tabs { display: flex; gap: 0; background: var(--bg-2); border-radius: var(--radius); padding: 2px; }
.prod-tab {
  display: flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 12px;
  border: none; background: transparent; color: var(--text-2); cursor: pointer;
  border-radius: calc(var(--radius) - 2px); transition: all 0.15s; font-weight: 500;
}
.prod-tab:hover { color: var(--text-0); }
.prod-tab.active { background: var(--bg-0); color: var(--text-0); font-weight: 600; box-shadow: var(--shadow-xs); }
.prod-tab-badge { font-size: 10px; font-family: var(--font-mono); padding: 0 4px; background: var(--bg-3); border-radius: 99px; }
.prod-tab.active .prod-tab-badge { background: var(--accent-bg); color: var(--accent-text); }
.generation-mode-strip {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 6px 9px;
  margin-top: 8px;
  border-radius: 8px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  background: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  color: var(--text-1);
}
.generation-mode-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--success);
}
.generation-mode-dot.manual { background: var(--warning); }
.generation-mode-dot.api { background: var(--success); }

/* Production content */
.prod-content { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
.prod-section-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.dub-grid { display: flex; flex-direction: column; gap: 10px; }
.dub-card { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; border-radius: 20px; background: linear-gradient(180deg, rgba(255,255,255,0.74), rgba(248,251,255,0.58)); }
.dub-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dub-copy { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.dub-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dub-desc { font-size: 13px; line-height: 1.6; color: var(--text-1); }
.dub-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px; }
.dub-foot { display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid rgba(27, 41, 64, 0.08); }
.dub-audio { flex: 1; min-width: 0; height: 30px; }

/* Asset grid */
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.asset-card {
  display: flex; flex-direction: column; overflow: hidden;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
}
.asset-card:hover { transform: translateY(-2px); box-shadow: 0 16px 30px rgba(20, 32, 54, 0.08); }
.asset-cover { position: relative; aspect-ratio: 1; background: var(--bg-2); overflow: hidden; }
.asset-cover.wide { aspect-ratio: 16/9; }
.asset-cover img { width: 100%; height: 100%; object-fit: cover; }
.previewable-image { cursor: zoom-in; transition: transform 0.18s var(--ease-out), filter 0.18s var(--ease-out); }
.previewable-image:hover { transform: scale(1.015); filter: saturate(1.04); }
.asset-cover-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(7,11,21,0.58);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.asset-cover-badge.is-ready {
  background: rgba(36, 125, 72, 0.92);
}
.asset-cover-badge.is-pending {
  background: rgba(19, 51, 121, 0.92);
}
.asset-cover-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.asset-body { padding: 8px 10px; }
.asset-name { font-size: 13px; font-weight: 600; }
.asset-meta { font-size: 11px; }
.asset-foot { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-top: 1px solid var(--border); }

/* Frame grid */
.frame-grid { display: flex; flex-direction: column; gap: 8px; }
.frame-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; cursor: pointer;
  border-radius: var(--radius-lg);
  transition: all 0.15s;
  border: 1.5px solid transparent;
}
.frame-row:hover { background: var(--bg-0); border-color: var(--border); }
.frame-row.active {
  background: var(--bg-0);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.frame-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.frame-top { display: flex; align-items: center; gap: 8px; }
.frame-num {
  font-size: 13px; font-family: var(--font-mono); font-weight: 800;
  color: var(--accent);
}
.frame-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 20px;
  background: var(--accent-bg); color: var(--accent);
  border: 1px solid var(--accent-glow);
  white-space: nowrap;
}
.frame-desc {
  font-size: 12px; line-height: 1.5; color: var(--text-1);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.frame-meta { display: flex; align-items: center; gap: 6px; }
.frame-thumbs { display: flex; gap: 8px; flex-shrink: 0; }
.frame-thumb-wrap { display: flex; flex-direction: column; gap: 3px; align-items: center; }
.frame-thumb-label { font-size: 10px; font-weight: 600; color: var(--text-3); }
.frame-thumb {
  position: relative; width: 130px; aspect-ratio: 16/9;
  border-radius: 6px; overflow: hidden;
  background: var(--bg-2); cursor: pointer;
  transition: all 0.15s; border: 1.5px solid var(--border);
}
.frame-thumb:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.frame-thumb img { width: 100%; height: 100%; object-fit: cover; }
.frame-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.frame-re {
  position: absolute; top: 3px; right: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: rgba(0,0,0,0.5); color: #fff;
  display: none; align-items: center; justify-content: center;
}
.frame-thumb:hover .frame-re { display: flex; }
.frame-scroll { flex: 1; overflow-y: auto; padding: 10px 12px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.dot.ok { background: var(--success); }
.dot.pending {
  background: var(--accent-dark);
  box-shadow: 0 0 0 3px rgba(76, 125, 255, 0.14);
}

/* Prod grid */
.prod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.prod-card {
  display: flex; flex-direction: column; overflow: hidden;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.74), rgba(248,251,255,0.58));
}
.prod-card:hover { transform: translateY(-2px); box-shadow: 0 16px 30px rgba(20, 32, 54, 0.08); }
.prod-cover { position: relative; aspect-ratio: 16/9; background: var(--bg-2); overflow: hidden; }
.prod-cover img { width: 100%; height: 100%; object-fit: cover; }
.prod-video { width: 100%; height: 100%; object-fit: cover; background: #000; display: block; }
.prod-cover-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.prod-idx {
  position: absolute; top: 5px; left: 5px; font-size: 10px; font-weight: 700;
  font-family: var(--font-mono); background: rgba(0,0,0,0.5); color: #fff; padding: 1px 5px; border-radius: 3px;
}
.prod-overlay-badge {
  position: absolute; bottom: 5px; right: 5px; font-size: 10px; font-weight: 600;
  background: var(--success); color: #fff; padding: 1px 5px; border-radius: 3px;
}
.prod-info { padding: 10px 12px 8px; }
.prod-desc { font-size: 12px; line-height: 1.4; }
.prod-meta-line { margin-top: 5px; font-size: 10px; color: var(--text-3); }
.prod-dots { display: flex; align-items: center; gap: 4px; margin-top: 5px; color: var(--text-3); }
.prod-error {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--error);
}
.prod-actions { display: flex; gap: 6px; padding: 8px 10px 10px; border-top: 1px solid rgba(27, 41, 64, 0.08); }
.prod-actions .btn { flex: 1; justify-content: center; }

/* Image viewer */
.image-viewer-overlay {
  z-index: 120;
  padding: 28px;
  background: rgba(18, 24, 34, 0.68);
  backdrop-filter: blur(10px);
}
.image-viewer-dialog {
  width: min(1100px, calc(100vw - 56px));
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,251,255,0.92));
}
.image-viewer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
}
.image-viewer-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-display);
}
.image-viewer-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
  min-height: 0;
}
.image-viewer-img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 140px);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(8, 14, 24, 0.22);
  background: rgba(255,255,255,0.9);
}

/* Manual asset registration */
.manual-asset-overlay {
  z-index: 130;
  padding: 24px;
  background: rgba(18, 24, 34, 0.52);
  backdrop-filter: blur(10px);
}
.manual-asset-dialog {
  width: min(920px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 20px;
}
.manual-asset-head,
.manual-asset-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  flex-shrink: 0;
}
.manual-asset-foot {
  border-bottom: 0;
  border-top: 1px solid rgba(27, 41, 64, 0.08);
}
.manual-asset-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-0);
}
.manual-asset-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-3);
}
.manual-asset-body {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
  gap: 14px;
  padding: 16px;
  overflow: auto;
}
.manual-prompt-panel,
.manual-register-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.manual-prompt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
}
.manual-prompt-text {
  width: 100%;
  min-height: 260px;
  resize: vertical;
  border: 1px solid rgba(27, 41, 64, 0.12);
  border-radius: 8px;
  padding: 10px;
  background: rgba(249, 250, 252, 0.92);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
}
.manual-register-hint {
  padding: 10px;
  border-radius: 8px;
  background: rgba(27, 41, 64, 0.04);
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.5;
}

/* Grid tool dialog */
.grid-tool { width: min(1320px, calc(100vw - 40px)); max-height: calc(100vh - 48px); display: flex; flex-direction: column; overflow: hidden; animation: scaleIn 0.2s var(--ease-out); }
.grid-tool-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.grid-tool-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.grid-tool-body-preview { overflow: hidden; min-height: 0; padding-bottom: 10px; }
.grid-tool-foot { display: flex; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 4px; }
.grid-preview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.72fr) minmax(340px, 400px);
  gap: 14px;
  min-height: 0;
  flex: 1;
  align-items: start;
}
.grid-preview-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grid-assignment-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(27, 41, 64, 0.08);
  border-radius: 18px;
  background: rgba(255,255,255,0.66);
  overflow: hidden;
  max-height: min(70vh, 840px);
}
.grid-assign-head {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.72));
}
.grid-assign-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
  font-family: var(--font-display);
}
.grid-assign-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-3);
}
.grid-assign-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  background: rgba(255,255,255,0.86);
}
.grid-assign-columns {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 96px minmax(0, 1fr);
  gap: 8px;
  padding: 7px 12px;
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
  background: rgba(246, 248, 252, 0.92);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Prompt preview */
.grid-prompt-summary { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; }
.grid-prompt-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
.grid-prompt-text { font-size: 12px; color: var(--text-1); line-height: 1.7; }

.grid-blank-preview {
  display: grid;
  gap: 4px;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  padding: 8px;
  min-height: 200px;
}
.grid-blank-cell {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 70px;
}
.grid-blank-cell.empty { opacity: 0.4; }
.grid-blank-cell-index { font-size: 10px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); }
.grid-blank-cell-desc { font-size: 11px; color: var(--text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.grid-mode-tabs { display: flex; gap: 6px; }
.grid-mode-tab { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius); background: var(--bg-0); cursor: pointer; transition: all 0.15s; text-align: left; }
.grid-mode-tab:hover { border-color: var(--border-strong); }
.grid-mode-tab.active { border-color: var(--accent); background: var(--accent-bg); }
.grid-config { display: flex; gap: 12px; align-items: flex-end; }
.grid-pick-list { display: flex; flex-direction: column; gap: 2px; max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius); padding: 4px; }
.grid-pick-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; }
.grid-pick-item:hover { background: var(--bg-hover); }
.grid-pick-item.selected { background: var(--accent-bg); }
.grid-pick-item input { accent-color: var(--accent); }
.grid-preview-wrap {
  border-radius: var(--radius);
  overflow: auto;
  border: 1px solid var(--border);
  background: rgba(14, 19, 28, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  max-height: min(70vh, 860px);
  padding: 10px;
}
.grid-preview-stage {
  position: relative;
  width: fit-content;
  max-width: 100%;
  margin: auto;
  line-height: 0;
}
.grid-preview-img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: min(66vh, 820px);
  object-fit: contain;
}
.grid-overlay { position: absolute; inset: 0; display: grid; }
.grid-overlay-cell {
  border: 1px dashed rgba(255,255,255,0.42);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 4px 6px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.grid-overlay-cell.active {
  background: rgba(255,255,255,0.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.28);
}
.grid-cell-label { font-size: 10px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.5); padding: 1px 5px; border-radius: 3px; }
.grid-adjust-summary { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 0 2px; }
.grid-assign-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 12px 10px;
}
.grid-assign-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 112px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(27, 41, 64, 0.08);
}
.grid-assign-row.active {
  background: rgba(32, 86, 190, 0.05);
  border-radius: 12px;
  padding-left: 6px;
  padding-right: 6px;
}
.grid-assign-row:last-child { border-bottom: 0; }
.grid-assign-index {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  font-family: var(--font-mono);
}
.grid-assign-bind {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.45;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-history-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px 12px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.64));
}
.grid-history-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.grid-history-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
  font-family: var(--font-display);
}
.grid-history-subtitle {
  font-size: 11px;
  color: var(--text-3);
}
.grid-history-list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(160px, 182px);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.grid-history-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  border-radius: 16px;
  background: rgba(255,255,255,0.78);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.grid-history-item:hover {
  border-color: rgba(33, 88, 255, 0.18);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}
.grid-history-item.active {
  border-color: rgba(33, 88, 255, 0.26);
  background: linear-gradient(180deg, rgba(244,248,255,0.96), rgba(255,255,255,0.86));
  box-shadow: 0 14px 28px rgba(33, 88, 255, 0.12);
}
.grid-history-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  background: rgba(14, 19, 28, 0.05);
}
.grid-history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.grid-history-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.grid-history-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.grid-history-meta {
  font-size: 10.5px;
  color: var(--text-3);
  line-height: 1.45;
  word-break: break-word;
}

.latest-grid-strip {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(27, 41, 64, 0.08);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,255,255,0.62));
}
.latest-grid-strip-thumb {
  width: 72px;
  height: 48px;
  padding: 0;
  border: 1px solid rgba(27, 41, 64, 0.08);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(14, 19, 28, 0.06);
  cursor: zoom-in;
  box-shadow: none;
}
.latest-grid-strip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.latest-grid-strip-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.latest-grid-strip-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.latest-grid-strip-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-0);
  font-family: var(--font-display);
}
.latest-grid-strip-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 10px;
  color: var(--text-3);
}
.latest-grid-strip-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Export */
.export-split { flex: 1; display: flex; min-height: 0; }
.export-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
.export-video { max-width: 720px; width: 100%; border-radius: var(--radius-lg); background: #000; }
.export-bar { display: flex; align-items: center; gap: 12px; margin-top: 16px; width: 100%; max-width: 720px; }
.export-list { width: 240px; flex-shrink: 0; border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.export-list-head { padding: 11px 14px; font-size: 11px; font-weight: 700; color: var(--text-3); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.06em; }
.export-list-body { flex: 1; overflow-y: auto; padding: 6px; }
.exp-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: var(--radius); }
.exp-row:hover { background: var(--bg-hover); }

/* Shared */
.dim { color: var(--text-3); }

@media (max-width: 1240px) {
  .studio-body {
    grid-template-columns: 1fr;
  }

  .studio-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .studio-topbar-side {
    justify-content: space-between;
  }

  .split-layout,
  .export-split {
    flex-direction: column;
  }

  .sidebar {
    max-height: 340px;
  }

  .shot-list,
  .export-list {
    width: 100%;
  }

  .detail-panel {
    min-height: 420px;
  }

  .field-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .image-viewer-overlay {
    padding: 16px;
  }

  .image-viewer-dialog {
    width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
  }

  .grid-tool {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
  }

  .grid-preview-layout {
    grid-template-columns: 1fr;
  }

  .grid-preview-wrap,
  .grid-preview-img {
    max-height: 42vh;
  }

  .grid-assignment-pane {
    max-height: 42vh;
  }

  .grid-assign-columns {
    display: none;
  }

  .grid-assign-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}

@media (max-width: 860px) {
  .studio {
    padding: 12px;
    gap: 12px;
  }

  .studio-topbar-main {
    align-items: flex-start;
  }

  .studio-topbar-side,
  .studio-actions {
    flex-wrap: wrap;
  }

  .toolbar-right,
  .step-bubble,
  .export-bar {
    flex-wrap: wrap;
  }

  .extract-grid,
  .voice-grid,
  .asset-grid,
  .prod-grid {
    grid-template-columns: 1fr;
  }

  .voice-stage {
    grid-template-columns: 1fr;
  }

  .extract-stage {
    grid-template-columns: 1fr;
  }

  .extract-summary {
    position: static;
  }

  .voice-stage-panel {
    position: static;
    max-height: none;
    overflow: visible;
  }

  .frame-row {
    flex-direction: column;
    align-items: stretch;
  }

  .detail-hero {
    grid-template-columns: 1fr;
  }

  .field-grid-2,
  .field-grid-4 {
    grid-template-columns: 1fr;
  }

  .frame-thumbs {
    width: 100%;
  }

  .frame-thumb {
    width: 100%;
  }

  .latest-grid-strip {
    grid-template-columns: 1fr;
  }

  .grid-history-list {
    grid-auto-columns: minmax(148px, 168px);
  }

  .latest-grid-strip-thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }

  .latest-grid-strip-actions {
    justify-content: flex-start;
  }
}
</style>
