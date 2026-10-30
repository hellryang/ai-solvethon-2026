// ④ 준비 로드맵(가운데 열). 담은 회사 → 내가 부족한 능력 → [로드맵 만들기] → ① 필요 자격증 ② 기업별 필요 프로젝트.
// 로드맵에는 이 두 가지만 넣는다 (10/30 결정). 부족한 능력·자격증·개월은 코드가 정하고, 프로젝트 이름만 AI가 쓴다.

import { useState } from 'react'
import { ChevronUp, Loader2, Sparkles, X } from 'lucide-react'

import { EmptyState, ErrorBanner } from '@/components/common'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { href } from '@/lib/router'
import { buildRoadmap } from '@/lib/savings'
import { useCompares } from '@/lib/useSavings'
import type { Picks } from '@/lib/useSavings'
import type { CompareResponse, RoadmapResponse, SavingsProfile } from '@/types'

export function RoadmapPage({ profile, picks }: { profile: SavingsProfile; picks: Picks }) {
  const { data, error, retry } = useCompares(profile, picks.ids)

  return (
    <>
      <section aria-labelledby="roadmap-title" className="rounded-xl border bg-card p-5">
        <h1 id="roadmap-title" className="text-lg font-bold">④ 준비 로드맵</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          마음에 드는 회사를 담으면 부족한 능력을 찾고, 필요 자격증과 회사별 프로젝트를 개월 순서로 짜 줍니다.
          순서가 곧 순위입니다.
        </p>

        {picks.ids.length === 0 ? (
          <div className="mt-4">
            <EmptyState>
              <p>아직 비교에 담은 회사가 없습니다.</p>
              <Button asChild className="mt-3">
                <a href={href.home}>추천 3곳 보러 가기</a>
              </Button>
            </EmptyState>
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {picks.ids.map((id, index) => {
              const result = data?.[index]
              const name = result?.project.display_name ?? id
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <span className="text-sm font-bold">{index + 1}순위</span>
                  <a href={href.compare(id)} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                    {name}
                    {result && <span className="font-normal text-muted-foreground"> · {result.project.work}</span>}
                  </a>
                  <Button
                    type="button" size="sm" variant="ghost" disabled={index === 0}
                    aria-label={`${name} 순위 올리기`} onClick={() => picks.moveUp(id)}
                  >
                    <ChevronUp /> 위로
                  </Button>
                  <Button type="button" size="sm" variant="ghost" aria-label={`${name} 빼기`} onClick={() => picks.remove(id)}>
                    <X /> 빼기
                  </Button>
                </li>
              )
            })}
          </ol>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBanner>
              <p>{error}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>다시 시도</Button>
            </ErrorBanner>
          </div>
        )}
      </section>

      {picks.ids.length > 0 && (
        <>
          <GapsCard results={data} />
          <RoadmapPlan key={JSON.stringify({ profile, ids: picks.ids })} profile={profile} projectIds={picks.ids} />
        </>
      )}
    </>
  )
}

/** 내가 부족한 능력. 적합도 점수와 같은 기준(코드)이라 버튼을 누르기 전에 바로 보인다 */
function GapsCard({ results }: { results: CompareResponse[] | null }) {
  return (
    <section aria-labelledby="gaps-title" className="rounded-xl border bg-card p-5">
      <h2 id="gaps-title" className="text-base font-semibold">내가 부족한 능력</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">담은 회사의 필요 기술과 내 기술을 비교했습니다.</p>
      {results ? (
        <ul className="mt-2 divide-y">
          {results.map(result => (
            <li key={result.project.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-24 shrink-0 text-sm font-semibold">{result.project.display_name}</span>
              <div className="flex flex-wrap gap-1.5">
                {result.fit.missing.length === 0 && <span className="text-sm text-muted-foreground">부족한 기술 없음</span>}
                {result.fit.missing.map(skill => (
                  <span key={skill} className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-medium text-accent-foreground">
                    {skill}
                  </span>
                ))}
                {result.fit.extended_hits.map(skill => (
                  <span key={skill} title="확장 기술: 경험으로 할 수 있지만 직접 해 본 적은 없는 기술"
                    className="rounded-full border px-2.5 py-0.5 text-[13px] text-muted-foreground">
                    {skill} (확장)
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-3 text-sm text-muted-foreground">계산 중…</p>
      )}
    </section>
  )
}

function monthsText(start: number, end: number): string {
  return start === end ? `${start}개월` : `${start}~${end}개월`
}

interface PlanRow {
  key: string
  months: string
  title: string
  sub: string
  detail: string
  badge?: string
}

function PlanList({ title, rows, empty }: { title: string; rows: PlanRow[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {rows.map(row => (
            <li key={row.key} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:gap-4">
              <span className="w-20 shrink-0 text-sm font-bold text-primary">{row.months}</span>
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-muted-foreground"> · {row.sub}</span>
                  {row.badge && <span className="ml-2 rounded-full border px-1.5 text-[11px] text-muted-foreground">{row.badge}</span>}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{row.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** [로드맵 만들기]: 프로젝트 이름에 AI를 1회 부른다. 실패해도 자격증·개월·템플릿 프로젝트는 나온다 */
function RoadmapPlan({ profile, projectIds }: { profile: SavingsProfile; projectIds: string[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RoadmapResponse | null>(null)

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await buildRoadmap(profile, projectIds))
    } catch (e) {
      setError(errorMessage(e, '로드맵을 만들지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  const certificates: PlanRow[] = (result?.certificates ?? []).map(cert => ({
    key: cert.name, months: monthsText(cert.start_month, cert.end_month), title: cert.name, sub: cert.issuer,
    detail: `${cert.for_companies.join('·')}에 부족한 ${cert.covers.join(', ')}을(를) 보여 줍니다.`,
  }))
  const projects: PlanRow[] = (result?.projects ?? []).map(project => ({
    key: project.project_id, months: monthsText(project.start_month, project.end_month), title: project.title,
    sub: project.display_name,
    detail: project.covers.length > 0
      ? `${project.description} (채우는 기술: ${project.covers.join(', ')})`
      : project.description,
    badge: project.source === 'ai' ? 'AI' : '템플릿',
  }))

  return (
    <section aria-labelledby="plan-title" className="space-y-5 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="plan-title" className="text-base font-semibold">개월별 준비 로드맵</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">필요 자격증과 기업별 프로젝트, 두 가지만 개월 순서로 놓습니다.</p>
        </div>
        <Button type="button" size="lg" className="h-11 sm:h-9" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {error ? '다시 시도' : result ? '다시 만들기' : '로드맵 만들기'}
        </Button>
      </div>

      {error && <ErrorBanner>{error} 버튼을 다시 눌러 주세요.</ErrorBanner>}
      {!result && !busy && !error && (
        <p className="text-sm text-muted-foreground">
          [로드맵 만들기]를 누르면 부족한 능력을 채울 자격증과 회사별 프로젝트가 개월 순서로 채워집니다.
        </p>
      )}
      {busy && <p role="status" className="text-sm text-muted-foreground">로드맵을 만드는 중…</p>}

      {result && (
        <>
          <PlanList title="① 필요 자격증" rows={certificates} empty="부족한 기술이 없어 자격증 없이 바로 프로젝트로 넘어갑니다." />
          <PlanList title="② 기업별 필요 프로젝트" rows={projects} empty="담은 회사가 없습니다." />
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>자격증은 부족한 기술을 보여 줄 수 있는 추천이며 공고의 지원 조건이 아닙니다. 준비 기간은 일반적인 학습 기간을 가정했습니다.</li>
            {result.mode === 'mock' && <li>로컬 모의 AI라 프로젝트 이름은 공고 업무로 만든 템플릿입니다. 팀 서버에서는 AI가 씁니다.</li>}
            {result.ai_error && <li>AI 응답을 받지 못해 템플릿으로 채웠습니다 ({result.ai_error}).</li>}
          </ul>
        </>
      )}
    </section>
  )
}
