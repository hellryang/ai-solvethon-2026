import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, Save, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CapabilityCard } from '@/components/CapabilityCard'
import { ErrorBanner, Field, InfoBanner, NativeSelect } from '@/components/common'
import { ApiError, api, errorMessage, postJson, putJson, TEAM } from '@/lib/api'
import type { Meta, Region, Talent, TalentFields, TalentInput } from '@/types'

type SkillRow = { skill: string; level: number }

type FormState = Omit<TalentFields, 'fixed_expense' | 'portfolio_url' | 'housing_pref'> & {
  fixed_expense: string
  portfolio_url: string
  housing_pref: string
  skills: SkillRow[]
}

const BLANK: FormState = {
  nickname: '', account_type: 'individual', affiliation: '광주 소재 대학 재학',
  desired_category: '개발', work_mode_pref: '무관', desired_regions: ['광주'],
  available_start: '', available_end: '', days_per_week: 5,
  living_type: '자취', home_district: '', commute_mode: '대중교통',
  move_willingness: '현재 거주지에서 통근', housing_pref: '', fixed_expense: '',
  support_eligible: false, narrative: '', portfolio_url: '', skills: [],
}

function fromTalent(t: Talent): FormState {
  return {
    nickname: t.nickname, account_type: t.account_type, affiliation: t.affiliation,
    desired_category: t.desired_category, work_mode_pref: t.work_mode_pref,
    desired_regions: t.desired_regions, available_start: t.available_start,
    available_end: t.available_end, days_per_week: t.days_per_week, living_type: t.living_type,
    home_district: t.home_district, commute_mode: t.commute_mode, move_willingness: t.move_willingness,
    housing_pref: t.housing_pref ?? '', fixed_expense: t.fixed_expense === null ? '' : String(t.fixed_expense),
    support_eligible: t.support_eligible, narrative: t.narrative, portfolio_url: t.portfolio_url ?? '',
    skills: t.skills.map(s => ({ skill: s.skill, level: s.level })),
  }
}

function toInput(form: FormState): TalentInput {
  const { fixed_expense, portfolio_url, housing_pref, skills, ...rest } = form
  return {
    ...rest,
    nickname: rest.nickname.trim(),
    housing_pref: (housing_pref || null) as TalentFields['housing_pref'],
    fixed_expense: fixed_expense.trim() === '' ? null : Number(fixed_expense),
    portfolio_url: portfolio_url.trim() || null,
    skills,
  }
}

/** 서버(422)와 같은 기준으로 먼저 걸러 준다 (R1.3). 서버 검증은 그대로 유지된다. */
function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.nickname.trim()) errors.nickname = '표시명을 입력하세요.'
  if (!form.narrative.trim()) errors.narrative = '서술형 경험을 입력하세요.'
  if (form.desired_regions.length === 0) errors.desired_regions = '희망 근무 지역을 1곳 이상 고르세요.'
  if (!form.home_district) errors.home_district = '현재 거주 구를 고르세요.'
  if (!form.available_start) errors.available_start = '시작일을 입력하세요.'
  if (!form.available_end) errors.available_end = '종료일을 입력하세요.'
  else if (form.available_start && form.available_end < form.available_start) {
    errors.available_end = '종료일은 시작일보다 빠를 수 없습니다.'
  }
  if (form.skills.length === 0) errors.skills = '기술을 1개 이상 추가하세요.'
  const fixed = form.fixed_expense.trim()
  if (fixed !== '' && (!Number.isInteger(Number(fixed)) || Number(fixed) < 0)) {
    errors.fixed_expense = '0 이상의 정수(만 원)를 입력하세요.'
  }
  return errors
}

const signature = (rows: SkillRow[]) =>
  rows.map(r => `${r.skill}:${r.level}`).sort().join('|')

export function ProfileTab({
  meta, talentId, onSaved,
}: {
  meta: Meta
  /** null이면 새 프로필 작성 */
  talentId: number | null
  onSaved: (talent: Talent) => void
}) {
  const [talent, setTalent] = useState<Talent | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  /** 폼에 이미 올라와 있는 인재 id. 방금 저장한 인재를 다시 불러오지 않기 위해 둔다 */
  const loadedId = useRef<number | null>(null)

  useEffect(() => {
    if (talentId !== null && loadedId.current === talentId) return
    setMessage('')
    setFormError('')
    setErrors({})
    if (talentId === null) {
      loadedId.current = null
      setTalent(null)
      setForm(BLANK)
      setLoadError('')
      return
    }
    let ignore = false
    setLoading(true)
    api<Talent>(`${TEAM}/talents/${talentId}`)
      .then(data => {
        if (ignore) return
        loadedId.current = data.id
        setTalent(data)
        setForm(fromTalent(data))
        setLoadError('')
      })
      .catch((e: unknown) => { if (!ignore) setLoadError(errorMessage(e, '프로필을 불러오지 못했습니다.')) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [talentId])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest
    })
  }

  function toggleRegion(region: Region) {
    update('desired_regions', form.desired_regions.includes(region)
      ? form.desired_regions.filter(r => r !== region)
      : [...form.desired_regions, region])
  }

  function setLevel(skill: string, level: number) {
    update('skills', form.skills.map(row => (row.skill === skill ? { ...row, level } : row)))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const found = validate(form)
    setErrors(found)
    setMessage('')
    setFormError('')
    if (Object.keys(found).length > 0) {
      setFormError('입력값을 확인하세요.')
      return
    }
    setSaving(true)
    try {
      const body = toInput(form)
      const saved = talentId === null
        ? await postJson<Talent>(`${TEAM}/talents`, body)
        : await putJson<Talent>(`${TEAM}/talents/${talentId}`, body)
      loadedId.current = saved.id
      setTalent(saved)
      setForm(fromTalent(saved))
      setMessage('프로필을 저장했습니다.')
      onSaved(saved)
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors)
        setFormError('입력값을 확인하세요.')
      } else {
        setFormError(errorMessage(e, '저장에 실패했습니다.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const remainingSkills = meta.skills.filter(s => !form.skills.some(row => row.skill === s))
  const skillsDirty = talent !== null && signature(form.skills) !== signature(talent.skills)

  if (loading && talentId !== null && talent === null) {
    return <p className="text-sm text-muted-foreground">불러오는 중...</p>
  }

  return (
    <div className="space-y-4">
      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      <form onSubmit={e => void submit(e)} noValidate className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{talentId === null ? '새 인재 프로필' : '내 프로필'}</CardTitle>
            <CardDescription>
              실명·연락처·학번·정확한 주소·주민번호·소득/계좌·나이를 쓰지 마세요. 이 폼은 해당 정보를 받지 않습니다.
              표시명은 "인재-01"처럼 별명으로 만드세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Field id="nickname" label="표시명 (필수)" error={errors.nickname}>
                <Input id="nickname" value={form.nickname} maxLength={40} aria-invalid={!!errors.nickname}
                  onChange={e => update('nickname', e.target.value)} />
              </Field>
              <Field id="account_type" label="가입 유형 (필수)">
                <NativeSelect id="account_type" value={form.account_type}
                  onChange={e => update('account_type', e.target.value as FormState['account_type'])}>
                  <option value="individual">개인</option>
                  <option value="team">팀</option>
                </NativeSelect>
              </Field>
              <Field id="affiliation" label="소속 구분 (필수)">
                <NativeSelect id="affiliation" value={form.affiliation}
                  onChange={e => update('affiliation', e.target.value as FormState['affiliation'])}>
                  <option>광주 소재 대학 재학</option>
                  <option>광주 거주 구직자</option>
                </NativeSelect>
              </Field>
            </div>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">희망 조건</legend>
              <div className="grid gap-4 md:grid-cols-3">
                <Field id="desired_category" label="희망 직무 분야 (필수)">
                  <NativeSelect id="desired_category" value={form.desired_category}
                    onChange={e => update('desired_category', e.target.value as FormState['desired_category'])}>
                    {meta.categories.map(c => <option key={c}>{c}</option>)}
                  </NativeSelect>
                </Field>
                <Field id="work_mode_pref" label="근무 형태 선호 (필수)">
                  <NativeSelect id="work_mode_pref" value={form.work_mode_pref}
                    onChange={e => update('work_mode_pref', e.target.value as FormState['work_mode_pref'])}>
                    <option>상주</option>
                    <option>재택</option>
                    <option>무관</option>
                  </NativeSelect>
                </Field>
                <Field id="days_per_week" label="주 근무 가능일 (필수)">
                  <NativeSelect id="days_per_week" value={form.days_per_week}
                    onChange={e => update('days_per_week', Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>주 {n}일</option>)}
                  </NativeSelect>
                </Field>
                <Field id="available_start" label="업무 가능 시작일 (필수)" error={errors.available_start}>
                  <Input id="available_start" type="date" value={form.available_start}
                    aria-invalid={!!errors.available_start}
                    onChange={e => update('available_start', e.target.value)} />
                </Field>
                <Field id="available_end" label="업무 가능 종료일 (필수)" error={errors.available_end}>
                  <Input id="available_end" type="date" value={form.available_end}
                    aria-invalid={!!errors.available_end}
                    onChange={e => update('available_end', e.target.value)} />
                </Field>
                <Field id="region-group" label="희망 근무 지역 (필수, 복수 선택)" error={errors.desired_regions}>
                  <div id="region-group" role="group" className="flex flex-wrap gap-4 py-2">
                    {meta.regions.map(r => (
                      <label key={r} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" className="size-4 accent-primary"
                          checked={form.desired_regions.includes(r)} onChange={() => toggleRegion(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">생활 조건 (정주 시뮬레이션에 쓰입니다)</legend>
              <div className="grid gap-4 md:grid-cols-3">
                <Field id="living_type" label="현재 거주 형태 (필수)">
                  <NativeSelect id="living_type" value={form.living_type}
                    onChange={e => update('living_type', e.target.value as FormState['living_type'])}>
                    <option>자취</option>
                    <option>본가</option>
                    <option>기숙사</option>
                  </NativeSelect>
                </Field>
                <Field id="home_district" label="현재 거주 구 (필수, 구 단위까지만)" error={errors.home_district}>
                  <NativeSelect id="home_district" value={form.home_district}
                    aria-invalid={!!errors.home_district}
                    onChange={e => update('home_district', e.target.value)}>
                    <option value="">선택</option>
                    {meta.gwangju_districts.map(d => <option key={d}>{d}</option>)}
                  </NativeSelect>
                </Field>
                <Field id="commute_mode" label="통근 수단 (필수)"
                  hint="자차 요금 데이터는 없어 대중교통 요금으로 계산합니다.">
                  <NativeSelect id="commute_mode" value={form.commute_mode}
                    onChange={e => update('commute_mode', e.target.value as FormState['commute_mode'])}>
                    <option>대중교통</option>
                    <option>자차</option>
                  </NativeSelect>
                </Field>
                <Field id="move_willingness" label="이사 의향 (필수)">
                  <NativeSelect id="move_willingness" value={form.move_willingness}
                    onChange={e => update('move_willingness', e.target.value as FormState['move_willingness'])}>
                    <option>이사 가능</option>
                    <option>현재 거주지에서 통근</option>
                  </NativeSelect>
                </Field>
                <Field id="housing_pref" label="희망 주거 형태 (선택)">
                  <NativeSelect id="housing_pref" value={form.housing_pref}
                    onChange={e => update('housing_pref', e.target.value)}>
                    <option value="">선택 안 함 (원룸 기준)</option>
                    <option>원룸</option>
                    <option>투룸</option>
                    <option>셰어하우스</option>
                  </NativeSelect>
                </Field>
                <Field id="fixed_expense" label="월 고정 지출 합계 (선택, 만 원)" error={errors.fixed_expense}>
                  <Input id="fixed_expense" type="number" min={0} step={1} inputMode="numeric"
                    value={form.fixed_expense} aria-invalid={!!errors.fixed_expense}
                    onChange={e => update('fixed_expense', e.target.value)} />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary"
                  checked={form.support_eligible}
                  onChange={e => update('support_eligible', e.target.checked)} />
                <span>
                  청년 주거 지원 대상입니다
                  <span className="block text-xs text-muted-foreground">
                    요건을 보고 본인이 판단해 체크합니다. 기본값은 아니오입니다.
                  </span>
                </span>
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">보유 기술과 숙련도 (필수)</legend>
              {form.skills.length > 0 && (
                <ul className="space-y-2">
                  {form.skills.map(row => (
                    <li key={row.skill} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm font-medium">{row.skill}</span>
                      <NativeSelect aria-label={`${row.skill} 숙련도`} className="w-40" value={row.level}
                        onChange={e => setLevel(row.skill, Number(e.target.value))}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>숙련도 {n}</option>)}
                      </NativeSelect>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`${row.skill} 삭제`}
                        onClick={() => update('skills', form.skills.filter(r => r.skill !== row.skill))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="max-w-xs">
                <NativeSelect aria-label="기술 추가" value=""
                  disabled={remainingSkills.length === 0}
                  onChange={e => {
                    if (e.target.value) update('skills', [...form.skills, { skill: e.target.value, level: 3 }])
                  }}>
                  <option value="">+ 기술 추가</option>
                  {remainingSkills.map(s => <option key={s}>{s}</option>)}
                </NativeSelect>
              </div>
              {errors.skills && <p role="alert" className="text-xs text-destructive">{errors.skills}</p>}
              <p className="text-xs text-muted-foreground">숙련도는 1(입문)~5(능숙)입니다. 입력한 값이 그대로 점수 계산에 쓰입니다.</p>
            </fieldset>

            <Field id="narrative" label="서술형 경험 (필수, 최대 1,500자)" error={errors.narrative}
              hint="실명·연락처·학번을 쓰지 마세요.">
              <Textarea id="narrative" rows={5} maxLength={1500} value={form.narrative}
                aria-invalid={!!errors.narrative} onChange={e => update('narrative', e.target.value)} />
              <p className="text-right text-xs text-muted-foreground">{form.narrative.length} / 1,500</p>
            </Field>

            <Field id="portfolio_url" label="포트폴리오 URL (선택)" error={errors.portfolio_url}
              hint="파일 업로드는 지원하지 않고 주소만 저장합니다.">
              <Input id="portfolio_url" type="url" value={form.portfolio_url} placeholder="https://"
                onChange={e => update('portfolio_url', e.target.value)} />
            </Field>

            {formError && <ErrorBanner>{formError}</ErrorBanner>}
            {message && <InfoBanner>{message}</InfoBanner>}

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {talentId === null ? '프로필 저장' : '수정 저장'}
            </Button>
          </CardContent>
        </Card>
      </form>

      {talent !== null && (
        <CapabilityCard
          talent={talent}
          skillsDirty={skillsDirty}
          onChange={(skills, cardMode) => setTalent(prev =>
            prev && { ...prev, skills, card_mode: cardMode === undefined ? prev.card_mode : cardMode })}
        />
      )}
    </div>
  )
}
