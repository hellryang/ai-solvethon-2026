// 내 PR 올리기·고치기. 기술은 직접 쓰고, 사진은 최대 3장 (첫 장이 대표 사진).
// 서버 메모리에 저장되므로 서버를 다시 켜면 사라진다 (10/30 결정).

import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { EmptyState, ErrorBanner, Field, InfoBanner } from '@/components/common'
import { ChoiceChips } from '@/components/talents/ChoiceChips'
import { ImagePicker } from '@/components/talents/ImagePicker'
import { SkillTagInput } from '@/components/talents/SkillTagInput'
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
import type { PrRegion, TalentPR, TalentPRInput } from '@/types'

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
    <form onSubmit={e => void submit(e)} className="space-y-4">
      <section aria-labelledby="pr-form-title" className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold text-primary">기업이 보는 자기 PR</p>
          <h1 id="pr-form-title" className="text-lg font-bold">{isNew ? '내 PR 올리기' : 'PR 고치기'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">글만으로는 고르기 어려우니, 기술은 직접 쓰고 사진도 올려 보세요.</p>
        </div>
        <InfoBanner>시연용이라 서버를 다시 켜면 사라집니다. 실제 개인정보 대신 시연용 사진과 내용을 써 주세요.</InfoBanner>

        <Block title="사진 (최대 3장)">
          <ImagePicker images={form.images} onChange={next => set('images', next)} max={MAX_PR_IMAGES} />
        </Block>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pr-name" label="이름" hint="기업 화면에는 성만 보입니다 (예: 이**)" error={fieldErrors.name}>
            <Input id="pr-name" required maxLength={20} value={form.name} className="h-11 text-base sm:h-9 sm:text-sm"
              onChange={e => set('name', e.target.value)} />
          </Field>
          <Field id="pr-headline" label="한 줄 소개" error={fieldErrors.headline}>
            <Input id="pr-headline" required maxLength={60} value={form.headline} className="h-11 text-base sm:h-9 sm:text-sm"
              placeholder="예: Java로 공공 웹을 만들어 본 신입 개발자" onChange={e => set('headline', e.target.value)} />
          </Field>
        </div>

        <Field id="pr-intro" label="자기 PR" error={fieldErrors.intro}>
          <Textarea id="pr-intro" rows={5} maxLength={1000} value={form.intro} className="text-base sm:text-sm"
            placeholder="무엇을 만들어 봤고, 어디서 어떻게 일하고 싶은지 써 주세요."
            onChange={e => set('intro', e.target.value)} />
        </Field>

        <Block title="기술 (직접 쓰기)">
          <SkillTagInput id="pr-skills" value={form.skills} max={MAX_PR_SKILLS} onChange={next => set('skills', next)} />
        </Block>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pr-career" label="경력 (년, 신입은 0)" error={fieldErrors.career_years}>
            <Input id="pr-career" type="number" inputMode="numeric" min={0} max={40} value={form.career_years}
              className="h-11 text-base sm:h-9 sm:text-sm" onChange={e => set('career_years', toCount(e.target.value, 40))} />
          </Field>
          <Field id="pr-projects" label="참여한 프로젝트 수" error={fieldErrors.project_count}>
            <Input id="pr-projects" type="number" inputMode="numeric" min={0} max={200} value={form.project_count}
              className="h-11 text-base sm:h-9 sm:text-sm" onChange={e => set('project_count', toCount(e.target.value, 200))} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceChips label="유형" options={MEMBER_TYPES} value={[form.member_type]}
            onChange={next => set('member_type', MEMBER_TYPES.find(m => m === next[0]) ?? '개인')} />
          <ChoiceChips label="숙련도" options={PR_LEVELS} value={[form.level]}
            onChange={next => set('level', PR_LEVELS.find(l => l === next[0]) ?? '초급')} />
          <ChoiceChips label="희망 근무 형태" options={PR_WORK_MODES} value={form.work_modes} multiple
            error={fieldErrors.work_modes}
            onChange={next => set('work_modes', PR_WORK_MODES.filter(m => next.includes(m)))} />
          <ChoiceChips label="희망 근무 지역" options={PR_REGIONS} value={form.regions} multiple
            onChange={next => set('regions', PR_REGIONS.filter(r => next.includes(r)))} />
        </div>

        <Field id="pr-start" label="업무 시작 가능일" error={fieldErrors.available_from}>
          <Input id="pr-start" type="date" value={form.available_from ?? ''} className="h-11 w-auto text-base sm:h-9 sm:text-sm"
            onChange={e => set('available_from', e.target.value || null)} />
        </Field>
      </section>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="outline">
          <a href={isNew ? href.talents : href.talent(talentId)}>취소</a>
        </Button>
        <Button type="submit" size="lg" className="h-11 px-6 sm:h-9" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {isNew ? 'PR 올리기' : '저장'}
        </Button>
      </div>
    </form>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  )
}

function toCount(raw: string, max: number): number {
  const value = Math.trunc(Number(raw))
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0
}
