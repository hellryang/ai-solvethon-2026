// 홈(가운데 열): ① 작성창 → ② 공고 카드. LinkedIn 작성창 + 이랜서 추천 카드 패턴 (docs/ui-reference.md §1).

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { EmptyState, ErrorBanner } from '@/components/common'
import { ProjectCard } from '@/components/savings/ProjectCard'
import { PillTabs } from '@/components/savings/parts'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { EXAMPLE_INTROS, LIST_TABS, parseIntro } from '@/lib/savings'
import type { ListTab } from '@/lib/savings'
import { useCompares, useRecommend } from '@/lib/useSavings'
import type { Picks } from '@/lib/useSavings'
import { cn } from '@/lib/utils'
import type { ParseResponse, SavingsProfile, SavingsProject } from '@/types'

interface HomePageProps {
  intro: string
  onIntroChange: (intro: string) => void
  profile: SavingsProfile
  onParsed: (result: ParseResponse) => void
  picks: Picks
  /** 전남·광주 공고 12곳 (GET /savings/data). 불러오기 전에는 null */
  projects: SavingsProject[] | null
}

export function HomePage({ intro, onIntroChange, profile, onParsed, picks, projects }: HomePageProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastSource, setLastSource] = useState<ParseResponse['source'] | null>(null)
  const [mode, setMode] = useState<WorkMode>('상주')
  const [tab, setTab] = useState<ListTab>('추천 3곳')

  async function read(event: FormEvent) {
    event.preventDefault()
    const text = intro.trim()
    if (!text) return
    setBusy(true)
    setError('')
    try {
      const result = await parseIntro(text)
      onParsed(result)
      setLastSource(result.source)
      setMode('상주')
      setTab('추천 3곳')
    } catch (e) {
      setError(errorMessage(e, '자기소개를 읽지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section aria-labelledby="composer-title" className="rounded-xl border bg-card p-4 md:p-5">
        <h2 className="text-[22px] font-bold text-foreground">
          자기소개 한 줄이면, 서울보다 얼마나 더 남는지 알려드려요
        </h2>

        <form onSubmit={e => void read(e)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="intro" className="sr-only">자기소개 한 줄</label>
          <input
            id="intro" value={intro} maxLength={1000} onChange={e => onIntroChange(e.target.value)}
            placeholder="예: 광주 본가, 차 없음, Java로 웹을 만들어 봤어요"
            className="h-[50px] w-full min-w-0 rounded-[24px] sm:flex-1 border border-foreground/30 bg-card px-5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          />
          <Button type="submit" className="h-[50px] rounded-[24px] px-6 text-base sm:text-sm" disabled={busy || !intro.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            AI로 읽기
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">예시</span>
          {EXAMPLE_INTROS.map(example => (
            <button
              key={example.label} type="button" onClick={() => onIntroChange(example.intro)}
              className="rounded-full border px-3 py-2 text-[13px] hover:bg-muted sm:py-1"
            >
              {example.label}
            </button>
          ))}
        </div>

        {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">AI가 읽는 중입니다…</p>}
        {error && (
          <div className="mt-3">
            <ErrorBanner>{error} [AI로 읽기]를 다시 눌러 주세요.</ErrorBanner>
          </div>
        )}
        {!busy && lastSource && (
          <p role="status" className="mt-3 text-sm">
            {lastSource === 'ai' ? 'AI가 읽었어요.' : 'AI 응답을 받지 못해 키워드로 뽑았어요.'}{' '}
            <span className="text-muted-foreground">
              기술 {profile.skills.join(', ') || '없음'} · &lsquo;내 조건&rsquo;에서 고칠 수 있습니다.
            </span>
          </p>
        )}
      </section>

      <section aria-labelledby="list-title" className="space-y-3">
        <div role="tablist" aria-label="근무 형태" className="flex gap-6 border-b">
          {WORK_MODES.map(option => {
            const active = option === mode
            const count = projects?.filter(project => project.work_mode === option).length
            return (
              <button
                key={option} type="button" role="tab" aria-selected={active} onClick={() => setMode(option)}
                className={cn(
                  '-mb-px border-b-2 pb-2 text-base transition-colors',
                  active ? 'border-foreground font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {option} 프로젝트
                {count !== undefined && <span className="ml-1 text-sm text-primary">{count}</span>}
              </button>
            )
          })}
        </div>

        {mode === '재택' ? (
          <EmptyState>
            재택 공고는 아직 없습니다. 지금 공고 12곳은 모두 정규직 상주입니다.
            <br />
            고용24에서 광주·전남 재택 공고를 모으는 대로 여기에 보입니다.
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="list-title" className="text-base font-semibold">
                {tab === '추천 3곳' ? '나에게 맞는 전남·광주 공고' : `${tab} 공고`}
              </h2>
              <PillTabs tabs={LIST_TABS} value={tab} onChange={setTab} label="공고 목록 보기" />
            </div>
            <ProjectList tab={tab} profile={profile} picks={picks} projects={projects} />
          </>
        )}
      </section>
    </>
  )
}

type WorkMode = SavingsProject['work_mode']
const WORK_MODES: WorkMode[] = ['상주', '재택']

interface ProjectListProps {
  tab: ListTab
  profile: SavingsProfile
  picks: Picks
  projects: SavingsProject[] | null
}

/** 추천 탭은 상위 3곳(순위순), 지역 탭은 그 지역 공고를 월 남는 돈 차이가 큰 순으로 보여 준다 */
function ProjectList({ tab, profile, picks, projects }: ProjectListProps) {
  const isRecommend = tab === '추천 3곳'
  const recommend = useRecommend(profile)
  // 이 목록은 상주 탭 전용이다. 재택 공고가 들어오면 재택 탭에서 따로 보여 준다
  const ids = isRecommend
    ? (recommend.data ?? []).filter(item => item.project.work_mode === '상주').map(item => item.project.id)
    : (projects ?? []).filter(project => (tab === '전체' || project.place === tab) && project.work_mode === '상주').map(project => project.id)  
    const compares = useCompares(profile, ids)

  if (isRecommend && profile.skills.length === 0) {
    return (
      <EmptyState>
        위에 자기소개를 쓰고 [AI로 읽기]를 누르면 나에게 맞는 3곳이 뜹니다.
        <br />
        광주·나주·광양·전체 탭에서는 지금 바로 둘러볼 수 있습니다.
      </EmptyState>
    )
  }

  const error = (isRecommend ? recommend.error : '') || compares.error
  if (error) {
    return (
      <ErrorBanner>
        <p>{error}</p>
        <Button
          type="button" size="sm" variant="outline" className="mt-2"
          onClick={() => { recommend.retry(); compares.retry() }}
        >
          다시 시도
        </Button>
      </ErrorBanner>
    )
  }

  const waiting = (isRecommend && recommend.loading) || (!isRecommend && projects === null)
  if (waiting || compares.loading || !compares.data) {
    return <p role="status" className="text-sm text-muted-foreground">남는 돈을 계산하는 중…</p>
  }

  const results = isRecommend
    ? compares.data
    : [...compares.data].sort((a, b) => b.advantage_monthly - a.advantage_monthly)

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <ProjectCard
          key={result.project.id} result={result} rank={isRecommend ? index + 1 : undefined}
          picked={picks.has(result.project.id)} pickDisabled={picks.isFull}
          onTogglePick={() => picks.toggle(result.project.id)}
        />
      ))}
    </div>
  )
}
