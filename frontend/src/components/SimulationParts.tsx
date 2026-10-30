import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AssumptionBadge } from '@/components/common'
import {
  highlighted, isSeoulScenario, labelForKey, PAY_BASIS_LABEL, scenarioByKey, signed,
  SUPPORT_REASON_LABEL, unavailableLabel, won,
} from '@/lib/format'
import type { Scenario, SimulationResponse } from '@/types'

const SEOUL_DISTRICT_ORDER = ['강남구', '영등포구', '중구']

// ------------------------------------------------------------ 1. 보수 비교

export function PayCompareCard({ sim }: { sim: SimulationResponse }) {
  const local = highlighted(sim)
  const rows = [...sim.pay_compare].sort(
    (a, b) => SEOUL_DISTRICT_ORDER.indexOf(a.district) - SEOUL_DISTRICT_ORDER.indexOf(b.district))
  const cell = 'text-right tabular-nums'

  return (
    <Card>
      <CardHeader>
        <CardTitle>보수 비교: 같은 직무를 서울에서 하면</CardTitle>
        <CardDescription>
          차이는 "서울 − 선택한 프로젝트"입니다. 부호가 +이면 서울 쪽 금액이 더 큽니다.
          서울 보수는 수집한 공고 표본의 구별 평균이며, 직무가 섞여 있어 선택한 프로젝트와 같은 직무의 보수가 아닙니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead className="text-right">월 단가</TableHead>
              <TableHead className="text-right">보수 차이</TableHead>
              <TableHead className="text-right">실수령 차이</TableHead>
              <TableHead className="text-right">월 저축 차이</TableHead>
              <TableHead>보수 기준</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30">
              <TableCell className="font-medium">
                {sim.project.region} · 선택한 프로젝트
              </TableCell>
              <TableCell className={cell}>{won(sim.project.pay_monthly)}만 원</TableCell>
              <TableCell className={cell}>-</TableCell>
              <TableCell className={cell}>-</TableCell>
              <TableCell className={cell}>
                {local ? `기준 ${won(local.saving_with_support)}만 원` : '-'}
              </TableCell>
              <TableCell>환산 연봉 {won(sim.project.annual_gross)}만 원</TableCell>
            </TableRow>
            {rows.map(row => {
              const seoul = scenarioByKey(sim, `seoul_${row.district}`)
              const basis = seoul?.pay_basis ?? 'district_sample_mean'
              const savingDiff = seoul && local ? seoul.saving_with_support - local.saving_with_support : null
              return (
                <TableRow key={row.district}>
                  <TableCell className="font-medium">
                    서울 {row.district}
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      <Badge variant="secondary">표본 {row.sample_n}건</Badge>
                    </span>
                  </TableCell>
                  <TableCell className={cell}>{won(row.seoul_pay)}만 원</TableCell>
                  <TableCell className={cell}>
                    {signed(row.diff)}만 원 ({signed(row.ratio_pct)}%)
                  </TableCell>
                  <TableCell className={cell}>{signed(row.take_home_diff)}만 원</TableCell>
                  <TableCell className={cell}>
                    {savingDiff === null ? (
                      <span className="text-muted-foreground">
                        계산 불가 ({sim.unavailable.find(u => u.key === `seoul_${row.district}`)?.reason ?? '데이터 없음'})
                      </span>
                    ) : `${signed(savingDiff)}만 원`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PAY_BASIS_LABEL[basis]}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">서울 보수 기준과 한계 보기</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>출처: {sim.seoul_pay_source.source}{sim.seoul_pay_source.collected_at ? ` · 수집일 ${sim.seoul_pay_source.collected_at}` : ''}</li>
            <li>{sim.seoul_pay_source.note}</li>
            <li>범위로 적힌 공고는 중앙값, "월 N만 원 이상"은 하한값으로 계산했고, 비공개 공고는 제외했습니다.</li>
            <li>표본이 3~4건이라 한두 건이 평균을 크게 바꿀 수 있습니다.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------ 2. 월 저축 분해 막대

const SEGMENTS = [
  { key: 'rent', label: '월세', className: 'bg-amber-400' },
  { key: 'transport', label: '교통비', className: 'bg-sky-400' },
  { key: 'fixed', label: '월 고정 지출', className: 'bg-slate-400' },
  { key: 'saving', label: '월 저축', className: 'bg-emerald-500' },
] as const

function ScenarioRow({ s, scale }: { s: Scenario; scale: number }) {
  const pct = (value: number) => `${Math.max(0, (value / scale) * 100)}%`
  const base = s.saving_after_support
  const deficit = s.saving_with_support < 0
  const seoul = isSeoulScenario(s.key)
  const values = { rent: s.rent, transport: s.transport, fixed: s.fixed, saving: Math.max(0, base) }
  const assumption = s.sources.some(src => src.is_assumption)

  return (
    <li className={'space-y-2 rounded-lg border p-3 ' + (s.highlight ? 'border-primary bg-primary/5' : '')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{s.label}</span>
        {s.highlight && <Badge>강조</Badge>}
        {seoul && <Badge variant="secondary">서울 비교</Badge>}
        {assumption && <AssumptionBadge />}
        {deficit && <Badge variant="destructive">적자</Badge>}
      </div>

      <div className="relative">
        <div
          role="img"
          aria-label={`${s.label}: 월 실수령 ${s.take_home}만 원, 월세 ${s.rent}, 교통비 ${s.transport}, 고정 지출 ${s.fixed}, 월 저축 ${base}만 원`}
          className="flex h-5 w-full overflow-hidden rounded bg-muted"
        >
          {SEGMENTS.map(seg => (
            <div key={seg.key} className={seg.className} style={{ width: pct(values[seg.key]) }} />
          ))}
        </div>
        <div
          title={`월 실수령액 ${s.take_home}만 원`}
          className="absolute -top-1 h-7 border-l-2 border-foreground"
          style={{ left: pct(s.take_home) }}
        />
      </div>

      <p className="text-sm tabular-nums">
        실수령 {won(s.take_home)} − 월세 {won(s.rent)} − 교통비 {won(s.transport)} − 고정 지출 {won(s.fixed)}
        {' '}= <strong>{won(base)}</strong>
        {s.support > 0 && (
          <>
            {' '}+ 지원금 {won(s.support)} ({s.support_months}개월) = <strong>{won(s.saving_with_support)}만 원/월</strong>
            <span className="text-muted-foreground"> (지원 기간 중)</span>
          </>
        )}
        {s.support === 0 && <span className="text-muted-foreground"> 만 원/월</span>}
      </p>
      {s.support > 0 && s.support_name && (
        <p className="text-xs text-muted-foreground">
          지원금: {s.support_name} · 지원이 끝나면 월 {won(s.saving_after_support)}만 원
        </p>
      )}
      {s.support === 0 && s.support_reason && (
        <p className="text-xs text-muted-foreground">{SUPPORT_REASON_LABEL[s.support_reason]}</p>
      )}
      {(s.flags.housing_fallback || s.flags.route_estimated || s.flags.car_fallback) && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {s.flags.housing_fallback && <li>희망 주거 형태 값이 없어 원룸 월세로 계산했습니다.</li>}
          {s.flags.route_estimated && <li>직접 구간이 없어 광주 경유 요금을 합산해 추정했습니다.</li>}
          {s.flags.car_fallback && <li>자차 데이터가 없어 대중교통 요금 기준으로 계산했습니다.</li>}
        </ul>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">출처·가정 보기</summary>
        <ul className="mt-1 space-y-0.5">
          {s.sources.map(src => (
            <li key={src.item}>
              {src.item}: {src.source}{src.is_assumption && ' (가정값)'}
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

export function SavingBarsCard({ sim }: { sim: SimulationResponse }) {
  const scale = Math.max(
    1, ...sim.scenarios.map(s => Math.max(s.take_home, s.rent + s.transport + s.fixed)))
  return (
    <Card>
      <CardHeader>
        <CardTitle>월 저축 가능액 (만 원/월)</CardTitle>
        <CardDescription>
          막대 길이는 시나리오끼리 같은 눈금입니다. 세로선은 월 실수령액이며, 월세·교통비·고정 지출을 빼고 남는 부분이 월 저축입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="flex flex-wrap gap-3 text-xs" aria-label="막대 범례">
          {SEGMENTS.map(seg => (
            <li key={seg.key} className="flex items-center gap-1.5">
              <span className={'inline-block size-3 rounded-sm ' + seg.className} />
              {seg.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 border-l-2 border-foreground" />월 실수령액
          </li>
        </ul>
        <ul className="space-y-3">
          {sim.scenarios.map(s => <ScenarioRow key={s.key} s={s} scale={scale} />)}
          {sim.unavailable.map(u => (
            <li key={u.key} className="rounded-lg border border-dashed p-3 text-sm">
              <span className="font-semibold">{unavailableLabel(u)}</span>
              <span className="ml-2 text-muted-foreground">계산할 수 없습니다: {u.reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------ 3. 누적 자산 그래프

const W = 760
const H = 340
const M = { left: 72, right: 28, top: 28, bottom: 48 }
const PLOT_W = W - M.left - M.right
const PLOT_H = H - M.top - M.bottom
const LOCAL_COLORS = ['#2563eb', '#0891b2', '#16a34a']
const SEOUL_COLORS: Record<string, string> = {
  seoul_강남구: '#dc2626', seoul_영등포구: '#ea580c', seoul_중구: '#9333ea', seoul_ktx: '#64748b',
}

/** 눈금 간격을 1·2·5 × 10^n 으로 맞춘다 */
function niceTicks(min: number, max: number): number[] {
  const range = max - min
  if (range <= 0) return [0, 1]
  const rough = range / 5
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const unit = [1, 2, 5, 10].find(m => m * magnitude >= rough) ?? 10
  const step = Math.max(1, unit * magnitude)
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
    ticks.push(Math.round(v))
  }
  return ticks
}

function seriesColors(scenarios: Scenario[]): Record<string, string> {
  const colors: Record<string, string> = {}
  let local = 0
  for (const s of scenarios) {
    colors[s.key] = isSeoulScenario(s.key)
      ? SEOUL_COLORS[s.key] ?? '#be185d'
      : LOCAL_COLORS[local++ % LOCAL_COLORS.length]
  }
  return colors
}

export function AssetChartCard({ sim }: { sim: SimulationResponse }) {
  const scenarios = sim.scenarios
  const colors = seriesColors(scenarios)
  const all = scenarios.flatMap(s => s.asset_curve)
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (month: number) => M.left + (month / 60) * PLOT_W
  const y = (value: number) => M.top + (1 - (value - yMin) / (yMax - yMin)) * PLOT_H
  const path = (curve: number[]) => curve.map((v, m) => `${m === 0 ? 'M' : 'L'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>누적 자산 (만 원)</CardTitle>
        <CardDescription>
          같은 조건이 계속된다고 가정한 시나리오입니다. 이자·임금 상승·물가는 반영하지 않았고, 청년 지원금은 지원 기간에만 더했습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img"
          aria-label="0개월부터 60개월까지 시나리오별 누적 자산 선 그래프. 같은 값은 아래 표에 있습니다.">
          {ticks.map(t => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)}
                stroke="currentColor" strokeOpacity={t === 0 ? 0.55 : 0.12} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
                {won(t)}
              </text>
            </g>
          ))}
          {[0, 12, 24, 36, 48, 60].map(m => (
            <text key={m} x={x(m)} y={H - M.bottom + 18} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
              {m}개월
            </text>
          ))}
          {[24, 60].map(m => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={M.top} y2={H - M.bottom}
                stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />
              <text x={x(m)} y={M.top - 10} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-foreground">
                {m === 24 ? '2년' : '5년'}
              </text>
            </g>
          ))}
          {scenarios.map(s => (
            <g key={s.key}>
              <path d={path(s.asset_curve)} fill="none" stroke={colors[s.key]}
                strokeWidth={s.highlight ? 3.5 : 2} strokeLinejoin="round"
                strokeDasharray={s.key === 'seoul_ktx' ? '6 4' : undefined} />
              {[24, 60].map(m => (
                <circle key={m} cx={x(m)} cy={y(s.asset_curve[m])} r={s.highlight ? 4.5 : 3.5} fill={colors[s.key]} />
              ))}
            </g>
          ))}
          <text x={14} y={M.top + PLOT_H / 2} fontSize={11} textAnchor="middle"
            transform={`rotate(-90 14 ${M.top + PLOT_H / 2})`} className="fill-muted-foreground">
            누적 자산 (만 원)
          </text>
        </svg>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="그래프 범례">
          {scenarios.map(s => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="22" height="8" aria-hidden="true">
                <line x1="0" x2="22" y1="4" y2="4" stroke={colors[s.key]} strokeWidth={s.highlight ? 3.5 : 2}
                  strokeDasharray={s.key === 'seoul_ktx' ? '5 3' : undefined} />
              </svg>
              {s.label}{s.highlight && ' (강조)'}
            </li>
          ))}
        </ul>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시나리오</TableHead>
              <TableHead className="text-right">2년 뒤 (24개월)</TableHead>
              <TableHead className="text-right">5년 뒤 (60개월)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenarios.map(s => (
              <TableRow key={s.key} className={s.highlight ? 'bg-primary/5' : ''}>
                <TableCell className="font-medium">
                  <span className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ backgroundColor: colors[s.key] }} />
                  {s.label}
                </TableCell>
                <TableCell className="text-right tabular-nums">{won(s.asset_24)}만 원</TableCell>
                <TableCell className="text-right tabular-nums">{won(s.asset_60)}만 원</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sim.unavailable.length > 0 && (
          <p className="text-xs text-muted-foreground">
            그래프에서 빠진 시나리오: {sim.unavailable.map(u => `${labelForKey(u.key)} (${u.reason})`).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
