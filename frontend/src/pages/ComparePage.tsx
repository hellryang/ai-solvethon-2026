// ③ 남는 돈 비교(가운데 열). 큰 숫자 통계(이랜서) → 계산 내역 → 누적 → AI 해석(어두운 면) 순서 (docs/ui-reference.md §1 ②).
// 숫자는 모두 서버(savings.py)가 계산한 값이고, 화면은 만원으로 바꾸기만 한다.

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { ErrorBanner, InfoBanner, NativeSelect } from '@/components/common'
import { AnalysisPanel } from '@/components/savings/AnalysisPanel'
import { ProjectCard } from '@/components/savings/ProjectCard'
import { BigStat, StatItem, TwoBar } from '@/components/savings/parts'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { href, navigate } from '@/lib/router'
import { manwon, messageText, percent, salaryText, signedManwon } from '@/lib/savings'
import { useCompares } from '@/lib/useSavings'
import type { Picks } from '@/lib/useSavings'
import type { CompareResponse, CumulativeMonths, SavingsBreakdown, SavingsProfile, SavingsProject } from '@/types'

interface ComparePageProps {
  projectId: string | null
  profile: SavingsProfile
  /** 아직 조건을 입력하지 않아 기본값(자취·차 없음)으로 계산하는 중 */
  isDefaultProfile: boolean
  picks: Picks
  projects: SavingsProject[] | null
}

export function ComparePage({ projectId, ...rest }: ComparePageProps) {
  if (projectId === null) return <ChooseProject projects={rest.projects} />
  // 회사가 바뀌면 AI 분석 결과 같은 화면 상태를 처음부터 다시 시작한다
  return <CompareDetail key={projectId} projectId={projectId} {...rest} />
}

function ChooseProject({ projects }: { projects: SavingsProject[] | null }) {
  return (
    <section aria-labelledby="choose-title" className="rounded-xl border bg-card p-5">
      <h1 id="choose-title" className="text-lg font-bold">③ 남는 돈 비교</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        비교할 전남·광주 공고를 고르세요. 추천 카드의 [남는 돈 자세히]로도 들어올 수 있습니다.
      </p>
      {projects === null ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">공고를 불러오는 중…</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {['광주', '나주', '광양'].map(place => (
            <div key={place}>
              <h2 className="text-sm font-semibold">{place}</h2>
              <ul className="mt-2 space-y-1.5">
                {projects.filter(p => p.place === place).map(p => (
                  <li key={p.id}>
                    <a href={href.compare(p.id)} className="block rounded-lg border px-3 py-2 hover:bg-muted">
                      <span className="text-sm font-semibold">{p.display_name}</span>
                      <span className="block text-xs text-muted-foreground">{p.work}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CompareDetail({ projectId, profile, isDefaultProfile, picks, projects }: ComparePageProps & { projectId: string }) {
  const { data, loading, error, retry } = useCompares(profile, [projectId])
  const result = data?.[0] ?? null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={href.home}><ArrowLeft /> 추천 목록</a>
          </Button>
          <h1 className="text-lg font-bold">③ 남는 돈 비교</h1>
        </div>
        {projects && (
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">다른 회사</span>
            <NativeSelect value={projectId} onChange={e => navigate(href.compare(e.target.value))} className="w-auto">
              {projects.map(p => <option key={p.id} value={p.id}>{p.display_name} · {p.work}</option>)}
            </NativeSelect>
          </label>
        )}
      </div>

      {isDefaultProfile && (
        <InfoBanner>
          아직 내 조건이 없어 &lsquo;자취·차 없음&rsquo;으로 계산했습니다.{' '}
          <a href={href.home} className="font-semibold underline">자기소개 쓰러 가기</a>
        </InfoBanner>
      )}
      {error && (
        <ErrorBanner>
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>다시 시도</Button>
        </ErrorBanner>
      )}
      {loading && <p role="status" className="text-sm text-muted-foreground">남는 돈을 계산하는 중…</p>}

      {result && (
        <>
          <ProjectCard
            result={result} showDetail={false} picked={picks.has(projectId)} pickDisabled={picks.isFull}
            onTogglePick={() => picks.toggle(projectId)}
          />
          <Summary result={result} />
          <Breakdown jeonnam={result.jeonnam} seoul={result.seoul} />
          <CumulativeBars result={result} />
          <AnalysisPanel key={JSON.stringify(profile)} profile={profile} projectId={projectId} />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button asChild variant="outline">
              <a href={href.home}><ArrowLeft /> 다른 추천 보기</a>
            </Button>
            <Button asChild size="lg">
              <a href={href.roadmap}>④ 준비 로드맵 <ArrowRight /></a>
            </Button>
          </div>
        </>
      )}
    </>
  )
}

/** 큰 숫자 통계 섹션 (이랜서 "1.1조 원 / 41만 명 / 98%" 패턴) */
function Summary({ result }: { result: CompareResponse }) {
  const firstYear = result.cumulative['12']
  return (
    <section aria-labelledby="summary-title" className="rounded-3xl border bg-card p-6 md:p-10">
      <h2 id="summary-title" className="text-sm font-semibold text-muted-foreground">
        같은 일 서울 공고({result.seoul.display_name}, {result.seoul.place})보다 1년차에 매달
      </h2>
      <div className="mt-4">
        <BigStat won={result.advantage_monthly} label={messageText(result.message, result.reversal_subsidy)} />
      </div>
      <div className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-3">
        <StatItem value={signedManwon(firstYear.jeonnam - firstYear.seoul)} label="1년 동안 쌓이는 차이" />
        <StatItem value={percent(result.break_even_ratio)} label="손익분기 X: 서울 실수령이 이만큼 더 많아야 같아짐" />
        <StatItem value={percent(result.actual_gap_ratio)} label="실제 격차 g: 서울 실수령이 실제로 더 많은 비율" />
      </div>
    </section>
  )
}

/** 남는 돈이 어디서 나왔는지. 한 줄 공식 그대로 위에서 아래로 더하고 뺀다 (docs/calc-criteria.md §1) */
function Breakdown({ jeonnam, seoul }: { jeonnam: SavingsBreakdown; seoul: SavingsBreakdown }) {
  const rows: { label: string; pick: (b: SavingsBreakdown) => ReactNode; strong?: boolean }[] = [
    { label: '연봉 (공고 하한)', pick: b => salaryText(b.salary_floor_manwon) },
    { label: '월 실수령액', pick: b => manwon(b.net_pay) },
    { label: '− 월세', pick: b => `${manwon(b.rent)} (${b.housing})` },
    { label: '− 교통비', pick: b => `${manwon(b.transit)} (${b.transit_label})` },
    { label: '− 생활비', pick: b => manwon(b.living_cost) },
    { label: '− 자차 보험·세금', pick: b => manwon(b.car_fixed) },
    { label: '+ 월세 지원금', pick: b => subsidyText(b) },
    { label: '= 월 남는 돈', pick: b => manwon(b.savings), strong: true },
  ]
  return (
    <section aria-labelledby="breakdown-title" className="rounded-xl border bg-card p-5">
      <h2 id="breakdown-title" className="text-base font-semibold">남는 돈은 어디서 나왔나</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">서울과 전남·광주에 같은 공식을 씁니다. 금액은 1년차 월 기준입니다.</p>
      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>항목</TableHead>
            <TableHead>{jeonnam.display_name}</TableHead>
            <TableHead>{seoul.display_name}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.label} className={row.strong ? 'font-bold' : undefined}>
              <TableCell className="text-muted-foreground">{row.label}</TableCell>
              <TableCell className="whitespace-normal">{row.pick(jeonnam)}</TableCell>
              <TableCell className="whitespace-normal">{row.pick(seoul)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {jeonnam.car_alt && (
        <p className="mt-2 text-xs text-muted-foreground">
          자차로 다니면 유류비 {manwon(jeonnam.car_alt.fuel)} (왕복 {jeonnam.car_alt.round_trip_km}km).
          버스와 비교해 더 싼 쪽으로 계산했습니다.
        </p>
      )}
    </section>
  )
}

function subsidyText(b: SavingsBreakdown): string {
  if (!b.subsidy) return '없음'
  return `${manwon(b.subsidy.monthly)} (${b.subsidy.name}, ${b.subsidy.months}개월 · ${b.subsidy.selection})`
}

const PERIODS: { months: CumulativeMonths; label: string }[] = [
  { months: '12', label: '1년' },
  { months: '24', label: '2년' },
  { months: '60', label: '5년' },
]

function CumulativeBars({ result }: { result: CompareResponse }) {
  return (
    <section aria-labelledby="cumulative-title" className="rounded-xl border bg-card p-5">
      <h2 id="cumulative-title" className="text-base font-semibold">누적 저축</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        1년차 조건이 계속된다고 가정했습니다. 지원금은 지원 기간만큼만 더했습니다.
      </p>
      <div className="mt-4 space-y-5">
        {PERIODS.map(({ months, label }) => (
          <div key={months}>
            <p className="mb-2 text-sm font-semibold">{label}</p>
            <TwoBar
              rows={[
                { label: result.jeonnam.display_name, won: result.cumulative[months].jeonnam, highlight: true },
                { label: result.seoul.display_name, won: result.cumulative[months].seoul, highlight: false },
              ]}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
