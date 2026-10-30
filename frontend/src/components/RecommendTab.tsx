import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AiResult, EmptyState, ErrorBanner } from '@/components/common'
import { api, errorMessage, postJson, TEAM } from '@/lib/api'
import { won } from '@/lib/format'
import type { AiText, RecommendationItem, RecommendationsResponse } from '@/types'

const AI_RANK_LIMIT = 3

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value} / {max}</span>
      </div>
      <div className="h-2 rounded-full bg-muted" role="img" aria-label={`${label} ${value}점 / ${max}점`}>
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const EXCLUDE_REASONS = [
  ['closed', '모집이 마감된 프로젝트'],
  ['category', '희망 직무 분야와 분류가 다른 프로젝트'],
  ['region', '재택이 아니면서 희망 근무 지역에 없는 프로젝트'],
] as const

export function RecommendTab({
  talentId, onSimulate,
}: {
  talentId: number
  onSimulate: (projectId: number) => void
}) {
  const [data, setData] = useState<RecommendationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [explained, setExplained] = useState<Record<number, AiText>>({})
  const [explainBusy, setExplainBusy] = useState<number | null>(null)
  const [explainError, setExplainError] = useState<Record<number, string>>({})

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setExplained({})
    setExplainError({})
    api<RecommendationsResponse>(`${TEAM}/talents/${talentId}/recommendations`)
      .then(res => { if (!ignore) { setData(res); setError('') } })
      .catch((e: unknown) => { if (!ignore) { setData(null); setError(errorMessage(e, '추천을 불러오지 못했습니다.')) } })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [talentId])

  async function explain(item: RecommendationItem) {
    if (explainBusy !== null) return
    const id = item.project.id
    setExplainBusy(id)
    setExplainError(prev => ({ ...prev, [id]: '' }))
    try {
      const result = await postJson<AiText>(`${TEAM}/talents/${talentId}/recommendations/${id}/explain`)
      setExplained(prev => ({ ...prev, [id]: result }))
    } catch (e) {
      setExplainError(prev => ({ ...prev, [id]: errorMessage(e, 'AI 설명 요청에 실패했습니다.') }))
    } finally {
      setExplainBusy(null)
    }
  }

  if (loading && !data) return <p className="text-sm text-muted-foreground">불러오는 중...</p>
  if (error) return <ErrorBanner>{error}</ErrorBanner>
  if (!data) return null

  const excludedTotal = data.excluded.closed + data.excluded.category + data.excluded.region

  return (
    <div className={'space-y-4 ' + (loading ? 'opacity-60' : '')}>
      <Card size="sm">
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>후보 {data.candidates}건</strong> · 제외 {excludedTotal}건
            <span className="text-muted-foreground">
              {' '}(마감 {data.excluded.closed} · 분류 불일치 {data.excluded.category} · 지역 불일치 {data.excluded.region})
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            점수는 코드의 고정 산식으로 계산하며 AI가 관여하지 않습니다. 같은 입력이면 항상 같은 순서가 나옵니다.
          </p>
        </CardContent>
      </Card>

      {data.items.length === 0 ? (
        <EmptyState>
          <p className="font-medium text-foreground">추천할 프로젝트가 없습니다.</p>
          <ul className="mt-2 space-y-1">
            {EXCLUDE_REASONS.filter(([key]) => data.excluded[key] > 0).map(([key, text]) => (
              <li key={key}>{text} {data.excluded[key]}건이 제외되었습니다.</li>
            ))}
          </ul>
          <p className="mt-2">프로필의 희망 직무 분야나 희망 근무 지역을 바꾸면 후보가 늘어날 수 있습니다.</p>
        </EmptyState>
      ) : (
        data.items.map(item => {
          const id = item.project.id
          const explanation = explained[id] ?? item.explanation
          const requiredGaps = item.gaps.filter(g => g.kind === 'required')
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge>{item.rank}위</Badge>
                  {item.project.title}
                </CardTitle>
                <CardDescription>
                  {item.project.company_name} · {item.project.region} · {item.project.work_mode} ·
                  월 {won(item.project.pay_monthly)}만 원 · {item.project.job_family}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{item.score.total}<span className="text-base font-normal text-muted-foreground"> / 100</span></p>
                    <p className="text-xs text-muted-foreground">적합도 점수</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ScoreBar label="기술" value={item.score.skill} max={70} />
                    <ScoreBar label="근무 형태" value={item.score.work_mode} max={15} />
                    <ScoreBar label="일정" value={item.score.schedule} max={15} />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">일치 기술</span>
                    {item.matched.length === 0
                      ? <span className="text-xs text-muted-foreground">없음</span>
                      : item.matched.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">부족 역량</span>
                    {item.gaps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">부족한 기술이 없습니다.</p>
                    ) : (
                      <ul className="space-y-1">
                        {item.gaps.map(g => (
                          <li key={g.skill} className="flex items-center gap-2">
                            <Badge variant={g.kind === 'required' ? 'destructive' : 'outline'}>
                              {g.kind === 'required' ? '필수' : '우대'}
                            </Badge>
                            <span>{g.skill}: 현재 {g.current} → 필요 {g.required}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {requiredGaps.length === 0 && item.gaps.length > 0 && (
                      <p className="text-xs text-muted-foreground">필수 기술은 모두 충족합니다.</p>
                    )}
                  </div>
                </div>

                {item.rank <= AI_RANK_LIMIT ? (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-semibold">추천 이유와 준비 가이드</p>
                    <AiResult
                      result={explanation} busy={explainBusy === id} onRun={() => void explain(item)}
                      runLabel="AI 설명" disabled={explainBusy !== null && explainBusy !== id}
                      error={explainError[id] || undefined}
                    />
                  </div>
                ) : (
                  <p className="border-t pt-4 text-xs text-muted-foreground">
                    AI 설명은 추천 상위 {AI_RANK_LIMIT}개 프로젝트에만 제공합니다.
                  </p>
                )}

                <Button type="button" size="sm" variant="outline" onClick={() => onSimulate(id)}>
                  이 프로젝트로 정주 시뮬레이션 <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
