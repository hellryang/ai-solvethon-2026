import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AiResult, EmptyState, ErrorBanner, Field, NativeSelect,
} from '@/components/common'
import { AssetChartCard, PayCompareCard, SavingBarsCard } from '@/components/SimulationParts'
import { api, errorMessage, postJson, TEAM } from '@/lib/api'
import { highlighted, REQUIRED_NOTICES, scenarioByKey, signed, won } from '@/lib/format'
import type { AiText, ProjectListItem, Scenario, SimulationResponse } from '@/types'

const MODE_LABEL: Record<SimulationResponse['mode'], string> = {
  relocate_vs_commute: '이사 vs 통근 비교 (상주·혼합 프로젝트)',
  residence_compare: '거주지 비교 (재택 프로젝트): 광주·나주·광양에 살 때',
}

function whoHasMore(diff: number, local: Scenario, seoul: Scenario): string {
  if (diff === 0) return '같음'
  return diff > 0
    ? `서울 ${seoul.residence} 쪽이 ${won(diff)}만 원 더 남음`
    : `${local.label} 쪽이 ${won(-diff)}만 원 더 남음`
}

function SummaryCard({ sim }: { sim: SimulationResponse }) {
  const local = highlighted(sim)
  const seoul = sim.summary.best_seoul ? scenarioByKey(sim, sim.summary.best_seoul) : undefined

  if (!local || !seoul) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>요약</CardTitle>
          <CardDescription>
            강조 시나리오와 서울 3개 구 중 가장 많이 남는 구를 비교합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState>
            비교할 수 있는 시나리오가 없습니다. 서울 월세 등 필요한 데이터가 비어 있으면 숫자를 지어내지 않고 비교를 건너뜁니다.
          </EmptyState>
        </CardContent>
      </Card>
    )
  }

  // 부호 규칙이 계약에 없어도 틀리지 않도록 시나리오 값에서 직접 계산한다 (서울 − 지역).
  const rows = [
    { label: '월 저축 (지원 기간 중)', local: local.saving_with_support, seoul: seoul.saving_with_support },
    { label: '2년 뒤 자산 (24개월)', local: local.asset_24, seoul: seoul.asset_24 },
    { label: '5년 뒤 자산 (60개월)', local: local.asset_60, seoul: seoul.asset_60 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>요약: {local.label} vs 서울 {seoul.residence}</CardTitle>
        <CardDescription>
          서울 3개 구 중 5년 뒤 자산이 가장 큰 구와 비교합니다. 차이는 "서울 − 지역"이며, 어느 쪽이 낫다고 단정하지 않습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>항목 (만 원)</TableHead>
              <TableHead className="text-right">{local.label}</TableHead>
              <TableHead className="text-right">서울 {seoul.residence}</TableHead>
              <TableHead className="text-right">차이</TableHead>
              <TableHead>더 남는 쪽</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => {
              const diff = row.seoul - row.local
              return (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{won(row.local)}</TableCell>
                  <TableCell className="text-right tabular-nums">{won(row.seoul)}</TableCell>
                  <TableCell className="text-right tabular-nums">{signed(diff)}</TableCell>
                  <TableCell>{whoHasMore(diff, local, seoul)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function SimulationTab({
  talentId, projectId, onProjectChange,
}: {
  talentId: number
  projectId: number | null
  onProjectChange: (id: number) => void
}) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [listError, setListError] = useState('')
  const [sim, setSim] = useState<SimulationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [explanation, setExplanation] = useState<AiText | null>(null)
  const [explainBusy, setExplainBusy] = useState(false)
  const [explainError, setExplainError] = useState('')

  useEffect(() => {
    let ignore = false
    api<ProjectListItem[]>(`${TEAM}/projects`)
      .then(list => {
        if (ignore) return
        setProjects(list.filter(p => p.status === 'open'))
        setListError('')
      })
      .catch((e: unknown) => { if (!ignore) setListError(errorMessage(e, '프로젝트 목록을 불러오지 못했습니다.')) })
    return () => { ignore = true }
  }, [])

  // 고른 프로젝트가 없으면 목록의 첫 프로젝트를 쓴다.
  const activeId = projectId ?? projects[0]?.id ?? null

  useEffect(() => {
    setExplanation(null)
    setExplainError('')
    if (activeId === null) { setSim(null); return }
    let ignore = false
    setLoading(true)
    api<SimulationResponse>(`${TEAM}/talents/${talentId}/simulation?project_id=${activeId}`)
      .then(res => { if (!ignore) { setSim(res); setError('') } })
      .catch((e: unknown) => { if (!ignore) { setSim(null); setError(errorMessage(e, '시뮬레이션을 불러오지 못했습니다.')) } })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [talentId, activeId])

  async function explain() {
    if (explainBusy || activeId === null) return
    setExplainBusy(true)
    setExplainError('')
    try {
      setExplanation(await postJson<AiText>(`${TEAM}/talents/${talentId}/simulation/explain`, { project_id: activeId }))
    } catch (e) {
      setExplainError(errorMessage(e, 'AI 설명 요청에 실패했습니다.'))
    } finally {
      setExplainBusy(false)
    }
  }

  const notices = sim
    ? [...sim.notices, ...REQUIRED_NOTICES.filter(n => !sim.notices.includes(n))]
    : [...REQUIRED_NOTICES]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>정주 시뮬레이션</CardTitle>
          <CardDescription>
            프로젝트를 하면 매달 얼마가 남고 2년·5년 뒤 자산이 얼마가 되는지, 서울에서 같은 직무를 할 때와 나란히 봅니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field id="sim-project" label="프로젝트 선택" className="max-w-xl">
            <NativeSelect id="sim-project" value={activeId ?? ''} disabled={projects.length === 0}
              onChange={e => onProjectChange(Number(e.target.value))}>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.region} · {p.work_mode} · {p.title} (월 {p.pay_monthly}만 원)
                </option>
              ))}
            </NativeSelect>
          </Field>
          {sim && <Badge variant="secondary">{MODE_LABEL[sim.mode]}</Badge>}
        </CardContent>
      </Card>

      {listError && <ErrorBanner>{listError}</ErrorBanner>}
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {loading && !sim && <p className="text-sm text-muted-foreground">계산 중...</p>}

      {sim && (
        <div className={'space-y-4 ' + (loading ? 'opacity-60' : '')}>
          <PayCompareCard sim={sim} />
          <SavingBarsCard sim={sim} />
          <AssetChartCard sim={sim} />
          <SummaryCard sim={sim} />

          <Card>
            <CardHeader>
              <CardTitle>AI 설명</CardTitle>
              <CardDescription>
                위 숫자는 코드가 계산했고, AI는 이미 계산된 값을 문장으로 풀어 줍니다. AI가 실패해도 숫자와 그래프는 그대로 보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiResult result={explanation} busy={explainBusy} onRun={() => void explain()}
                runLabel="AI 설명" error={explainError || undefined} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card size="sm" className="bg-muted/40">
        <CardContent>
          <div className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <ul className="space-y-1" aria-label="고지 문구">
              {notices.map(n => <li key={n}>{n}</li>)}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
