import { useState, type FormEvent } from 'react'
import { Loader2, Send, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckGroup, ErrorBanner, Field, InfoBanner, NativeSelect } from '@/components/common'
import { ApiError, errorMessage, postJson, TEAM } from '@/lib/api'
import type { Category, Meta, Project, ProjectInput, ProjectSkill, Region, WorkMode } from '@/types'

type FormState = {
  company_name: string
  region: Region
  district: string
  category: Category
  job_family: string
  title: string
  description: string
  work_mode: WorkMode
  onsite_days_per_week: string
  meeting_per_month: string
  pay_monthly: string
  pay_grade: string
  start_date: string
  end_date: string
  housing_support: boolean
  commute_support: boolean
  org_type: string
  industry: string
  style_tags: string[]
  skills: ProjectSkill[]
}

function blank(meta: Meta): FormState {
  const family = meta.job_families.find(f => f.category === '개발')
  return {
    company_name: '', region: meta.regions[0], district: '', category: '개발', job_family: family?.name ?? '',
    title: '', description: '', work_mode: '상주', onsite_days_per_week: '5', meeting_per_month: '2',
    pay_monthly: '', pay_grade: meta.pay_grades[0]?.key ?? '', start_date: '', end_date: '',
    housing_support: false, commute_support: false, org_type: meta.org_types[0], industry: meta.industries[0],
    style_tags: [], skills: [],
  }
}

function toInput(f: FormState): ProjectInput {
  return {
    company_name: f.company_name.trim(), region: f.region, district: f.district.trim(), category: f.category,
    job_family: f.job_family, title: f.title.trim(), description: f.description.trim(), work_mode: f.work_mode,
    onsite_days_per_week: f.work_mode === '재택' ? null : Number(f.onsite_days_per_week),
    meeting_per_month: f.work_mode === '재택' ? Number(f.meeting_per_month) : null,
    pay_monthly: Number(f.pay_monthly), pay_grade: f.pay_grade, start_date: f.start_date, end_date: f.end_date,
    housing_support: f.housing_support, commute_support: f.commute_support, org_type: f.org_type,
    industry: f.industry, style_tags: f.style_tags, skills: f.skills, roles: [],
  }
}

/** 서버(422)와 같은 기준으로 먼저 거른다. 서버 검증은 그대로 유지된다. */
function validate(f: FormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!f.company_name.trim()) errors.company_name = '기업명을 입력하세요.'
  if (!f.district.trim()) errors.district = '동 단위 위치를 입력하세요.'
  if (!f.title.trim()) errors.title = '제목을 입력하세요.'
  if (!f.description.trim()) errors.description = '설명을 입력하세요.'
  const pay = Number(f.pay_monthly)
  if (!f.pay_monthly.trim() || !Number.isInteger(pay) || pay <= 0) errors.pay_monthly = '월 단가(만 원)를 정수로 입력하세요.'
  if (!f.start_date) errors.start_date = '시작일을 입력하세요.'
  if (!f.end_date) errors.end_date = '종료일을 입력하세요.'
  else if (f.start_date && f.end_date < f.start_date) errors.end_date = '종료일은 시작일보다 빠를 수 없습니다.'
  if (f.skills.length === 0) errors.skills = '요구 기술을 1개 이상 추가하세요.'
  return errors
}

/** 기업 담당자 화면: 프로젝트 등록. 지역은 광주·나주·광양만 고를 수 있다 (R3.4). */
export function CompanyTab({ meta }: { meta: Meta }) {
  const [form, setForm] = useState<FormState>(() => blank(meta))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest
    })
    setMessage('')
  }

  function changeCategory(category: Category) {
    const first = meta.job_families.find(f => f.category === category)
    setForm(prev => ({ ...prev, category, job_family: first?.name ?? '' }))
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
      const created = await postJson<Project>(`${TEAM}/projects`, toInput(form))
      setMessage(`"${created.title}" 공고를 등록했습니다. 인재 역할로 바꿔 "선호·새 공고" 탭에서 확인하세요.`)
      setForm(prev => ({ ...blank(meta), company_name: prev.company_name, region: prev.region, org_type: prev.org_type, industry: prev.industry }))
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors)
        setFormError('입력값을 확인하세요.')
      } else {
        setFormError(errorMessage(e, '등록에 실패했습니다.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const families = meta.job_families.filter(f => f.category === form.category)
  const remaining = meta.skills.filter(s => !form.skills.some(row => row.skill === s))

  return (
    <form onSubmit={e => void submit(e)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 등록 (기업 담당자)</CardTitle>
          <CardDescription>
            등록한 공고는 바로 인재 화면의 신규 공고에 나타납니다. 지역은 광주·나주·광양만 가능하고, 서울 공고는 등록할 수 없습니다.
            시연용 기능이며 실제 채용 공고가 아닙니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="company_name" label="기업명 (필수)" error={errors.company_name}
              hint="실제 기업명이 아니라 시연용 이름을 쓰세요.">
              <Input id="company_name" value={form.company_name} maxLength={60}
                aria-invalid={!!errors.company_name} onChange={e => update('company_name', e.target.value)} />
            </Field>
            <Field id="region" label="지역 (필수)" error={errors.region}>
              <NativeSelect id="region" value={form.region} onChange={e => update('region', e.target.value as Region)}>
                {meta.regions.map(r => <option key={r}>{r}</option>)}
              </NativeSelect>
            </Field>
            <Field id="district" label="상세 위치 (동 단위, 필수)" error={errors.district}>
              <Input id="district" value={form.district} maxLength={40}
                aria-invalid={!!errors.district} onChange={e => update('district', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field id="org_type" label="기업 유형 (필수)" error={errors.org_type}>
              <NativeSelect id="org_type" value={form.org_type} onChange={e => update('org_type', e.target.value)}>
                {meta.org_types.map(o => <option key={o}>{o}</option>)}
              </NativeSelect>
            </Field>
            <Field id="industry" label="산업 (필수)" error={errors.industry}>
              <NativeSelect id="industry" value={form.industry} onChange={e => update('industry', e.target.value)}>
                {meta.industries.map(o => <option key={o}>{o}</option>)}
              </NativeSelect>
            </Field>
            <div className="md:col-span-3">
              <CheckGroup label="기업 특성 태그 (선택, 시연용 가정값)" options={meta.style_tags} value={form.style_tags}
                max={3} onChange={v => update('style_tags', v)} error={errors.style_tags} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field id="category" label="분류 (필수)">
              <NativeSelect id="category" value={form.category} onChange={e => changeCategory(e.target.value as Category)}>
                {meta.categories.map(c => <option key={c}>{c}</option>)}
              </NativeSelect>
            </Field>
            <Field id="job_family" label="직무군 (필수)" error={errors.job_family}>
              <NativeSelect id="job_family" value={form.job_family} onChange={e => update('job_family', e.target.value)}>
                {families.map(f => <option key={f.name}>{f.name}</option>)}
              </NativeSelect>
            </Field>
            <Field id="title" label="제목 (필수)" error={errors.title}>
              <Input id="title" value={form.title} maxLength={80}
                aria-invalid={!!errors.title} onChange={e => update('title', e.target.value)} />
            </Field>
          </div>

          <Field id="description" label="설명 (필수)" error={errors.description}>
            <Textarea id="description" rows={4} maxLength={1500} value={form.description}
              aria-invalid={!!errors.description} onChange={e => update('description', e.target.value)} />
          </Field>

          <div className="grid gap-4 md:grid-cols-4">
            <Field id="work_mode" label="근무 형태 (필수)">
              <NativeSelect id="work_mode" value={form.work_mode} onChange={e => update('work_mode', e.target.value as WorkMode)}>
                {meta.work_modes.map(m => <option key={m}>{m}</option>)}
              </NativeSelect>
            </Field>
            {form.work_mode === '재택' ? (
              <Field id="meeting_per_month" label="월 대면 미팅 횟수 (필수)" error={errors.meeting_per_month}>
                <Input id="meeting_per_month" type="number" min={0} step={1} value={form.meeting_per_month}
                  onChange={e => update('meeting_per_month', e.target.value)} />
              </Field>
            ) : (
              <Field id="onsite_days_per_week" label="주 출근일 (필수)" error={errors.onsite_days_per_week}>
                <NativeSelect id="onsite_days_per_week" value={form.onsite_days_per_week}
                  onChange={e => update('onsite_days_per_week', e.target.value)}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>주 {n}일</option>)}
                </NativeSelect>
              </Field>
            )}
            <Field id="pay_monthly" label="월 단가 (필수, 만 원)" error={errors.pay_monthly}>
              <Input id="pay_monthly" type="number" min={1} step={1} inputMode="numeric" value={form.pay_monthly}
                aria-invalid={!!errors.pay_monthly} onChange={e => update('pay_monthly', e.target.value)} />
            </Field>
            <Field id="pay_grade" label="단가 등급 (필수)">
              <NativeSelect id="pay_grade" value={form.pay_grade} onChange={e => update('pay_grade', e.target.value)}>
                {meta.pay_grades.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </NativeSelect>
            </Field>
            <Field id="start_date" label="시작일 (필수)" error={errors.start_date}>
              <Input id="start_date" type="date" value={form.start_date} aria-invalid={!!errors.start_date}
                onChange={e => update('start_date', e.target.value)} />
            </Field>
            <Field id="end_date" label="종료일 (필수)" error={errors.end_date}>
              <Input id="end_date" type="date" value={form.end_date} aria-invalid={!!errors.end_date}
                onChange={e => update('end_date', e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form.housing_support}
                onChange={e => update('housing_support', e.target.checked)} />
              숙소 제공
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form.commute_support}
                onChange={e => update('commute_support', e.target.checked)} />
              교통비 지원
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">요구 기술 (필수)</legend>
            {form.skills.length > 0 && (
              <ul className="space-y-2">
                {form.skills.map(row => (
                  <li key={row.skill} className="flex flex-wrap items-center gap-3">
                    <span className="w-36 shrink-0 text-sm font-medium">{row.skill}</span>
                    <NativeSelect aria-label={`${row.skill} 최소 숙련도`} className="w-40" value={row.min_level}
                      onChange={e => update('skills', form.skills.map(s => s.skill === row.skill ? { ...s, min_level: Number(e.target.value) } : s))}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>최소 숙련도 {n}</option>)}
                    </NativeSelect>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" className="size-4 accent-primary" checked={row.is_required}
                        onChange={e => update('skills', form.skills.map(s => s.skill === row.skill ? { ...s, is_required: e.target.checked } : s))} />
                      필수
                    </label>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`${row.skill} 삭제`}
                      onClick={() => update('skills', form.skills.filter(s => s.skill !== row.skill))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="max-w-xs">
              <NativeSelect aria-label="요구 기술 추가" value="" disabled={remaining.length === 0}
                onChange={e => {
                  if (e.target.value) update('skills', [...form.skills, { skill: e.target.value, min_level: 3, is_required: true }])
                }}>
                <option value="">+ 기술 추가</option>
                {remaining.map(s => <option key={s}>{s}</option>)}
              </NativeSelect>
            </div>
            {errors.skills && <p role="alert" className="text-xs text-destructive">{errors.skills}</p>}
          </fieldset>

          {formError && <ErrorBanner>{formError}</ErrorBanner>}
          {message && <InfoBanner>{message}</InfoBanner>}
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Send />}
            공고 등록
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
