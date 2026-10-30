import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AssumptionBadge, EmptyState, ErrorBanner } from '@/components/common'
import { api, errorMessage, TEAM } from '@/lib/api'
import type { StackDemandResponse, StackGroup, StackItem } from '@/types'

const STATUS_LABEL: Record<StackItem['status'], string> = {
  none: '미보유',
  low: '숙련도 낮음',
  ok: '보유',
}

function DemandRow({ item, showMetro }: { item: StackItem; showMetro: boolean }) {
  const share = item.share_pct
  const metro = item.metro_share_pct
  return (
    <li className="space-y-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{item.skill}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">내 숙련도 {item.my_level} / 5</span>
          <Badge variant={item.status === 'ok' ? 'secondary' : item.status === 'low' ? 'outline' : 'destructive'}>
            {STATUS_LABEL[item.status]}
          </Badge>
        </span>
      </div>

      {share === null ? (
        <p className="text-xs text-muted-foreground">집계 데이터 입력 전</p>
      ) : (
        <div className="space-y-1">
          <div className="relative h-3 rounded-full bg-muted" role="img"
            aria-label={`${item.skill}: 지역 공고 ${share}%${showMetro && metro !== null ? `, 수도권 ${metro}%` : ''}`}>
            <div className="h-3 rounded-full bg-primary" style={{ width: `${share}%` }} />
            {showMetro && metro !== null && (
              <div title={`수도권 ${metro}%`} className="absolute -top-1 h-5 border-l-2 border-amber-500"
                style={{ left: `${metro}%` }} />
            )}
          </div>
          <p className="text-xs tabular-nums">
            지역 공고 <strong>{share}%</strong>가 요구
            {showMetro && (
              <span className="text-muted-foreground">
                {' '}· 수도권 {metro === null ? '비교 값 없음' : `${metro}%`}
              </span>
            )}
          </p>
        </div>
      )}
    </li>
  )
}

function GroupView({ group }: { group: StackGroup }) {
  const showMetro = group.metro_sample_n !== null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">
          {group.sample_n === null ? '표본 수 미정' : `표본 ${group.sample_n}건`}
        </Badge>
        {group.small_sample && <Badge variant="destructive">표본 적음</Badge>}
        {group.is_assumption && <AssumptionBadge title="확인 전이거나 표본이 작은 값입니다" />}
        {showMetro && <Badge variant="outline">{group.metro_label} {group.metro_sample_n}건</Badge>}
        <span className="text-muted-foreground">
          수집일 {group.collected_at ?? '미정'} · 출처 {group.source}
        </span>
      </div>

      {!group.data_ready || group.items.length === 0 ? (
        <EmptyState>
          이 기업 유형은 집계 데이터 입력 전입니다. 숫자를 추정해서 채우지 않습니다.
        </EmptyState>
      ) : (
        <>
          {showMetro && (
            <p className="text-xs text-muted-foreground">
              막대는 지역 공고에서 요구한 비율이고, 주황색 세로선은 수도권 표본의 같은 기술 비율입니다.
            </p>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {group.items.map(item => <DemandRow key={item.skill} item={item} showMetro={showMetro} />)}
          </ul>
        </>
      )}
    </div>
  )
}

export function StackDemandTab({ talentId }: { talentId: number }) {
  const [data, setData] = useState<StackDemandResponse | null>(null)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api<StackDemandResponse>(`${TEAM}/stack-demand?talent_id=${talentId}`)
      .then(res => { if (!ignore) { setData(res); setError('') } })
      .catch((e: unknown) => { if (!ignore) { setData(null); setError(errorMessage(e, '기술 수요를 불러오지 못했습니다.')) } })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [talentId])

  const active = data?.groups.find(g => g.group === selected) ?? data?.groups[0]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>광주·전남 기업은 어떤 기술을 요구할까</CardTitle>
          <CardDescription>
            기업 유형별로, 수집한 공고 중 그 기술을 요구한 비율입니다. 수도권 인기 기술과 지역이 요구하는 기술은 다를 수 있습니다.
            비율은 공고 표본의 집계이며 표본 수가 작으면 크게 흔들립니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && (
            <div role="group" aria-label="기업 유형" className="flex flex-wrap gap-1.5">
              {data.groups.map(g => (
                <button
                  key={g.group} type="button" aria-pressed={active?.group === g.group}
                  onClick={() => setSelected(g.group)}
                  className={'rounded-lg border px-3 py-1.5 text-sm ' +
                    (active?.group === g.group ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                >
                  {g.group}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {loading && !data && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {active && (
        <Card className={loading ? 'opacity-60' : ''}>
          <CardHeader>
            <CardTitle>{active.group}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupView group={active} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
