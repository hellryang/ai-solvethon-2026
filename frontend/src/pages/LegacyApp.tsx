// 팀원 시안 (10/30 오후, 옛 컨셉 "인재 ↔ 프로젝트 매칭"). `npm run dev:demo`에서만 열린다.
// 이 화면이 부르는 /api/team/talents 등은 백엔드에 없고 src/lib/demo.ts가 대신 응답한다.
// 실제 서비스 화면은 src/App.tsx (남는 돈 비교, /api/team/savings/*).
import { useEffect, useState } from 'react'
import { Loader2, MapPinned, Plus, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorBanner, NativeSelect } from '@/components/common'
import { CompanyTab } from '@/components/CompanyTab'
import { PreferenceTab } from '@/components/PreferenceTab'
import { ProfileTab } from '@/components/ProfileTab'
import { ProjectsTab } from '@/components/ProjectsTab'
import { RecommendTab } from '@/components/RecommendTab'
import { SimulationTab } from '@/components/SimulationTab'
import { StackDemandTab } from '@/components/StackDemandTab'
import { api, errorMessage, postJson, TEAM } from '@/lib/api'
import type { AiMode, Health, Meta, Talent, TalentSummary } from '@/types'

import '@/App.css'

type Role = 'talent' | 'company'
type Tab = 'projects' | 'profile' | 'recommend' | 'preference' | 'stack' | 'simulate' | 'company'

const TABS: Record<Role, { id: Tab; label: string }[]> = {
  talent: [
    { id: 'projects', label: '프로젝트' },
    { id: 'profile', label: '내 프로필' },
    { id: 'recommend', label: '추천' },
    { id: 'preference', label: '선호·새 공고' },
    { id: 'stack', label: '지역 기술 수요' },
    { id: 'simulate', label: '정주 시뮬레이션' },
  ],
  company: [
    { id: 'projects', label: '프로젝트' },
    { id: 'company', label: '공고 등록' },
  ],
}

const IS_DEMO = import.meta.env.MODE === 'demo'

function LegacyApp() {
  const [role, setRole] = useState<Role>('talent')
  const [tab, setTab] = useState<Tab>('projects')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [talents, setTalents] = useState<TalentSummary[] | null>(null)
  const [talentId, setTalentId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [aiMode, setAiMode] = useState<AiMode | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    let ignore = false
    Promise.all([
      api<Meta>(`${TEAM}/meta`),
      api<TalentSummary[]>(`${TEAM}/talents`),
    ])
      .then(([metaData, talentList]) => {
        if (ignore) return
        setMeta(metaData)
        setTalents(talentList)
        setTalentId(current => current ?? talentList[0]?.id ?? null)
        setLoadError('')
      })
      .catch((e: unknown) => {
        if (!ignore) setLoadError(errorMessage(e, 'API 서버 연결에 실패했습니다. 배포 설정을 확인하세요.'))
      })
    api<Health>('/api/health')
      .then(data => { if (!ignore) setAiMode(data.ai_mode) })
      .catch(() => { if (!ignore) setAiMode(null) })
    return () => { ignore = true }
  }, [attempt])

  async function reloadTalents(selectId?: number) {
    const list = await api<TalentSummary[]>(`${TEAM}/talents`)
    setTalents(list)
    setTalentId(selectId ?? list[0]?.id ?? null)
  }

  async function seed() {
    setSeeding(true)
    setLoadError('')
    try {
      await postJson(`${TEAM}/seed`)
      await reloadTalents()
    } catch (e) {
      setLoadError(errorMessage(e, '시연 데이터를 넣지 못했습니다.'))
    } finally {
      setSeeding(false)
    }
  }

  function changeRole(next: Role) {
    setRole(next)
    setTab('projects')
  }

  function selectTalent(id: number) {
    setTalentId(id)
    setCreating(false)
  }

  function openSimulation(id: number) {
    setProjectId(id)
    setTab('simulate')
  }

  function onProfileSaved(saved: Talent) {
    // 저장한 인재를 바로 선택해서, 이전 인재의 프로필이 잠깐 보이지 않게 한다.
    setTalentId(saved.id)
    setCreating(false)
    void reloadTalents(saved.id).catch((e: unknown) =>
      setLoadError(errorMessage(e, '인재 목록을 새로 불러오지 못했습니다.')))
  }

  const needsTalent = tab === 'recommend' || tab === 'preference' || tab === 'stack' || tab === 'simulate' ||
    (tab === 'profile' && !creating)
  const noTalents = talents !== null && talents.length === 0

  return (
    <div className="kiro-app min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <MapPinned className="size-5 text-primary" />
              <Badge variant="secondary">5조 · JNU AI HACKATHON</Badge>
            </div>
            <h1 className="text-2xl font-bold">광주 AI 인재 ↔ 광주·전남 기업 프로젝트 매칭</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              프로젝트 추천과 함께, 같은 직무를 서울에서 할 때와 월 저축·2년·5년 자산을 비교합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {IS_DEMO && <Badge variant="destructive">데모 데이터 · 백엔드 미연결</Badge>}
            <Badge variant={aiMode === 'mock' ? 'secondary' : 'outline'}>
              {aiMode === 'mock' ? '로컬 모의 AI · AWS 미호출'
                : aiMode === 'bedrock' ? '서버 Bedrock AI' : 'AI 모드 확인 중'}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 p-5">
        <Card size="sm">
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium" id="role-label">역할 (시연용, 로그인 없음)</span>
              <div role="group" aria-labelledby="role-label" className="flex gap-1">
                <Button type="button" size="sm" variant={role === 'talent' ? 'default' : 'outline'}
                  aria-pressed={role === 'talent'} onClick={() => changeRole('talent')}>인재</Button>
                <Button type="button" size="sm" variant={role === 'company' ? 'default' : 'outline'}
                  aria-pressed={role === 'company'} onClick={() => changeRole('company')}>기업</Button>
              </div>
            </div>

            {role === 'talent' && (
              <>
                <div className="min-w-56 space-y-1.5">
                  <label htmlFor="talent-select" className="text-sm font-medium">인재 선택</label>
                  <NativeSelect id="talent-select" value={creating ? '' : (talentId ?? '')}
                    disabled={!talents || talents.length === 0}
                    onChange={e => selectTalent(Number(e.target.value))}>
                    {creating && <option value="">새 프로필 작성 중</option>}
                    {talents?.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nickname} · {t.desired_category}{t.is_demo ? ' (시연)' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => { setCreating(true); setTab('profile') }}>
                  <Plus /> 새 프로필
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div role="tablist" aria-label="화면 선택" className="flex flex-wrap gap-1 border-b pb-2">
          {TABS[role].map(t => (
            <Button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              variant={tab === t.id ? 'default' : 'ghost'} onClick={() => setTab(t.id)}>
              {t.label}
            </Button>
          ))}
        </div>

        {loadError && (
          <ErrorBanner>
            <p>{loadError}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setAttempt(n => n + 1)}>
              <RefreshCw /> 다시 불러오기
            </Button>
          </ErrorBanner>
        )}

        {!meta || talents === null ? (
          !loadError && <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          <section role="tabpanel" aria-label={TABS[role].find(t => t.id === tab)?.label}>
            {role === 'talent' && noTalents && !creating && tab !== 'projects' && tab !== 'profile' ? (
              <EmptyState>
                <p>등록된 인재가 없습니다.</p>
                <Button type="button" size="sm" className="mt-3" onClick={() => void seed()} disabled={seeding}>
                  {seeding && <Loader2 className="animate-spin" />}
                  시연 데이터 넣기
                </Button>
                <p className="mt-2 text-xs">여러 번 눌러도 중복 데이터를 만들지 않고, 기존 데이터를 지우지 않습니다.</p>
              </EmptyState>
            ) : needsTalent && talentId === null ? (
              <EmptyState>상단에서 인재를 선택하거나 새 프로필을 만드세요.</EmptyState>
            ) : (
              <>
                {tab === 'projects' && <ProjectsTab meta={meta} />}
                {tab === 'profile' && (
                  <ProfileTab meta={meta} talentId={creating ? null : talentId} onSaved={onProfileSaved} />
                )}
                {tab === 'recommend' && talentId !== null && (
                  <RecommendTab talentId={talentId} onSimulate={openSimulation} />
                )}
                {tab === 'preference' && talentId !== null && <PreferenceTab talentId={talentId} meta={meta} />}
                {tab === 'stack' && talentId !== null && <StackDemandTab talentId={talentId} />}
                {tab === 'simulate' && talentId !== null && (
                  <SimulationTab talentId={talentId} projectId={projectId} onProjectChange={setProjectId} />
                )}
                {tab === 'company' && <CompanyTab meta={meta} />}
              </>
            )}
          </section>
        )}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          시연용 서비스입니다. 가정값과 가상 공고를 사용하며 실제 채용 결정이 아닙니다.
        </p>
      </main>
    </div>
  )
}

export default LegacyApp
