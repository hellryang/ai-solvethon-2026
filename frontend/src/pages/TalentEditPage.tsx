// 내 PR 올리기·고치기. 기술은 묶음 칩에서 고르고(없으면 직접 추가), 사진은 최대 3장 (첫 장이 대표 사진).
// 서버 메모리에 저장되므로 서버를 다시 켜면 사라진다 (10/30 결정).

import { useEffect, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Loader2, Minus, Plus, X } from 'lucide-react'

import { EmptyState, ErrorBanner, Field } from '@/components/common'
import { ChoiceChips } from '@/components/talents/ChoiceChips'
import { ImagePicker } from '@/components/talents/ImagePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, errorMessage } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import {
  createTalent, imageUrlToDataUrl, MAX_PR_IMAGES, MAX_PR_SKILLS, MEMBER_TYPES, ownedPr, PR_LEVELS, PR_REGIONS,
  PR_WORK_MODES, saveOwnedPr, updateTalent,
} from '@/lib/talents'
import { useTalent } from '@/lib/useTalents'
import { cn } from '@/lib/utils'
import type { PrRegion, TalentPR, TalentPRInput } from '@/types'

/** 고를 수 있는 기술 묶음. 여기 없는 기술은 [+ 직접 추가]로 넣는다 */
const SKILL_GROUPS: { name: string; items: string[] }[] = [
  { name: 'AI·데이터', items: ['Python', 'SQL', '데이터 분석', '데이터 시각화', 'Tableau', '머신러닝', '컴퓨터 비전', '자연어 처리', '생성형 AI 활용', 'RAG', '시계열 예측'] },
  { name: '백엔드', items: ['Java', 'Spring', '전자정부 표준프레임워크', 'JSP', 'FastAPI', '백엔드 API', '데이터베이스', 'Oracle', 'MySQL'] },
  { name: '프론트·디자인', items: ['React', 'TypeScript', 'HTML/CSS', 'jQuery', '모바일 앱', 'Figma', 'UI/UX 디자인'] },
  { name: '임베디드·인프라', items: ['C', '임베디드', 'IoT 센서', 'PLC', '클라우드 배포', 'Git'] },
]
const KNOWN_SKILLS = new Set(SKILL_GROUPS.flatMap(g => g.items))

interface TalentEditPageProps {
  talentId: number | null
  /** 남는 돈 계산에 쓴 기술. 새 PR을 만들 때 미리 채운다 (고칠 수 있다) */
  suggestedSkills: string[]
  suggestedRegion: string | null
}

export function TalentEditPage({ talentId, suggestedSkills, suggestedRegion }: TalentEditPageProps) {
  if (talentId === null) {
    const region = PR_REGIONS.find(r => r === suggestedRegion)
    return <TalentForm talentId={null} token={null} initial={blankInput(suggestedSkills, region ?? null)} />
  }
  return <EditExisting key={talentId} talentId={talentId} />
}

function blankInput(skills: string[], region: PrRegion | null): TalentPRInput {
  return {
    name: '', headline: '', intro: '', skills: skills.slice(0, MAX_PR_SKILLS), career_years: 0, project_count: 0,
    member_type: '개인', work_modes: ['상주'], level: '초급', regions: region ? [region] : [],
    available_from: null, images: [],
  }
}

function toInput(talent: TalentPR, name: string, images: string[]): TalentPRInput {
  return {
    name, headline: talent.headline, intro: talent.intro, skills: talent.skills,
    career_years: talent.career_years, project_count: talent.project_count, member_type: talent.member_type,
    work_modes: talent.work_modes, level: talent.level, regions: talent.regions,
    available_from: talent.available_from, images,
  }
}

/** 고치기: 기존 사진을 data URL로 바꿔 둔다 (저장하면 사진 목록 전체를 다시 보낸다) */
function EditExisting({ talentId }: { talentId: number }) {
  const owned = ownedPr(talentId)
  const ownedName = owned?.name ?? null
  const { data, error } = useTalent(owned ? talentId : null)
  const [initial, setInitial] = useState<TalentPRInput | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!data || ownedName === null) return
    let ignore = false
    Promise.all(data.image_urls.map(imageUrlToDataUrl))
      .then(images => { if (!ignore) setInitial(toInput(data, ownedName, images)) })
      .catch((e: unknown) => { if (!ignore) setLoadError(errorMessage(e, '기존 사진을 불러오지 못했습니다.')) })
    return () => { ignore = true }
  }, [data, ownedName])

  if (!owned) {
    return (
      <EmptyState>
        <p>이 PR을 만든 브라우저에서만 고칠 수 있습니다.</p>
        <Button asChild variant="outline" className="mt-3"><a href={href.talent(talentId)}>PR 보기</a></Button>
      </EmptyState>
    )
  }
  if (error || loadError) return <ErrorBanner>{error || loadError}</ErrorBanner>
  if (!initial) return <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p>
  return <TalentForm talentId={talentId} token={owned.token} initial={initial} />
}

function TalentForm({ talentId, token, initial }: { talentId: number | null; token: string | null; initial: TalentPRInput }) {
  const [form, setForm] = useState<TalentPRInput>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const isNew = talentId === null

  function set<K extends keyof TalentPRInput>(key: K, value: TalentPRInput[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (form.work_modes.length === 0) {
      setFieldErrors({ work_modes: '희망 근무 형태를 하나 이상 고르세요.' })
      return
    }
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      if (talentId === null) {
        const created = await createTalent(form)
        saveOwnedPr(created.id, { token: created.edit_token, name: form.name.trim() })
        navigate(href.talent(created.id))
      } else if (token) {
        await updateTalent(talentId, token, form)
        saveOwnedPr(talentId, { token, name: form.name.trim() })
        navigate(href.talent(talentId))
      }
    } catch (e) {
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors)
      setError(errorMessage(e, 'PR을 저장하지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={e => void submit(e)} className="space-y-5">
      <header>
        <p className="text-[13px] font-bold text-[#D9261C]">기업이 보는 자기 PR</p>
        <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{isNew ? '내 PR 올리기' : 'PR 고치기'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          시연용이라 서버를 다시 켜면 사라져요. 실제 개인정보 대신 시연용 내용을 써 주세요.
        </p>
      </header>

      <section className="space-y-7 rounded-2xl border border-[#ECECEC] bg-white p-6 md:p-8">
        {/* 기본 정보 */}
        <Group title="기본 정보">
          <Block title="사진" hint="최대 3장 · 첫 장이 목록 사진이 돼요. 안 올리면 사람 아이콘이 보여요.">
            <ImagePicker images={form.images} onChange={next => set('images', next)} max={MAX_PR_IMAGES} />
          </Block>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field id="pr-name" label="이름" hint="기업 화면에는 성만 보여요 (예: 이**)" error={fieldErrors.name}>
              <Input id="pr-name" required maxLength={20} value={form.name} className="h-11 rounded-[10px] text-base sm:text-sm"
                onChange={e => set('name', e.target.value)} />
            </Field>
            <Field id="pr-headline" label="제목" hint="목록 카드에 가장 크게 보이는 한 문장이에요" error={fieldErrors.headline}>
              <Input id="pr-headline" required maxLength={60} value={form.headline} className="h-11 rounded-[10px] text-base sm:text-sm"
                placeholder="예: Java로 공공 웹을 만들어 본 신입 개발자" onChange={e => set('headline', e.target.value)} />
            </Field>
          </div>
          <Field id="pr-intro" label="자기 PR" error={fieldErrors.intro}>
            <Textarea id="pr-intro" rows={4} maxLength={1000} value={form.intro} className="rounded-[10px] text-base sm:text-sm"
              placeholder="무엇을 만들어 봤고, 어디서 어떻게 일하고 싶은지 써 주세요."
              onChange={e => set('intro', e.target.value)} />
          </Field>
        </Group>

        {/* 기술 */}
        <Group title="기술" right={<Count value={form.skills.length} max={MAX_PR_SKILLS} />}>
          <SkillPicker value={form.skills} max={MAX_PR_SKILLS} onChange={next => set('skills', next)} />
        </Group>

        {/* 경력 */}
        <Group title="경력">
          <div className="grid gap-5 sm:grid-cols-2">
            <Stepper label="경력" unit="년" zeroText="신입" value={form.career_years} max={40}
              onChange={v => set('career_years', v)} error={fieldErrors.career_years} />
            <Stepper label="참여한 프로젝트" unit="건" value={form.project_count} max={200}
              onChange={v => set('project_count', v)} error={fieldErrors.project_count} />
            <ChoiceChips label="유형" options={MEMBER_TYPES} value={[form.member_type]}
              onChange={next => set('member_type', MEMBER_TYPES.find(m => m === next[0]) ?? '개인')} />
            <ChoiceChips label="숙련도" options={PR_LEVELS} value={[form.level]}
              onChange={next => set('level', PR_LEVELS.find(l => l === next[0]) ?? '초급')} />
          </div>
        </Group>

        {/* 희망 조건 */}
        <Group title="희망 조건">
          <div className="grid gap-5 sm:grid-cols-2">
            <ChoiceChips label="근무 형태" options={PR_WORK_MODES} value={form.work_modes} multiple
              error={fieldErrors.work_modes}
              onChange={next => set('work_modes', PR_WORK_MODES.filter(m => next.includes(m)))} />
            <ChoiceChips label="근무 지역" options={PR_REGIONS} value={form.regions} multiple
              onChange={next => set('regions', PR_REGIONS.filter(r => next.includes(r)))} />
            <Field id="pr-start" label="업무 시작 가능일" error={fieldErrors.available_from}>
              <Input id="pr-start" type="date" value={form.available_from ?? ''} className="h-11 w-auto rounded-[10px] text-base sm:text-sm"
                onChange={e => set('available_from', e.target.value || null)} />
            </Field>
          </div>
        </Group>
      </section>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <a href={isNew ? href.talents : href.talent(talentId)}>취소</a>
        </Button>
        <Button type="submit" size="lg" className="h-11 rounded-xl px-7" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {isNew ? 'PR 올리기' : '저장'}
        </Button>
      </div>
    </form>
  )
}

/** 기술 고르기: 묶음 칩 + 직접 추가. 최대 개수에 닿으면 남은 칩은 흐려진다 */
function SkillPicker({ value, max, onChange }: { value: string[]; max: number; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const full = value.length >= max
  const custom = value.filter(s => !KNOWN_SKILLS.has(s))

  function toggle(skill: string) {
    if (value.includes(skill)) onChange(value.filter(s => s !== skill))
    else if (!full) onChange([...value, skill])
  }

  function addDraft() {
    const skill = draft.trim()
    if (skill && !value.includes(skill) && !full) onChange([...value, skill])
    setDraft('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addDraft() }
    if (e.key === 'Escape') { setAdding(false); setDraft('') }
  }

  return (
    <div className="space-y-3.5">
      {SKILL_GROUPS.map(group => (
        <div key={group.name}>
          <p className="mb-2 text-[12px] text-[#9A9A9A]">{group.name}</p>
          <div className="flex flex-wrap gap-2">
            {group.items.map(skill => {
              const on = value.includes(skill)
              return <SkillChip key={skill} label={skill} on={on} disabled={!on && full} onClick={() => toggle(skill)} />
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2 text-[12px] text-[#9A9A9A]">직접 추가</p>
        <div className="flex flex-wrap items-center gap-2">
          {custom.map(skill => (
            <button
              key={skill} type="button" onClick={() => toggle(skill)} aria-label={`${skill} 빼기`}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[#D9261C] bg-[#FDEEEC] px-3.5 text-[14px] font-semibold text-[#D9261C]"
            >
              {skill} <X className="size-3.5" />
            </button>
          ))}
          {adding ? (
            <input
              autoFocus value={draft} maxLength={30} placeholder="기술 이름 쓰고 Enter"
              onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => { addDraft(); setAdding(false) }}
              className="h-9 w-48 rounded-full border border-[#D9261C] px-3.5 text-[14px] outline-none"
            />
          ) : (
            <button
              type="button" disabled={full} onClick={() => setAdding(true)}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-[#CFCFCF] px-3.5 text-[14px] text-[#7A7A7A] disabled:opacity-40"
            >
              <Plus className="size-3.5" /> 직접 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SkillChip({ label, on, disabled, onClick }: { label: string; on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={cn(
        'h-9 rounded-full border px-3.5 text-[14px] transition-colors',
        on ? 'border-[#D9261C] bg-[#FDEEEC] font-semibold text-[#D9261C]' : 'border-transparent bg-[#F4F4F4] text-[#555555] hover:bg-[#EAEAEA]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {label}
    </button>
  )
}

/** − 숫자 + 로 고르는 칸 */
function Stepper({ label, unit, zeroText, value, max, onChange, error }: {
  label: string; unit: string; zeroText?: string; value: number; max: number; onChange: (v: number) => void; error?: string
}) {
  const btn = 'grid size-9 place-items-center rounded-full border border-[#E2E2E2] text-[#161616] disabled:opacity-30'
  return (
    <div className="space-y-2.5">
      <p className="text-[15px] font-bold text-[#161616]">{label}</p>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`${label} 줄이기`} className={btn} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
          <Minus className="size-4" />
        </button>
        <span className="min-w-16 text-center text-[22px] font-extrabold">
          {value === 0 && zeroText ? zeroText : <>{value}<span className="ml-0.5 text-[13px] font-semibold">{unit}</span></>}
        </span>
        <button type="button" aria-label={`${label} 늘리기`} className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus className="size-4" />
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Count({ value, max }: { value: number; max: number }) {
  return (
    <p className="text-[13px] text-[#7A7A7A]">
      <b className="text-[15px] text-[#D9261C]">{value}</b> / {max}
    </p>
  )
}

function Group({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-[#ECECEC] pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-bold text-[#161616]">{title}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}