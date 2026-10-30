import { useEffect, useState } from 'react'
import { BellRing, Loader2, Save, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AiResult, AssumptionBadge, CheckGroup, EmptyState, ErrorBanner, Field, InfoBanner, NativeSelect,
} from '@/components/common'
import { ApiError, api, errorMessage, postJson, putJson, TEAM } from '@/lib/api'
import { won } from '@/lib/format'
import type {
  AiText, CompanyOption, Meta, Preference, PreferenceFields, PreferenceMatchItem,
  PreferenceMatchesResponse,
} from '@/types'

const EMPTY: PreferenceFields = {
  org_types: [], industries: [], style_tags: [], preferred_skills: [], favorite_companies: [],
}
const MAX_FAVORITES = 3
const AI_RANK_LIMIT = 3

const isEmpty = (p: PreferenceFields) =>
  p.org_types.length + p.industries.length + p.style_tags.length +
  p.preferred_skills.length + p.favorite_companies.length === 0

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
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

function MatchCard({
  item, explanation, busy, anyBusy, error, onExplain,
}: {
  item: PreferenceMatchItem
  explanation: AiText | null
  busy: boolean
  anyBusy: boolean
  error?: string
  onExplain: () => void
}) {
  const { project: p, pref, similar_to: similar } = item
  const m = pref.matched
  const matchedAny = m.org_types.length + m.industries.length + m.style_tags.length + m.skills.length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Badge>{item.rank}위</Badge>
          {p.title}
          {p.is_new && <Badge variant="destructive">신규</Badge>}
          {item.favorite_rank !== null && (
            <Badge variant="secondary"><Star /> 관심 기업 {item.favorite_rank}순위</Badge>
          )}
          {similar && <Badge variant="outline">관심 기업과 비슷함</Badge>}
        </CardTitle>
        <CardDescription>
          {p.company_name} · {p.region} · {p.work_mode} · 월 {won(p.pay_monthly)}만 원 · {p.org_type} · {p.industry}
          {p.style_tags.length > 0 && <> · {p.style_tags.join(', ')} <AssumptionBadge title="기업 특성 태그는 시연용 가정값입니다" /></>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {pref.total}<span className="text-base font-normal text-muted-foreground"> / 100</span>
            </p>
            <p className="text-xs text-muted-foreground">선호 일치도</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Bar label="기업 유형" value={pref.org_type} max={25} />
            <Bar label="산업" value={pref.industry} max={25} />
            <Bar label="특성 태그" value={pref.style} max={20} />
            <Bar label="선호 기술" value={pref.stack} max={30} />
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {matchedAny ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">일치한 선호</span>
              {[...m.org_types, ...m.industries, ...m.style_tags, ...m.skills].map(x => (
                <Badge key={x} variant="secondary">{x}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">직접 고른 선호와 겹치는 속성이 없습니다.</p>
          )}
          {similar && (
            <p className="text-xs">
              관심 기업 <strong>{similar.company}</strong>과 비슷합니다 (유사도 {similar.similarity}/100):
              {similar.same_org_type && ' 기업 유형 같음,'}
              {similar.same_industry && ' 산업 같음,'}
              {' '}공통 기술 {similar.shared_skills.length > 0 ? similar.shared_skills.join(', ') : '없음'}
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p>
            내 기술 적합도 <strong className="tabular-nums">{item.fit.total}</strong> / 100
            <span className="text-muted-foreground"> (기술 {item.fit.skill}/70 · 근무 형태 {item.fit.work_mode}/15 · 일정 {item.fit.schedule}/15)</span>
          </p>
          {item.gaps.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {item.gaps.map(g => (
                <li key={g.skill} className="flex items-center gap-2 text-xs">
                  <Badge variant={g.kind === 'required' ? 'destructive' : 'outline'}>
                    {g.kind === 'required' ? '필수' : '우대'}
                  </Badge>
                  {g.skill}: 현재 {g.current} → 필요 {g.required}
                </li>
              ))}
            </ul>
          )}
        </div>

        {item.rank <= AI_RANK_LIMIT ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-semibold">왜 맞는지 (선택 기능)</p>
            <AiResult
              result={explanation} busy={busy} onRun={onExplain} runLabel="AI 설명"
              disabled={anyBusy && !busy} error={error}
            />
          </div>
        ) : (
          <p className="border-t pt-4 text-xs text-muted-foreground">AI 설명은 상위 {AI_RANK_LIMIT}개 공고에만 제공합니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PreferenceTab({ talentId, meta }: { talentId: number; meta: Meta }) {
  const [form, setForm] = useState<PreferenceFields>(EMPTY)
  const [saved, setSaved] = useState<Preference | null>(null)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [scope, setScope] = useState<'new' | 'all'>('all')
  const [result, setResult] = useState<PreferenceMatchesResponse | null>(null)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [explained, setExplained] = useState<Record<number, AiText>>({})
  const [explainBusy, setExplainBusy] = useState<number | null>(null)
  const [explainError, setExplainError] = useState<Record<number, string>>({})

  useEffect(() => {
    let ignore = false
    setMessage('')
    Promise.all([
      api<Preference>(`${TEAM}/talents/${talentId}/preferences`),
      api<CompanyOption[]>(`${TEAM}/companies`),
    ])
      .then(([pref, list]) => {
        if (ignore) return
        setSaved(pref)
        const { exists: _exists, last_seen_at: _seen, ...fields } = pref
        setForm(fields)
        setCompanies(list)
        setErrors({})
        setError('')
      })
      .catch((e: unknown) => { if (!ignore) setError(errorMessage(e, '선호를 불러오지 못했습니다.')) })
    return () => { ignore = true }
  }, [talentId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setExplained({})
    setExplainError({})
    api<PreferenceMatchesResponse>(`${TEAM}/talents/${talentId}/preference-matches?scope=${scope}`)
      .then(res => { if (!ignore) { setResult(res); setError('') } })
      .catch((e: unknown) => { if (!ignore) { setResult(null); setError(errorMessage(e, '목록을 불러오지 못했습니다.')) } })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [talentId, scope, reload])

  function update<K extends keyof PreferenceFields>(key: K, value: PreferenceFields[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest
    })
    setMessage('')
  }

  function setFavorite(slot: number, company: string) {
    const next = [...form.favorite_companies]
    if (company === '') next.splice(slot, 1)
    else next[slot] = company
    update('favorite_companies', next.filter(Boolean))
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const pref = await putJson<Preference>(`${TEAM}/talents/${talentId}/preferences`, form)
      setSaved(pref)
      setErrors({})
      setMessage('선호를 저장했습니다. 아래 목록의 순서가 바뀝니다.')
      setReload(n => n + 1)
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors)
      else setError(errorMessage(e, '저장에 실패했습니다.'))
    } finally {
      setSaving(false)
    }
  }

  async function markSeen() {
    if (marking) return
    setMarking(true)
    try {
      setSaved(await postJson<Preference>(`${TEAM}/talents/${talentId}/preference-matches/seen`))
      setReload(n => n + 1)
    } catch (e) {
      setError(errorMessage(e, '확인 처리에 실패했습니다.'))
    } finally {
      setMarking(false)
    }
  }

  async function explain(item: PreferenceMatchItem) {
    if (explainBusy !== null) return
    const id = item.project.id
    setExplainBusy(id)
    setExplainError(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await postJson<AiText>(`${TEAM}/talents/${talentId}/preference-matches/${id}/explain`, { scope })
      setExplained(prev => ({ ...prev, [id]: res }))
    } catch (e) {
      setExplainError(prev => ({ ...prev, [id]: errorMessage(e, 'AI 설명 요청에 실패했습니다.') }))
    } finally {
      setExplainBusy(null)
    }
  }

  const dirty = saved !== null && JSON.stringify(form) !== JSON.stringify({
    org_types: saved.org_types, industries: saved.industries, style_tags: saved.style_tags,
    preferred_skills: saved.preferred_skills, favorite_companies: saved.favorite_companies,
  })
  const savedEmpty = saved !== null && isEmpty(saved)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>내가 원하는 기업</CardTitle>
          <CardDescription>
            기업 유형·산업·특성·기술과 관심 기업을 정해 두면, 새로 올라온 공고를 조건이 가까운 순서로 보여 줍니다.
            모든 항목은 선택이며, 비워 두면 "상관없음"입니다. 관심 기업은 광주·나주·광양의 등록된 기업만 고를 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <CheckGroup label="선호 기업 유형" options={meta.org_types} value={form.org_types}
              onChange={v => update('org_types', v)} error={errors.org_types} />
            <CheckGroup label="선호 산업" options={meta.industries} value={form.industries}
              onChange={v => update('industries', v)} error={errors.industries} />
          </div>
          <div className="space-y-1">
            <CheckGroup label="선호 기업 특성" options={meta.style_tags} value={form.style_tags} max={3}
              onChange={v => update('style_tags', v)} error={errors.style_tags} />
            <p className="text-xs text-muted-foreground">특성 태그는 시연용 가정값입니다.</p>
          </div>
          <CheckGroup label="선호 기술" options={meta.skills} value={form.preferred_skills}
            onChange={v => update('preferred_skills', v)} error={errors.preferred_skills} />

          <div className="space-y-2">
            <span className="text-sm font-medium">관심 기업 (우선순위 순, 최대 {MAX_FAVORITES}개)</span>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: MAX_FAVORITES }, (_, slot) => {
                const chosen = form.favorite_companies[slot] ?? ''
                const taken = form.favorite_companies.filter((_, i) => i !== slot)
                return (
                  <Field key={slot} id={`favorite-${slot}`} label={`${slot + 1}순위`}>
                    <NativeSelect id={`favorite-${slot}`} value={chosen}
                      disabled={slot > form.favorite_companies.length}
                      onChange={e => setFavorite(slot, e.target.value)}>
                      <option value="">선택 안 함</option>
                      {companies.map(c => (
                        <option key={c.company_name} value={c.company_name} disabled={taken.includes(c.company_name)}>
                          {c.company_name} · {c.region} · {c.org_type}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )
              })}
            </div>
            {errors.favorite_companies && (
              <p role="alert" className="text-xs text-destructive">{errors.favorite_companies}</p>
            )}
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}
          {message && <InfoBanner>{message}</InfoBanner>}
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            선호 저장
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="목록 범위" className="flex gap-1">
          <Button type="button" size="sm" variant={scope === 'all' ? 'default' : 'outline'}
            aria-pressed={scope === 'all'} onClick={() => setScope('all')}>전체 공고</Button>
          <Button type="button" size="sm" variant={scope === 'new' ? 'default' : 'outline'}
            aria-pressed={scope === 'new'} onClick={() => setScope('new')}>
            신규 공고{result?.preference_set ? ` ${result.new_count}건` : ''}
          </Button>
        </div>
        {result?.preference_set && result.new_count > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => void markSeen()} disabled={marking}>
            {marking ? <Loader2 className="animate-spin" /> : <BellRing />}
            새 공고 확인했음
          </Button>
        )}
      </div>

      {dirty && <InfoBanner>저장하지 않은 선호가 있습니다. 저장하면 목록 순서가 바뀝니다.</InfoBanner>}
      {savedEmpty && result?.preference_set && (
        <InfoBanner>선호를 설정하면 정렬이 바뀝니다. 지금은 내 기술 적합도 순입니다.</InfoBanner>
      )}

      <div className={'space-y-4 ' + (loading ? 'opacity-60' : '')}>
        {result === null ? (
          loading ? <p className="text-sm text-muted-foreground">불러오는 중...</p> : null
        ) : !result.preference_set ? (
          <EmptyState>
            선호를 저장하면 새로 올라온 공고를 조건이 가까운 순서로 보여 줍니다. 위에서 선호를 고르고 저장해 보세요.
            비워 두고 저장해도 됩니다.
          </EmptyState>
        ) : result.items.length === 0 ? (
          <EmptyState>
            <p className="font-medium text-foreground">
              {scope === 'new' ? '새로 올라온 공고가 없습니다.' : '보여줄 공고가 없습니다.'}
            </p>
            <p className="mt-1">
              제외된 공고: 마감 {result.excluded.closed}건 · 분류 불일치 {result.excluded.category}건 · 지역 불일치 {result.excluded.region}건
            </p>
            <p className="mt-1">기업 역할로 새 프로젝트를 등록하면 여기에 나타납니다.</p>
          </EmptyState>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              후보 {result.candidates}건 (제외: 마감 {result.excluded.closed} · 분류 불일치 {result.excluded.category} · 지역 불일치 {result.excluded.region}).
              정렬: 관심 기업 → 선호 일치도 → 관심 기업과의 유사도 → 내 기술 적합도.
              점수는 코드가 계산하며 AI가 관여하지 않습니다.
            </p>
            {result.items.map(item => (
              <MatchCard
                key={item.project.id} item={item}
                explanation={explained[item.project.id] ?? item.explanation}
                busy={explainBusy === item.project.id} anyBusy={explainBusy !== null}
                error={explainError[item.project.id] || undefined}
                onExplain={() => void explain(item)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
