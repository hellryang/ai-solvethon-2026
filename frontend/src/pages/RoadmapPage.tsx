// ④ 준비 로드맵(가운데 열). 1~3순위 정리 → STEP 칩(이랜서 "A to Z") → 2·5년 누적 표 (docs/ui-reference.md §1 ③).

import { useState } from 'react'
import { ChevronUp, Loader2, Sparkles, X } from 'lucide-react'

import { EmptyState, ErrorBanner } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { errorMessage } from '@/lib/api'
import { href } from '@/lib/router'
import { buildRoadmap, manwon, signedManwon } from '@/lib/savings'
import { useCompares } from '@/lib/useSavings'
import type { Picks } from '@/lib/useSavings'
import type { RoadmapResponse, SavingsProfile } from '@/types'

const STEPS = [
  { key: '1개월', step: 'STEP 1', title: '1개월 안에' },
  { key: '3개월', step: 'STEP 2', title: '3개월 안에' },
  { key: '6개월', step: 'STEP 3', title: '6개월 안에' },
  { key: '경력', step: 'STEP 4', title: '1년 일하면' },
] as const

export function RoadmapPage({ profile, picks }: { profile: SavingsProfile; picks: Picks }) {
  const { data, error, retry } = useCompares(profile, picks.ids)

  return (
    <>
      <section aria-labelledby="roadmap-title" className="rounded-xl border bg-card p-5">
        <h1 id="roadmap-title" className="text-lg font-bold">④ 준비 로드맵</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          고른 1~3순위 회사 기준으로 1·3·6개월 준비 항목과 1년 경력의 의미를 AI가 씁니다. 순서가 곧 순위입니다.
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
                  <Button
                    type="button" size="sm" variant="ghost" aria-label={`${name} 빼기`}
                    onClick={() => picks.remove(id)}
                  >
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
          <RoadmapSteps key={JSON.stringify({ profile, ids: picks.ids })} profile={profile} projectIds={picks.ids} />

          <section aria-labelledby="totals-title" className="rounded-xl border bg-card p-5">
            <h2 id="totals-title" className="text-base font-semibold">2년·5년 누적 저축</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">각 회사와 같은 일 서울 공고를 같은 공식으로 계산했습니다.</p>
            {data ? (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>회사</TableHead>
                    <TableHead>2년 누적</TableHead>
                    <TableHead>5년 누적</TableHead>
                    <TableHead>5년, 서울 대비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(result => {
                    const fiveYears = result.cumulative['60']
                    return (
                      <TableRow key={result.project.id}>
                        <TableCell className="font-semibold">{result.project.display_name}</TableCell>
                        <TableCell>{manwon(result.cumulative['24'].jeonnam)}</TableCell>
                        <TableCell>{manwon(fiveYears.jeonnam)}</TableCell>
                        <TableCell className="font-semibold">{signedManwon(fiveYears.jeonnam - fiveYears.seoul)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <p role="status" className="mt-3 text-sm text-muted-foreground">계산 중…</p>
            )}
          </section>
        </>
      )}
    </>
  )
}

/** AI 로드맵. [로드맵 만들기]를 누를 때만 부른다 */
function RoadmapSteps({ profile, projectIds }: { profile: SavingsProfile; projectIds: string[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RoadmapResponse | null>(null)

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await buildRoadmap(profile, projectIds))
    } catch (e) {
      setError(errorMessage(e, 'AI 로드맵을 받지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="steps-title" className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="steps-title" className="text-base font-semibold">준비 단계</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">AI가 1~3순위 회사의 필요 기술과 내 기술을 비교해 씁니다.</p>
        </div>
        <Button type="button" size="lg" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {error ? '다시 시도' : result ? '다시 만들기' : '로드맵 만들기'}
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner>{error} 버튼을 다시 눌러 주세요. 자동으로 다시 부르지 않습니다.</ErrorBanner>
        </div>
      )}

      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {STEPS.map(step => (
          <li key={step.key} className="rounded-xl border p-4">
            <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
              {step.step}
            </span>
            <p className="mt-2 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {result?.lines?.[step.key] ?? (result ? '—' : busy ? '만드는 중…' : '[로드맵 만들기]를 누르면 채워집니다.')}
            </p>
          </li>
        ))}
      </ol>

      {result && !result.lines && (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            AI 응답이 정해진 4줄 형식이 아니어서 원문을 그대로 보여 줍니다
            {result.mode === 'mock' && ' (로컬 모의 응답 · 실제 AI 결과는 팀 서버에서 확인)'}.
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{result.raw}</p>
        </div>
      )}
    </section>
  )
}
