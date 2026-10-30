// 남는 돈 비교 화면 틀.
// 데스크톱(1024px 이상): 2열 — 가운데 화면 / 오른쪽 목표 회사·계산 기준. 내 조건은 상단 바 '내 프로필'로 옮겼다.
// 모바일: 심사위원이 폰으로 URL에 접속하므로 앱처럼 한 열 + 하단 탭바. 내 조건 한 줄 요약을 위에 둔다.

import { useEffect, useState } from 'react'

import { ErrorBanner } from '@/components/common'
import { BasisCard } from '@/components/savings/BasisCard'
import { ConditionCard } from '@/components/savings/ConditionCard'
import { PickList } from '@/components/savings/PickList'
import { BottomNav, TopBar } from '@/components/savings/TopBar'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/api'
import { href, navigate, parseRoute, useHash } from '@/lib/router'
import { EMPTY_PROFILE, getSavingsData, isParseInfo, isSavingsProfile } from '@/lib/savings'
import type { ParseInfo } from '@/lib/savings'
import { isNullableString, isString, useSessionState } from '@/lib/session'
import { usePicks } from '@/lib/useSavings'
import { ComparePage } from '@/pages/ComparePage'
import { HomePage } from '@/pages/HomePage'
import { RoadmapPage } from '@/pages/RoadmapPage'
import { SourcesPage } from '@/pages/SourcesPage'
import { TalentDetailPage } from '@/pages/TalentDetailPage'
import { TalentEditPage } from '@/pages/TalentEditPage'
import { TalentListPage } from '@/pages/TalentListPage'
import { cn } from '@/lib/utils'
import type { AiMode, Health, ParseResponse, SavingsData, SavingsProfile } from '@/types'

function App() {
  const hash = useHash()
  const route = parseRoute(hash)

  const [data, setData] = useState<SavingsData | null>(null)
  const [dataError, setDataError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [aiMode, setAiMode] = useState<AiMode | null>(null)

  const [intro, setIntro] = useSessionState('kiroro.intro', '', isString)
  const [name, setName] = useSessionState('kiroro.name', '', isString)
  const [profile, setProfile] = useSessionState<SavingsProfile>('kiroro.profile', EMPTY_PROFILE, isSavingsProfile)
  const [parseInfo, setParseInfo] = useSessionState<ParseInfo | null>('kiroro.parse', null, isParseInfo)
  const [lastProjectId, setLastProjectId] = useSessionState<string | null>('kiroro.lastProject', null, isNullableString)
  const picks = usePicks()

  useEffect(() => {
    let ignore = false
    getSavingsData()
      .then(result => {
        if (ignore) return
        setData(result)
        setDataError('')
      })
      .catch((e: unknown) => {
        if (!ignore) setDataError(errorMessage(e, '계산 기준 데이터를 불러오지 못했습니다. 백엔드가 켜져 있는지 확인하세요.'))
      })
    api<Health>('/api/health')
      .then(health => { if (!ignore) setAiMode(health.ai_mode) })
      .catch(() => { if (!ignore) setAiMode(null) })
    return () => { ignore = true }
  }, [attempt])

  // 화면을 옮기면 맨 위부터 보여 준다
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [hash])

  // 상단·하단 '남는 돈 비교' 탭이 마지막으로 본 회사로 돌아가게 한다
  const viewingProjectId = route.page === 'compare' ? route.projectId : null
  useEffect(() => {
    if (viewingProjectId) setLastProjectId(viewingProjectId)
  }, [viewingProjectId, setLastProjectId])

  const isDefaultProfile = parseInfo === null && profile.skills.length === 0 && profile.home_city === null
  const isTalentPage = route.page === 'talents' || route.page === 'talent' || route.page === 'talent-edit'
  // 카트 없이 넓게 쓰는 화면: 인재 PR, 계산 기준, 준비 로드맵(화면 안에 담은 회사 목록이 이미 있다)
  const isWidePage = isTalentPage || route.page === 'sources' || route.page === 'roadmap'
  const nav = { page: route.page, compareHref: href.compare(viewingProjectId ?? lastProjectId), pickCount: picks.ids.length }

  function onParsed(result: ParseResponse) {
    setProfile(result.profile)
    setParseInfo({ source: result.source, rationale: result.rationale })
  }

  function onProfileChange(next: SavingsProfile) {
    setProfile(next)
    setParseInfo(info => ({ source: 'manual', rationale: info?.rationale ?? '' }))
  }

  function reset() {
    setIntro('')
    setName('')
    setProfile(EMPTY_PROFILE)
    setParseInfo(null)
    picks.clear()
    navigate(href.home)
  }

  const conditionProps = {
    profile, parseInfo, skillOptions: data?.skills ?? [], onChange: onProfileChange, onReset: reset,
  }

  return (
    <div className="min-h-svh">
      <TopBar
        {...nav} aiMode={aiMode} profile={profile} skillOptions={data?.skills ?? []}
        onProfileChange={onProfileChange} onReset={reset} name={name} onNameChange={setName}
      />

      <div
        className={cn(
          'mx-auto grid max-w-[1128px] grid-cols-1 gap-4 px-4 pt-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:gap-6 lg:py-6',
          isWidePage ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_312px]',
        )}
      >
        <main className="min-w-0 space-y-4">
          {dataError && (
            <ErrorBanner>
              <p>{dataError}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setAttempt(n => n + 1)}>
                다시 불러오기
              </Button>
            </ErrorBanner>
          )}

          {(route.page === 'home' || route.page === 'compare') && (
            <div className="lg:hidden">
              <ConditionCard variant="compact" {...conditionProps} />
            </div>
          )}

          {route.page === 'home' && (
            <HomePage
              intro={intro} onIntroChange={setIntro} profile={profile} onParsed={onParsed} picks={picks}
              projects={data?.projects ?? null}
            />
          )}
          {route.page === 'compare' && (
            <ComparePage
              projectId={route.projectId} profile={profile} isDefaultProfile={isDefaultProfile} picks={picks}
              projects={data?.projects ?? null}
            />
          )}
          {route.page === 'roadmap' && <RoadmapPage profile={profile} picks={picks} />}
          {route.page === 'sources' && <SourcesPage data={data} />}
          {route.page === 'talents' && <TalentListPage />}
          {route.page === 'talent' && <TalentDetailPage key={route.talentId} talentId={route.talentId} />}
          {route.page === 'talent-edit' && (
            <TalentEditPage
              key={route.talentId ?? 'new'} talentId={route.talentId}
              suggestedSkills={profile.skills} suggestedRegion={profile.home_city}
            />
          )}
          {route.page === 'not-found' && (
            <section className="rounded-xl border bg-card p-8 text-center">
              <h1 className="text-lg font-bold">없는 화면입니다</h1>
              <Button asChild className="mt-4">
                <a href={href.home}>처음 화면으로</a>
              </Button>
            </section>
          )}

          <p className="pt-2 text-center text-xs leading-5 text-muted-foreground">
            시연용 서비스입니다. 회사명은 가렸고(출처: 고용24 공고), 월세 지원금은 추첨·선정제라 보장되지 않습니다.
          </p>
        </main>

        {!isWidePage && (
          <aside aria-label="목표 회사와 계산 기준" className="hidden space-y-4 lg:sticky lg:top-[76px] lg:block lg:self-start">
            <PickList profile={profile} picks={picks} />
            <BasisCard assumptions={data?.assumptions ?? null} />
          </aside>
        )}
      </div>

      <BottomNav {...nav} />
    </div>
  )
}

export default App