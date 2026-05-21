<template>
  <div class="settings-layout">
    <aside class="settings-nav">
      <div class="nav-group">
        <div class="nav-group-label">기본</div>
        <button v-for="t in baseTabs" :key="t.id" :class="['nav-item', { active: tab === t.id }]" @click="tab = t.id">
          <component :is="t.icon" :size="14" />
          {{ t.label }}
        </button>
      </div>
      <div class="nav-advanced">
        <label class="advanced-toggle">
          <span>Agent 고급 설정</span>
          <input type="checkbox" v-model="showAdvanced" />
          <span class="advanced-slider"></span>
        </label>
        <p class="advanced-note">Agent 설정과 Skills만 펼칩니다. 작업대 기능과 스토리보드 필드는 기본으로 표시됩니다.</p>
      </div>
      <div v-if="showAdvanced" class="nav-group">
        <div class="nav-group-label">고급</div>
        <button v-for="t in advancedTabs" :key="t.id" :class="['nav-item', { active: tab === t.id }]" @click="tab = t.id">
          <component :is="t.icon" :size="14" />
          {{ t.label }}
        </button>
      </div>
    </aside>

    <div class="settings-content">

      <!-- ===== AI 서비스 설정 ===== -->
      <div v-if="tab === 'ai'" class="settings-scroll">
        <div class="settings-head">
          <div class="settings-brand">
            <div class="settings-brand-mark">
              <img v-if="showBrandImage" :src="brandLogo" alt="화보 드라마" class="settings-brand-logo" @error="showBrandImage = false" />
              <span v-else class="settings-brand-fallback">화</span>
            </div>
            <div class="settings-brand-copy">
              <div class="settings-brand-kicker">Huobao Shorts</div>
              <div class="settings-brand-name">화보 드라마</div>
            </div>
          </div>
          <h2 class="settings-title">AI 서비스 설정</h2>
          <p class="settings-desc">추천 템플릿으로 빠르게 설정한 뒤 서비스 유형별로 조정하세요. 작업대에서 회차를 만들 때 선택한 이미지, 영상, 오디오 기능이 고정됩니다.</p>
        </div>
        <section class="setup-panel card">
          <div class="setup-panel-head">
            <div>
              <div class="setup-kicker">Quick Setup</div>
              <div class="setup-title">화보추천 설정</div>
              <div class="setup-desc">텍스트, 이미지, 영상, 오디오 네 가지 추천 설정을 한 번에 입력합니다. 기본 시작값으로 적합합니다.</div>
            </div>
            <button class="btn btn-primary" @click="presetDialog = true">
              <Sparkles :size="14" /> 화보한 번에 설정
            </button>
          </div>
          <div class="preset-grid">
            <article v-for="preset in huobaoPresetCards" :key="preset.serviceType" class="preset-card">
              <div class="preset-card-top">
                <span class="preset-service">{{ preset.label }}</span>
                <span class="tag tag-accent">{{ preset.provider }}</span>
              </div>
              <div class="preset-model mono">{{ preset.model }}</div>
              <div class="preset-base mono">{{ preset.baseUrl }}</div>
            </article>
          </div>
        </section>
        <section class="setup-panel card">
          <div class="setup-panel-head compact">
            <div>
              <div class="setup-title">생성 방식</div>
              <div class="setup-desc">API 자동 생성은 저장된 키로 완전 자동 처리합니다. 수동/구독형 모드는 프롬프트를 복사해 외부 서비스에서 생성한 결과를 직접 등록합니다.</div>
            </div>
          </div>
          <div class="generation-mode-box">
            <button :class="['generation-mode-option', generationMode === 'api' && 'active']" @click="setGenerationMode('api')">
              <span class="generation-mode-title">API 자동 생성</span>
              <span class="generation-mode-desc">이미지, 영상, 오디오 provider API 키 사용</span>
            </button>
            <button :class="['generation-mode-option', generationMode === 'manual' && 'active']" @click="setGenerationMode('manual')">
              <span class="generation-mode-title">수동/구독형 생성</span>
              <span class="generation-mode-desc">프롬프트 복사 후 파일/URL 직접 등록</span>
            </button>
          </div>
        </section>
        <section class="setup-panel card">
          <div class="setup-panel-head compact">
            <div>
              <div class="setup-title">빠른 템플릿</div>
              <div class="setup-desc">서비스 유형을 선택하면 추천 `provider / base URL / model`을 템플릿으로 채웁니다.</div>
            </div>
          </div>
          <div class="template-row">
            <button
              v-for="st in serviceTypes"
              :key="st.type"
              class="template-type-chip"
              @click="startAddCfg(st.type)"
            >
              {{ st.label }}
            </button>
          </div>
        </section>
        <div class="sections">
          <section v-for="st in serviceTypes" :key="st.type">
            <div class="section-head">
              <div>
                <span class="section-title">{{ st.label }}</span>
                <div class="section-subtitle">{{ serviceMeta[st.type].desc }}</div>
              </div>
              <span v-if="countActive(st.type)" class="tag tag-accent">{{ countActive(st.type) }} 활성화됨</span>
              <button class="btn btn-ghost btn-sm ml-auto" @click="startAddCfg(st.type)"><Plus :size="13" /> 추가</button>
            </div>
            <div class="config-list">
              <div v-for="c in byType(st.type)" :key="c.id" class="card config-row">
                <div class="config-info">
                  <div class="config-main">
                    <div class="config-line">
                      <span class="config-provider">{{ c.provider }}</span>
                      <span class="config-name">{{ c.name || `${c.provider}-${c.service_type}` }}</span>
                    </div>
                    <span class="config-model mono truncate">{{ fmtModel(c.model) }}</span>
                    <span class="config-base mono truncate">{{ c.base_url || 'Base URL 미설정' }}</span>
                  </div>
                </div>
                <span :class="['tag', c.api_key ? 'tag-success' : 'tag-error']">{{ c.api_key ? '설정됨' : '키 없음' }}</span>
                <button class="btn btn-ghost btn-sm" @click="testExistingCfg(c)">테스트</button>
                <label class="toggle"><input type="checkbox" :checked="c.is_active" @change="toggleCfg(c)"><span /></label>
                <button class="btn btn-ghost btn-icon" @click="startEditCfg(c)"><Pencil :size="13" /></button>
                <button class="btn btn-ghost btn-icon" @click="delCfg(c.id)"><Trash2 :size="13" /></button>
              </div>
              <p v-if="!byType(st.type).length" class="config-empty">설정 없음</p>
            </div>
          </section>
        </div>
      </div>

      <!-- ===== Agent 설정 ===== -->
      <div v-else-if="tab === 'agents'" class="settings-scroll">
        <div class="settings-head">
          <div class="settings-brand">
            <div class="settings-brand-mark">
              <img v-if="showBrandImage" :src="brandLogo" alt="화보 드라마" class="settings-brand-logo" @error="showBrandImage = false" />
              <span v-else class="settings-brand-fallback">화</span>
            </div>
            <div class="settings-brand-copy">
              <div class="settings-brand-kicker">Huobao Shorts</div>
              <div class="settings-brand-name">화보 드라마</div>
            </div>
          </div>
          <h2 class="settings-title">Agent 설정</h2>
          <p class="settings-desc">고급 영역에는 Agent 실행 설정만 둡니다. 여기서 모델, 프롬프트, 파라미터를 조정할 수 있고 저장 즉시 적용됩니다.</p>
        </div>
        <div class="agent-list">
          <div v-for="a in agentDefs" :key="a.type" class="card agent-card">
            <div class="agent-card-head" @click="toggleAgentEdit(a.type)">
              <div class="agent-type-badge">{{ a.icon }}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px">{{ a.label }}</div>
                <div class="dim" style="font-size:12px">{{ a.type }}</div>
              </div>
              <span v-if="getAgentCfg(a.type)" class="tag tag-success">설정됨</span>
              <span v-else class="tag">기본값</span>
              <ChevronDown :size="14" :style="{ transform: editingAgent === a.type ? 'rotate(180deg)' : '', transition: '0.2s' }" />
            </div>
            <div v-if="editingAgent === a.type" class="agent-card-body">
              <label class="field">
                <span class="field-label">모델 <span class="dim">(비워 두면 AI 서비스 기본값 사용)</span></span>
                <BaseSelect v-model="agentForm.model" :options="textModelSelectOptions" placeholder="— AI 서비스 기본값 사용 —" searchable />
              </label>
              <div class="field-row">
                <label class="field">
                  <span class="field-label">Temperature</span>
                  <input v-model.number="agentForm.temperature" class="input" type="number" min="0" max="2" step="0.1" />
                </label>
                <label class="field">
                  <span class="field-label">Max Tokens</span>
                  <input v-model.number="agentForm.max_tokens" class="input" type="number" min="100" max="32000" />
                </label>
              </div>
              <label class="field">
                <span class="field-label">System Prompt</span>
                <textarea v-model="agentForm.system_prompt" class="textarea" rows="12" placeholder="Agent 시스템 프롬프트..." />
              </label>
              <div class="agent-card-foot">
                <button class="btn btn-ghost btn-sm" @click="resetAgentPrompt(a.type)">기본값 복원</button>
                <span v-if="agentSaved === a.type" class="tag tag-success" style="margin-left:8px">
                  <Check :size="10" /> 저장됨
                </span>
                <button class="btn btn-primary btn-sm ml-auto" :disabled="agentSaving" @click="saveAgentCfg(a.type)">
                  <Loader2 v-if="agentSaving" :size="12" class="animate-spin" />
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Skills 편집 ===== -->
      <div v-else-if="tab === 'skills'" class="skills-layout">
        <!-- Agent 왼쪽 목록 -->
        <aside class="skills-agent-list">
          <div class="skills-agent-title">Agent 목록</div>
          <button
            v-for="a in agentDefs"
            :key="a.type"
            :class="['skills-agent-item', { active: selectedAgent === a.type }]"
            @click="selectAgent(a.type)"
          >
            <span class="agent-type-badge">{{ a.icon }}</span>
            <span class="skills-agent-label">{{ a.label }}</span>
            <span v-if="agentSkillCount(a.type) > 0" class="skill-count-badge">{{ agentSkillCount(a.type) }}</span>
          </button>
        </aside>

        <!-- Skill 관리 영역 -->
        <div class="settings-scroll skills-main">
          <div class="settings-head">
            <div class="settings-brand">
              <div class="settings-brand-mark">
                <img v-if="showBrandImage" :src="brandLogo" alt="화보 드라마" class="settings-brand-logo" @error="showBrandImage = false" />
                <span v-else class="settings-brand-fallback">화</span>
              </div>
              <div class="settings-brand-copy">
                <div class="settings-brand-kicker">Huobao Shorts</div>
                <div class="settings-brand-name">화보 드라마</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="agent-type-badge" style="width:32px;height:32px;font-size:16px">{{ selectedAgentIcon }}</span>
              <div>
                <h2 class="settings-title" style="margin:0">{{ selectedAgentLabel }}</h2>
                <div class="dim" style="font-size:12px">{{ selectedAgentType }} — Skills</div>
              </div>
            </div>
            <p class="settings-desc" style="margin-top:10px">Skills는 Agent의 고급 프롬프트 레이어로만 사용되며 작업대의 일반 기능 진입에는 영향을 주지 않습니다.</p>
            <button class="btn btn-primary btn-sm" @click="startAddSkill">
              <Plus :size="13" /> Skill 추가
            </button>
          </div>

          <!-- Skill 없음 안내 -->
          <div v-if="!currentSkills.length" class="step-empty" style="padding:48px 24px">
            <div class="empty-visual">
              <FileText :size="28" />
            </div>
            <div class="empty-title">Skill 없음</div>
            <div class="empty-desc">오른쪽 위의 「Skill 추가」를 눌러 첫 프롬프트 파일을 만드세요</div>
          </div>

          <!-- Skill 목록 -->
          <div class="skill-list" v-else>
            <div v-for="s in currentSkills" :key="s.id" class="card skill-card">
              <div class="skill-card-head" @click="toggleSkillEdit(s.id)">
                <FileText :size="14" style="color:var(--accent);flex-shrink:0" />
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:13px">{{ s.name }}</div>
                  <div class="dim" style="font-size:11px">{{ s.description }}</div>
                </div>
                <button class="btn btn-ghost btn-icon" style="margin-right:4px" @click.stop="deleteSkill(s.id)">
                  <Trash2 :size="13" />
                </button>
                <ChevronDown :size="14" :style="{ transform: editingSkill === s.id ? 'rotate(180deg)' : '', transition: '0.2s' }" />
              </div>
              <div v-if="editingSkill === s.id" class="skill-card-body">
                <textarea
                  v-model="skillContent"
                  class="textarea mono"
                  rows="20"
                  style="font-size:12px;line-height:1.6"
                  placeholder="SKILL.md 내용 작성..."
                />
                <div class="skill-card-foot">
                  <span class="dim" style="font-size:11px">skills/{{ selectedAgentType }}/{{ s.id }}/SKILL.md</span>
                  <span v-if="skillSaved === s.id" class="tag tag-success" style="margin-left:8px">
                    <Check :size="10" /> 저장됨
                  </span>
                  <button class="btn btn-primary btn-sm ml-auto" :disabled="skillSaving" @click="saveSkill(s.id)">
                    <Loader2 v-if="skillSaving" :size="12" class="animate-spin" />
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Config Dialog -->
    <div v-if="cfgDialog" class="overlay" @click.self="cfgDialog = false">
      <form class="modal card config-modal" @submit.prevent="saveCfg">
        <div class="config-modal-head">
          <div>
            <div class="setup-kicker">{{ cfgEditId ? 'Edit Config' : 'New Config' }}</div>
            <h2 class="modal-title">{{ cfgEditId ? '서비스 설정 편집' : `추가${serviceMeta[cfgForm.service_type].label}서비스` }}</h2>
            <div class="modal-note">먼저 템플릿을 선택하면 더 적절한 `Base URL`과 기본 모델이 자동 입력됩니다.</div>
          </div>
          <span class="tag tag-accent">{{ serviceMeta[cfgForm.service_type].label }}</span>
        </div>
        <div class="preset-picker">
          <button
            v-for="preset in presetsByType(cfgForm.service_type)"
            :key="`${cfgForm.service_type}-${preset.provider}`"
            type="button"
            class="preset-pill"
            @click="applyProviderPreset(cfgForm.service_type, preset.provider)"
          >
            {{ preset.label }}
          </button>
        </div>
        <label class="field">
          <span class="field-label">설정 이름</span>
          <input v-model="cfgForm.name" class="input" placeholder="예: 화보 기본 이미지 서비스" />
        </label>
        <label class="field"><span class="field-label">서비스 제공자</span>
          <BaseSelect v-model="cfgForm.provider" :options="providerSelectOptions" placeholder="서비스 제공자 선택" searchable />
        </label>
        <label class="field">
          <span class="field-label">우선순위</span>
          <input v-model.number="cfgForm.priority" class="input" type="number" min="0" max="999" />
          <span class="field-hint">숫자가 높을수록 우선됩니다. 작업대는 같은 유형의 활성 설정 중 우선순위가 가장 높은 항목을 기본 사용합니다.</span>
        </label>
        <label class="field"><span class="field-label">API Key <span class="dim" v-if="cfgEditId">(비워 두면 기존 키 유지)</span></span><input v-model="cfgForm.api_key" class="input" type="password" placeholder="새 키를 입력하거나 비워 두세요" /></label>
        <label class="field"><span class="field-label">Base URL</span><input v-model="cfgForm.base_url" class="input" placeholder="https://..." /></label>
        <div class="endpoint-hint">
          <span class="dim">실제 엔드포인트 접두사:</span>
          <span class="mono">{{ endpointHint }}</span>
        </div>
        <label class="field"><span class="field-label">모델(쉼표로 구분)</span><input v-model="cfgForm.modelStr" class="input" placeholder="model-name" /></label>
        <div v-if="cfgTestResult" class="test-result" :class="{ ok: cfgTestResult.reachable, bad: !cfgTestResult.reachable }">
          <div class="test-result-head">
            <span class="tag" :class="cfgTestResult.reachable ? 'tag-success' : 'tag-error'">{{ cfgTestResult.status || 'ERROR' }}</span>
            <span>{{ cfgTestResult.message }}</span>
          </div>
          <div class="mono test-result-url">{{ cfgTestResult.method }} {{ cfgTestResult.url }}</div>
          <div v-if="cfgTestResult.response_preview" class="mono test-result-preview">{{ cfgTestResult.response_preview }}</div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" :disabled="cfgTesting" @click="testDraftCfg">
            <Loader2 v-if="cfgTesting" :size="12" class="animate-spin" />
            <span v-else>설정 테스트</span>
          </button>
          <button type="button" class="btn" @click="cfgDialog = false">취소</button>
          <button type="submit" class="btn btn-primary">저장</button>
        </div>
      </form>
    </div>

    <!-- Huobao Preset Dialog -->
    <div v-if="presetDialog" class="overlay" @click.self="presetDialog = false">
      <form class="modal card config-modal" @submit.prevent="applyHuobaoPreset">
        <div class="config-modal-head">
          <div>
            <div class="setup-kicker">Huobao Preset</div>
            <h2 class="modal-title">화보한 번에 설정</h2>
            <div class="modal-note">화보 추천 경로에 따라 서비스 설정 4개를 자동 생성 또는 업데이트하고 5개 Agent의 기본 모델도 함께 초기화합니다.</div>
          </div>
          <span class="tag tag-success">추천</span>
        </div>
        <div class="huobao-grid">
          <label class="field">
            <span class="field-label">Huobao API Key <span class="dim">(텍스트 / 이미지 / 영상 / 오디오 공통 사용)</span></span>
            <input v-model="huobaoForm.apiKey" class="input" type="password" placeholder="api.chatfire.site 전체 서비스에 사용" />
            <span class="field-hint">아직 계정이 없나요?<a href="https://api.chatfire.site/" target="_blank" rel="noopener">지금 가입 →</a></span>
          </label>
        </div>
        <div class="preset-grid compact">
          <article v-for="preset in huobaoPresetCards" :key="`${preset.serviceType}-${preset.provider}`" class="preset-card">
            <div class="preset-card-top">
              <span class="preset-service">{{ preset.label }}</span>
              <span class="tag tag-accent">{{ preset.provider }}</span>
            </div>
            <div class="preset-model mono">{{ preset.model }}</div>
            <div class="preset-base mono">{{ preset.baseUrl }}</div>
          </article>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" @click="presetDialog = false">취소</button>
          <button type="submit" class="btn btn-primary">생성하고 활성화</button>
        </div>
      </form>
    </div>

    <!-- Add Skill Dialog -->
    <div v-if="addSkillDialog" class="overlay" @click.self="addSkillDialog = false">
      <form class="modal card" @submit.prevent="confirmAddSkill">
        <h2 class="modal-title">Skill 추가 — {{ selectedAgentLabel }}</h2>
        <label class="field">
          <span class="field-label">Skill 디렉터리 이름 <span class="dim">(영문, 고유값)</span></span>
          <input v-model="newSkillForm.id" class="input" placeholder="예: custom-extraction" />
        </label>
        <label class="field">
          <span class="field-label">이름</span>
          <input v-model="newSkillForm.name" class="input" placeholder="예: 사용자 지정 추출 규칙" />
        </label>
        <label class="field">
          <span class="field-label">설명</span>
          <input v-model="newSkillForm.description" class="input" placeholder="이 Skill의 용도를 짧게 설명하세요" />
        </label>
        <div class="modal-actions">
          <button type="button" class="btn" @click="addSkillDialog = false">취소</button>
          <button type="submit" class="btn btn-primary" :disabled="!newSkillForm.id">생성</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { Plus, Pencil, Trash2, FileText, ChevronDown, Check, Loader2, Bot, Cpu, Sparkles } from 'lucide-vue-next'
import BaseSelect from '~/components/BaseSelect.vue'
import { toast } from 'vue-sonner'
import { aiConfigAPI, agentConfigAPI, skillsAPI } from '~/composables/useApi'
import brandLogo from '~/assets/huobao-logo.png'

const showBrandImage = ref(true)
const tab = ref('ai')
const showAdvanced = ref(false)
const GENERATION_MODE_KEY = 'huobao:generation-mode'
const generationMode = ref('api')
const baseTabs = [
  { id: 'ai', label: 'AI 서비스', icon: Cpu },
]
const advancedTabs = [
  { id: 'agents', label: 'Agent 설정', icon: Bot },
  { id: 'skills', label: 'Skills', icon: FileText },
]
watch(showAdvanced, (v) => {
  if (!v && tab.value !== 'ai') tab.value = 'ai'
})

function setGenerationMode(mode) {
  generationMode.value = mode
  if (import.meta.client) localStorage.setItem(GENERATION_MODE_KEY, mode)
  toast.success(mode === 'api' ? 'API 자동 생성 모드로 설정했습니다' : '수동/구독형 생성 모드로 설정했습니다')
}

// ===== AI Service Configs =====
const cfgs = ref([])
const cfgDialog = ref(false)
const cfgEditId = ref(null)
const presetDialog = ref(false)
const cfgTesting = ref(false)
const cfgTestResult = ref(null)
const cfgForm = reactive({ name: '', provider: '', api_key: '', base_url: '', modelStr: '', service_type: 'text', priority: 0 })
const huobaoForm = reactive({ apiKey: '' })
const serviceTypes = [{ type: 'text', label: '텍스트' }, { type: 'image', label: '이미지' }, { type: 'video', label: '영상' }, { type: 'audio', label: '오디오' }]
const providers = ['ali', 'chatfire', 'gemini', 'minimax', 'openai', 'openrouter', 'vidu', 'volcengine']
const providerSelectOptions = computed(() => providers.map(p => ({ label: p, value: p })))
const serviceMeta = {
  text: { label: '텍스트', desc: '극본 수정, 캐릭터/장면 추출, 스토리보드 분해 등 Agent 텍스트 기능' },
  image: { label: '이미지', desc: '캐릭터, 장면, 샷 이미지와 첫/끝 프레임 등 정적 이미지 생성' },
  video: { label: '영상', desc: '샷 영상 생성. 단일 이미지, 다중 이미지, 첫/끝 프레임 모드를 지원합니다.' },
  audio: { label: '오디오', desc: '캐릭터 미리듣기, 내레이션, 대사 음성 생성' },
}
const providerPresets = {
  text: {
    chatfire: { label: 'ChatFire 추천', baseUrl: 'https://api.chatfire.site', models: ['gemini-3-pro-preview'] },
    openrouter: { label: 'OpenRouter 추천', baseUrl: 'https://openrouter.ai/api', models: ['google/gemini-3-flash-preview'] },
    openai: { label: 'OpenAI 추천', baseUrl: 'https://api.openai.com', models: ['gpt-4.1-mini'] },
  },
  image: {
    chatfire: { label: 'ChatFire 추천', baseUrl: 'https://api.chatfire.site', models: ['doubao-seedream-4-5-251128'] },
    gemini: { label: 'Gemini 추천', baseUrl: 'https://api.chatfire.site', models: ['gemini-3-pro-image-preview'] },
    volcengine: { label: '화산엔진 추천', baseUrl: 'https://ark.cn-beijing.volces.com', models: ['doubao-seedream-4-0-250828'] },
  },
  video: {
    volcengine: { label: '화보영상', baseUrl: 'https://api.chatfire.site/volcengine', models: ['doubao-seedance-1-5-pro-251215'] },
    vidu: { label: 'Vidu 추천', baseUrl: 'https://api.vidu.com', models: ['viduq3-turbo'] },
    ali: { label: '알리 추천', baseUrl: 'https://dashscope.aliyuncs.com', models: ['wan2.6-i2v-flash'] },
  },
  audio: {
    minimax: { label: '화보오디오', baseUrl: 'https://api.chatfire.site/minimax', models: ['speech-2.8-hd'] },
    gemini: { label: 'Gemini TTS', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-3.1-flash-tts-preview'] },
  },
}
const huobaoPresetCards = [
  { serviceType: 'text', label: '텍스트', provider: 'chatfire', baseUrl: 'https://api.chatfire.site', model: 'gemini-3-pro-preview', priority: 100 },
  { serviceType: 'image', label: '이미지', provider: 'gemini', baseUrl: 'https://api.chatfire.site', model: 'gemini-3-pro-image-preview', priority: 99 },
  { serviceType: 'video', label: '영상', provider: 'volcengine', baseUrl: 'https://api.chatfire.site/volcengine', model: 'doubao-seedance-1-5-pro-251215', priority: 98 },
  { serviceType: 'audio', label: '오디오', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.1-flash-tts-preview', priority: 97 },
]
const endpointPrefixes = {
  chatfire: '/v1',
  openai: '/v1',
  openrouter: '/v1',
  minimax: '/v1',
  gemini: '/v1beta',
  volcengine: '/api/v3',
  ali: '/api/v1',
  vidu: '/ent/v2',
}

const endpointHint = computed(() => {
  const provider = cfgForm.provider
  const base = cfgForm.base_url || 'https://...'
  const prefix = endpointPrefixes[provider] || ''
  if (!provider) return '서비스 제공자를 선택하면 추천 엔드포인트 접두사가 표시됩니다'
  return `${base}${prefix}`
})

function byType(t) { return cfgs.value.filter(c => c.service_type === t) }
function countActive(t) { return byType(t).filter(c => c.is_active).length }
function fmtModel(m) { return Array.isArray(m) ? m.join(', ') : m || '—' }
function presetsByType(type) {
  const group = providerPresets[type] || {}
  return Object.entries(group).map(([provider, preset]) => ({ provider, ...preset }))
}
function applyProviderPreset(type, provider) {
  const preset = providerPresets[type]?.[provider]
  if (!preset) return
  cfgForm.provider = provider
  cfgForm.base_url = preset.baseUrl
  cfgForm.modelStr = preset.models.join(', ')
  cfgForm.name = `${preset.label}-${serviceMeta[type].label}`
}

async function loadCfgs() { try { cfgs.value = await aiConfigAPI.list() } catch (e) { toast.error(e.message) } }
async function toggleCfg(c) { await aiConfigAPI.update(c.id, { is_active: !c.is_active }); loadCfgs() }
async function delCfg(id) { await aiConfigAPI.del(id); toast.success('삭제됨'); loadCfgs() }
function startAddCfg(t) {
  cfgEditId.value = null
  cfgTestResult.value = null
  Object.assign(cfgForm, { name: '', provider: '', api_key: '', base_url: '', modelStr: '', service_type: t, priority: 0 })
  const firstPreset = presetsByType(t)[0]
  if (firstPreset) applyProviderPreset(t, firstPreset.provider)
  cfgDialog.value = true
}
function startEditCfg(c) {
  cfgEditId.value = c.id
  cfgTestResult.value = null
  Object.assign(cfgForm, {
    name: c.name || '',
    provider: c.provider,
    api_key: '',
    base_url: c.base_url || '',
    modelStr: fmtModel(c.model),
    service_type: c.service_type,
    priority: c.priority ?? 0,
  })
  cfgDialog.value = true
}
async function testCfgPayload(payload) {
  cfgTesting.value = true
  try {
    cfgTestResult.value = await aiConfigAPI.test(payload)
    if (cfgTestResult.value.reachable) toast.success('엔드포인트가 응답했습니다')
    else toast.warning('엔드포인트 테스트를 통과하지 못했습니다')
  } catch (e) {
    toast.error(e.message)
  } finally {
    cfgTesting.value = false
  }
}
async function testDraftCfg() {
  await testCfgPayload({
    service_type: cfgForm.service_type,
    provider: cfgForm.provider,
    api_key: cfgForm.api_key,
    base_url: cfgForm.base_url,
    model: cfgForm.modelStr.split(',').map(s => s.trim()).filter(Boolean),
  })
}
async function testExistingCfg(c) {
  startEditCfg(c)
  await testCfgPayload({
    service_type: c.service_type,
    provider: c.provider,
    api_key: '',
    base_url: c.base_url || '',
    model: Array.isArray(c.model) ? c.model : [],
  })
}
async function saveCfg() {
  if (!cfgForm.provider) { toast.warning('서비스 제공자 선택'); return }
  const models = cfgForm.modelStr.split(',').map(s => s.trim()).filter(Boolean)
  try {
    if (cfgEditId.value) {
      const payload = { name: cfgForm.name, provider: cfgForm.provider, base_url: cfgForm.base_url, model: models, priority: cfgForm.priority }
      if (cfgForm.api_key.trim()) payload.api_key = cfgForm.api_key.trim()
      await aiConfigAPI.update(cfgEditId.value, payload)
    }
    else await aiConfigAPI.create({ service_type: cfgForm.service_type, provider: cfgForm.provider, name: cfgForm.name || `${cfgForm.provider}-${cfgForm.service_type}`, api_key: cfgForm.api_key, base_url: cfgForm.base_url, model: models, priority: cfgForm.priority })
    cfgDialog.value = false; toast.success('저장됨'); loadCfgs()
  } catch (e) { toast.error(e.message) }
}
async function applyHuobaoPreset() {
  if (!huobaoForm.apiKey) {
    toast.warning('Huobao API Key를 입력하세요')
    return
  }
  try {
    await aiConfigAPI.huobaoPreset(huobaoForm.apiKey)
    await loadCfgs()
    await loadAgents()
    presetDialog.value = false
    toast.success('화보추천 설정과 기본 Agent LLM이 저장되었습니다')
  } catch (e) {
    toast.error(e.message)
  }
}

// ===== Agent Configs =====
const agentCfgs = ref([])
const editingAgent = ref(null)
const agentSaving = ref(false)
const agentSaved = ref(null)
const agentForm = reactive({ model: '', temperature: 0.7, max_tokens: 4096, system_prompt: '' })

const agentDefs = [
  { type: 'script_rewriter', label: '극본 수정', icon: '📝' },
  { type: 'extractor', label: '캐릭터/장면 추출', icon: '🔍' },
  { type: 'storyboard_breaker', label: '스토리보드 분해', icon: '🎬' },
  { type: 'voice_assigner', label: '음색 배정', icon: '🎙' },
  { type: 'grid_prompt_generator', label: '이미지 프롬프트 생성', icon: '🖼' },
]

const defaultPrompts = {
  script_rewriter: `당신은 소설을 숏폼 드라마 극본으로 각색하는 데 능한 전문 작가입니다.

작업 흐름:
1. read_episode_script를 호출해 원본 내용을 읽습니다.
2. 읽은 내용을 직접 형식화된 극본으로 수정합니다.
3. save_script를 호출해 수정된 전체 극본을 저장합니다.

형식화된 극본 형식:
- 장면 헤더: ## S번호 | 실내/실외 · 장소 | 시간대
- 동작 묘사：자연스러운 문단, 카메라 언어 제외
- 대사: 캐릭터명: (상태/표정) 대사 내용
- 각 장면은 30-60초 분량`,
  extractor: `당신은 극본에서 캐릭터와 장면 정보를 추출하고 프로젝트 기존 데이터와 지능적으로 중복 제거하는 데 능한 제작 조수입니다.

작업 흐름:
1. read_script_for_extraction을 호출해 형식화된 극본을 읽습니다.
2. read_existing_characters로 프로젝트의 기존 캐릭터 목록을 읽어 중복 제거 기준으로 삼습니다.
3. read_existing_scenes로 프로젝트의 기존 장면 목록을 읽어 중복 제거 기준으로 삼습니다.
4. 극본을 분석해 모든 캐릭터 정보를 추출합니다.
5. 캐릭터별로 같은 이름이 있으면 병합 업데이트하고, 없으면 새로 추가합니다.
6. save_dedup_characters를 호출해 캐릭터를 저장합니다.
7. 극본을 분석해 모든 장면 정보를 추출합니다.
8. 장면별로 같은 장소와 시간대가 있으면 재사용하고, 없으면 새로 추가합니다.
9. save_dedup_scenes를 호출해 장면을 저장합니다.

중복 제거 규칙:
- 캐릭터: 이름을 정확히 비교하고 같은 이름은 기존 항목에 병합합니다.
- 장면: 장소와 시간대를 함께 정확히 비교하며 같은 장소라도 시간대가 다르면 새 장면으로 봅니다.

추출 요구사항:
- 캐릭터에는 헤어스타일, 의상, 체형 등 외형 특징을 충분히 포함합니다.
- 장면에는 빛, 색감, 분위기 같은 시각 정보를 포함합니다.
- 대사나 중요한 행동이 있는 캐릭터를 누락하지 마세요`,
  storyboard_breaker: `당신은 극본을 스토리보드 계획으로 분해하는 데 능한 시니어 영상 스토리보드 아티스트입니다.

작업 흐름:
1. read_storyboard_context를 호출해 극본, 캐릭터 목록, 장면 목록을 읽습니다.
2. 극본을 샷 순서로 분해합니다. 각 샷은 10-15초를 권장합니다.
3. 각 샷에 video_prompt를 포함한 영상 생성 프롬프트를 작성합니다.
4. save_storyboards를 호출해 모든 스토리보드를 저장합니다.`,
  voice_assigner: `당신은 캐릭터에 어울리는 음색을 고르는 데 능한 더빙 디렉터입니다.

작업 흐름:
1. list_voices를 호출해 사용 가능한 음색 목록을 가져옵니다.
2. get_characters를 호출해 모든 캐릭터 정보를 가져옵니다.
3. 캐릭터별 성별, 성격, 나이, 역할을 기준으로 가장 잘 맞는 음색을 고릅니다.
4. 각 캐릭터에 assign_voice를 호출해 음색을 배정하고 선택 이유를 설명합니다.

주의：모든 캐릭터에 반드시 음색을 배정하고 누락하지 마세요.`,
  grid_prompt_generator: `당신은 캐릭터, 장면, 그리드 이미지를 위한 고품질 영어 프롬프트를 만드는 전문 AI 이미지 프롬프트 엔지니어입니다.

사용자의 요청에 따라 다음 유형의 프롬프트를 생성합니다:
- "캐릭터" → 캐릭터 이미지 프롬프트
- "장면" → 장면 이미지 프롬프트
- "그리드" → 생성그리드 이미지 프롬프트

## 캐릭터 이미지 프롬프트

작업 흐름:
1. read_characters를 호출해 모든 캐릭터 정보를 읽습니다.
2. 외형(appearance), 성격(personality), 역할(role)을 기준으로 영어 프롬프트를 생성합니다.
3. 프롬프트 구조: [외형 설명], [성격/분위기], [역할], [영화적], [고품질], [문자/워터마크 없음]

## 장면 이미지 프롬프트

작업 흐름:
1. read_scenes를 호출해 모든 장면 정보를 읽습니다.
2. 장소(location), 시간대(time), 기존 설명(prompt)을 기준으로 영어 프롬프트를 생성합니다.
3. 프롬프트 구조: [장소], [시간/빛/분위기], [기존 설명], [영화적 장면], [고품질], [문자/워터마크 없음]

## 그리드 이미지 프롬프트（참조 skills/grid-image-generator/SKILL.md）

작업 흐름:
1. read_shots_for_grid를 호출해 선택한 샷의 상세 정보를 읽습니다.
2. mode에 따라 generate_grid_prompt를 호출합니다.
   - first_frame 모드: 각 칸은 한 샷의 첫 프레임이며 NxN 스타일을 통일합니다.
   - first_last 모드: 각 샷은 2칸을 사용하며 왼쪽은 첫 프레임, 오른쪽은 끝 프레임입니다.
   - multi_ref 모드: 모든 칸은 같은 샷의 서로 다른 참조 각도입니다.
3. grid_prompt(전체 프롬프트)와 cell_prompts(칸별 프롬프트)를 반환합니다.

프롬프트 규칙:
- 영어 프롬프트 사용
- "consistent art style"을 포함해 스타일 일관성을 유지합니다.
- 반드시 포함 "cinematic quality"
- 문자나 워터마크가 나오지 않게 하세요`,
}

function getAgentCfg(type) {
  return agentCfgs.value.find(a => a.agent_type === type)
}

const textModelGroups = computed(() => {
  return cfgs.value
    .filter(c => c.service_type === 'text' && c.is_active && c.api_key)
    .map(c => ({
      label: `${c.provider} — ${c.name}`,
      models: Array.isArray(c.model) ? c.model : (c.model ? [c.model] : []),
    }))
    .filter(g => g.models.length > 0)
})

const textModelSelectOptions = computed(() =>
  textModelGroups.value.map(g => ({
    label: g.label,
    options: g.models.map(m => ({ label: m, value: m })),
  }))
)

async function loadAgents() {
  try { agentCfgs.value = await agentConfigAPI.list() }
  catch (e) { toast.error(e.message) }
}

function toggleAgentEdit(type) {
  if (editingAgent.value === type) { editingAgent.value = null; return }
  const cfg = getAgentCfg(type)
  agentForm.model = cfg?.model || ''
  agentForm.temperature = cfg?.temperature ?? 0.7
  agentForm.max_tokens = cfg?.max_tokens ?? 4096
  agentForm.system_prompt = cfg?.system_prompt || defaultPrompts[type] || ''
  agentSaved.value = null
  editingAgent.value = type
}

function resetAgentPrompt(type) {
  agentForm.system_prompt = defaultPrompts[type] || ''
  toast.info('기본 프롬프트를 복원했습니다. 저장하면 적용됩니다.')
}

async function saveAgentCfg(type) {
  agentSaving.value = true
  agentSaved.value = null
  try {
    const existing = getAgentCfg(type)
    const data = {
      agent_type: type,
      name: agentDefs.find(a => a.type === type)?.label || type,
      model: agentForm.model,
      temperature: agentForm.temperature,
      max_tokens: agentForm.max_tokens,
      system_prompt: agentForm.system_prompt,
    }
    if (existing) {
      await agentConfigAPI.update(existing.id, data)
    } else {
      await agentConfigAPI.create(data)
    }
    await loadAgents()
    agentSaved.value = type
    toast.success(`${agentDefs.find(a => a.type === type)?.label} 설정이 저장되었습니다`)
    setTimeout(() => { if (agentSaved.value === type) agentSaved.value = null }, 3000)
  } catch (e) {
    toast.error(e.message)
  } finally {
    agentSaving.value = false
  }
}

// ===== Skills =====
const selectedAgent = ref('script_rewriter')
const allSkills = ref([])   // { id, name, description }[]
const editingSkill = ref(null)
const skillContent = ref('')
const skillSaving = ref(false)
const skillSaved = ref(null)
const addSkillDialog = ref(false)
const newSkillForm = reactive({ id: '', name: '', description: '' })

const selectedAgentType = computed(() => selectedAgent.value)
const selectedAgentLabel = computed(() => agentDefs.find(a => a.type === selectedAgent.value)?.label || '')
const selectedAgentIcon = computed(() => agentDefs.find(a => a.type === selectedAgent.value)?.icon || '')

function agentSkillCount(type) {
  return allSkills.value.filter(s => s.id === type || s.id.startsWith(type + '/')).length
}

const currentSkills = computed(() =>
  allSkills.value.filter(s => s.id === selectedAgent.value || s.id.startsWith(selectedAgent.value + '/'))
)

async function loadAllSkills() {
  try { allSkills.value = await skillsAPI.list() }
  catch (e) { toast.error(e.message) }
}

async function selectAgent(type) {
  selectedAgent.value = type
  editingSkill.value = null
}

function startAddSkill() {
  newSkillForm.id = ''
  newSkillForm.name = ''
  newSkillForm.description = ''
  addSkillDialog.value = true
}

async function confirmAddSkill() {
  if (!newSkillForm.id) return
  const skillId = `${selectedAgent.value}/${newSkillForm.id}`
  try {
    await skillsAPI.create({ id: skillId, name: newSkillForm.name, description: newSkillForm.description })
    addSkillDialog.value = false
    await loadAllSkills()
    toast.success('Skill이 생성되었습니다')
  } catch (e) {
    toast.error(e.message)
  }
}

async function deleteSkill(id) {
  if (!confirm(`정말 삭제할까요 Skill「${id}」？`)) return
  try {
    await skillsAPI.del(id)
    if (editingSkill.value === id) editingSkill.value = null
    await loadAllSkills()
    toast.success('삭제됨')
  } catch (e) {
    toast.error(e.message)
  }
}

async function toggleSkillEdit(id) {
  if (editingSkill.value === id) { editingSkill.value = null; return }
  try {
    const res = await skillsAPI.get(id)
    skillContent.value = res.content
    skillSaved.value = null
    editingSkill.value = id
  } catch (e) { toast.error(e.message) }
}

async function saveSkill(id) {
  skillSaving.value = true
  skillSaved.value = null
  try {
    await skillsAPI.update(id, skillContent.value)
    await loadAllSkills()
    skillSaved.value = id
    toast.success(`저장됨`)
    setTimeout(() => { if (skillSaved.value === id) skillSaved.value = null }, 3000)
  } catch (e) {
    toast.error(e.message)
  } finally {
    skillSaving.value = false
  }
}

onMounted(() => {
  generationMode.value = localStorage.getItem(GENERATION_MODE_KEY) || 'api'
  loadCfgs(); loadAgents(); loadAllSkills()
})
</script>

<style scoped>
.settings-layout { display: flex; height: 100%; background: var(--bg-base); }

.settings-nav {
  width: 220px; flex-shrink: 0; padding: 16px 10px; border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 14px; background: var(--bg-1);
}
.nav-group { display: flex; flex-direction: column; gap: 4px; }
.nav-group-label {
  font-size: 10px; font-weight: 700; color: var(--text-3);
  letter-spacing: 0.12em; text-transform: uppercase; padding: 0 10px 4px;
}
.nav-item {
  display: flex; align-items: center; gap: 8px; padding: 9px 12px; font-size: 13px;
  border: none; background: none; color: var(--text-2); cursor: pointer;
  border-radius: var(--radius); transition: all 0.12s; text-align: left; width: 100%;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-0); }
.nav-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 600; box-shadow: var(--shadow-card); }
.nav-advanced {
  padding: 12px 8px;
  border-top: 1px solid rgba(27, 41, 64, 0.08);
  border-bottom: 1px solid rgba(27, 41, 64, 0.08);
}
.advanced-toggle {
  display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 10px;
  font-size: 12px; color: var(--text-2);
}
.advanced-toggle input { display: none; }
.advanced-slider {
  position: relative; width: 38px; height: 22px; border-radius: 999px;
  background: rgba(27, 41, 64, 0.12); transition: background 0.18s ease;
}
.advanced-slider::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(18, 24, 38, 0.18); transition: transform 0.18s ease;
}
.advanced-toggle input:checked + .advanced-slider { background: var(--accent); }
.advanced-toggle input:checked + .advanced-slider::after { transform: translateX(16px); }
.advanced-note {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
}

.settings-content { flex: 1; overflow: hidden; }
.settings-scroll { height: 100%; overflow-y: auto; padding: 36px 48px; max-width: 840px; margin: 0 auto; animation: fadeUp 0.3s var(--ease-out); }
.settings-head { margin-bottom: 24px; }
.settings-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.settings-brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 15px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,247,255,0.9));
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-brand-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
  display: block;
}
.settings-brand-fallback {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-text);
  line-height: 1;
}
.settings-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1;
}
.settings-brand-kicker {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.settings-brand-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-display);
}
.settings-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.settings-desc { font-size: 13px; color: var(--text-2); margin-top: 4px; }

/* AI Config */
.setup-panel {
  padding: 18px 18px 16px;
  margin-bottom: 18px;
}
.setup-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.setup-panel-head.compact { margin-bottom: 12px; }
.setup-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 4px;
}
.setup-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-0);
}
.setup-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 4px;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.preset-grid.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 8px;
}
.preset-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255,255,255,0.82);
  padding: 12px 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preset-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.preset-service { font-size: 12px; font-weight: 600; }
.preset-model { font-size: 12px; color: var(--text-1); }
.preset-base { font-size: 11px; color: var(--text-3); }
.template-row { display: flex; flex-wrap: wrap; gap: 8px; }
.template-type-chip {
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.82);
  color: var(--text-1);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: 0.15s;
}
.template-type-chip:hover {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-bg);
}
.generation-mode-box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.generation-mode-option {
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.82);
  border-radius: 14px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: 0.15s;
}
.generation-mode-option.active {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent-text);
}
.generation-mode-title {
  font-size: 13px;
  font-weight: 700;
}
.generation-mode-desc {
  font-size: 11px;
  color: var(--text-2);
}
.generation-mode-option.active .generation-mode-desc { color: inherit; opacity: 0.82; }
.sections { display: flex; flex-direction: column; gap: 24px; }
.section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.section-title { font-size: 13px; font-weight: 600; }
.section-subtitle { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.config-list { display: flex; flex-direction: column; gap: 6px; }
.config-row { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
.config-info { flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
.config-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.config-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.config-provider { font-size: 13px; font-weight: 600; }
.config-name { font-size: 12px; color: var(--text-2); }
.config-model { font-size: 11px; color: var(--text-2); }
.config-base { font-size: 11px; color: var(--text-3); }
.config-empty { font-size: 12px; color: var(--text-3); padding: 12px 0; }

.toggle { position: relative; width: 30px; height: 17px; cursor: pointer; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle span { position: absolute; inset: 0; background: var(--bg-3); border-radius: 99px; transition: 0.2s; }
.toggle span::before { content: ''; position: absolute; width: 13px; height: 13px; left: 2px; bottom: 2px; background: var(--bg-0); border-radius: 50%; transition: 0.2s; box-shadow: var(--shadow); }
.toggle input:checked + span { background: var(--accent); }
.toggle input:checked + span::before { transform: translateX(13px); }

/* Agent */
.agent-list { display: flex; flex-direction: column; gap: 8px; }
.agent-card { overflow: hidden; }
.agent-card-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; cursor: pointer; transition: background 0.1s; }
.agent-card-head:hover { background: var(--bg-hover); }
.agent-type-badge { width: 36px; height: 36px; border-radius: var(--radius); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.agent-card-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border); padding-top: 16px; }
.agent-card-foot { display: flex; align-items: center; gap: 8px; padding-top: 8px; }

/* Skills layout */
.skills-layout { display: flex; height: 100%; overflow: hidden; }
.skills-agent-list {
  width: 200px; flex-shrink: 0; border-right: 1px solid var(--border);
  background: var(--bg-1); display: flex; flex-direction: column;
  overflow-y: auto;
}
.skills-agent-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-3); padding: 14px 14px 8px;
}
.skills-agent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 14px; font-size: 13px; cursor: pointer;
  border: none; background: none; color: var(--text-2);
  transition: all 0.12s; width: 100%; text-align: left;
  border-radius: 0;
}
.skills-agent-item:hover { background: var(--bg-hover); color: var(--text-0); }
.skills-agent-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 600; }
.skills-agent-label { flex: 1; }
.skill-count-badge {
  font-size: 10px; font-weight: 700; font-family: var(--font-mono);
  background: var(--accent-bg); color: var(--accent-text);
  padding: 1px 5px; border-radius: 99px;
}
.skills-agent-item.active .skill-count-badge { background: rgba(255,255,255,0.2); color: inherit; }
.skills-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.skills-main .settings-scroll { max-width: 900px; }

/* Skill */
.skill-list { display: flex; flex-direction: column; gap: 8px; }
.skill-card { overflow: hidden; }
.skill-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; transition: background 0.1s; }
.skill-card-head:hover { background: var(--bg-hover); }
.skill-card-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px; }
.skill-card-foot { display: flex; align-items: center; gap: 8px; }

/* Shared */
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 500; color: var(--text-1); }
.field-hint { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.overlay { position: fixed; inset: 0; background: rgba(34,45,66,0.32); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 100; animation: fadeIn 0.18s var(--ease-out); }
.modal { padding: 28px; width: 420px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-elevated); }
.modal-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 6px; }
.config-modal { width: min(720px, calc(100vw - 40px)); max-height: calc(100vh - 48px); overflow-y: auto; }
.config-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.modal-note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
}
.preset-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.preset-pill {
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.72);
  color: var(--text-1);
  border-radius: 999px;
  padding: 8px 11px;
  font-size: 12px;
  cursor: pointer;
}
.preset-pill:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent-text);
}
.endpoint-hint {
  margin-top: -4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed var(--border);
  background: rgba(244,248,255,0.72);
  font-size: 12px;
}
.test-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 14px;
  padding: 12px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.72);
}
.test-result.ok { border-color: rgba(74, 167, 92, 0.28); }
.test-result.bad { border-color: rgba(201, 88, 68, 0.28); }
.test-result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-1);
}
.test-result-url,
.test-result-preview {
  font-size: 11px;
  color: var(--text-3);
  word-break: break-all;
}
.huobao-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 10px;
}
.huobao-grid .field-hint a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.huobao-grid .field-hint a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .preset-grid,
  .preset-grid.compact {
    grid-template-columns: 1fr;
  }
}
</style>
