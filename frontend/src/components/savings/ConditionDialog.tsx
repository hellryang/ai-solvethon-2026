// '조건 고치기' 창. 바꾸는 즉시 추천과 남는 돈이 다시 계산된다. AI는 다시 부르지 않는다.
// 입력 글자는 모바일에서 16px로 둔다 (그보다 작으면 iOS가 화면을 확대한다).

import { useState } from 'react'

import { NativeSelect } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CITY_OPTIONS, MAX_EXTENDED, MAX_SKILLS } from '@/lib/savings'
import type { Housing, SavingsProfile, SavingsWorkMode } from '@/types'

const HOUSING_OPTIONS: Housing[] = ['자취', '본가', '모름']
const WORK_OPTIONS: SavingsWorkMode[] = ['상주', '재택', '무관']

const GROUPS: { name: string; items: string[] }[] = [
  { name: 'AI·데이터', items: ['데이터 분석', '데이터 라벨링', '머신러닝', '컴퓨터 비전', '자연어 처리', '생성형 AI 활용', '시계열 예측', '데이터 시각화'] },
  { name: '개발', items: ['Python', 'Java', 'Spring', '전자정부 표준프레임워크', '백엔드 API', '웹 프론트엔드', '모바일 앱', '데이터베이스', '클라우드 배포', 'IoT 센서', '임베디드'] },
  { name: '기획·기타', items: ['서비스 기획', 'UI/UX 디자인', '문서화', '고객 인터뷰'] },
]

/** 기술 사전을 세 묶음으로 나눈다. 묶음에 없는 기술은 '개발'에 넣는다 */
function groupSkills(options: string[]) {
  const known = new Set(GROUPS.flatMap(g => g.items))
  const extra = options.filter(s => !known.has(s))
  return GROUPS
    .map(g => ({
      name: g.name,
      items: [...g.items.filter(s => options.includes(s)), ...(g.name === '개발' ? extra : [])],
    }))
    .filter(g => g.items.length > 0)
}

type ChipKind = 'normal' | 'ai' | 'add'

function Chip({ label, on = false, disabled = false, kind = 'normal', onClick }: {
  label: string; on?: boolean; disabled?: boolean; kind?: ChipKind; onClick: () => void
}) {
  const base = 'inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-[14px] transition-colors'
  const look =
    kind === 'ai' ? 'border-dashed border-[#D9261C] bg-[#FDEEEC] font-semibold text-[#D9261C]'
    : kind === 'add' ? 'border-dashed border-[#CFCFCF] bg-transparent text-[#7A7A7A]'
    : on ? 'border-[#D9261C] bg-[#FDEEEC] font-semibold text-[#D9261C]'
    : 'border-transparent bg-[#F4F4F4] text-[#555555]'
  return (
    <button
      type="button" aria-pressed={kind === 'normal' ? on : undefined} disabled={disabled} onClick={onClick}
      className={`${base} ${look} ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  )
}

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: T[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="mb-2.5 text-[15px] font-bold text-[#161616]">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex rounded-[10px] bg-[#F4F4F4] p-1">
        {options.map(o => {
          const on = o === value
          return (
            <button
              key={o} type="button" role="radio" aria-checked={on} onClick={() => onChange(o)}
              className={`flex-1 rounded-[7px] border py-2 text-[14px] ${
                on ? 'border-[#E6E6E6] bg-white font-bold text-[#161616]' : 'border-transparent text-[#7A7A7A]'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionHead({ title, count, max }: { title: string; count: number; max: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className="text-[15px] font-bold text-[#161616]">{title}</p>
      <p className="text-[13px] text-[#7A7A7A]">
        <b className="text-[15px] text-[#D9261C]">{count}</b> / {max}
      </p>
    </div>
  )
}

const DIVIDER = 'my-6 h-px bg-[#ECECEC]'

interface ConditionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: SavingsProfile
  skillOptions: string[]
  onChange: (next: SavingsProfile) => void
  /** 자기소개·조건·담은 회사를 모두 지우고 처음 화면으로 */
  onReset: () => void
}

export function ConditionDialog({ open, onOpenChange, profile, skillOptions, onChange, onReset }: ConditionDialogProps) {
  const [addOpen, setAddOpen] = useState(false)
  const extendedOptions = skillOptions.filter(skill => !profile.skills.includes(skill))
  const skillsFull = profile.skills.length >= MAX_SKILLS
  const extendedFull = profile.extended.length >= MAX_EXTENDED

  const toggleSkill = (s: string) => {
    const has = profile.skills.includes(s)
    if (!has && skillsFull) return
    const next = has ? profile.skills.filter(x => x !== s) : [...profile.skills, s]
    onChange({ ...profile, skills: next, extended: profile.extended.filter(x => !next.includes(x)) })
  }
  const toggleExtended = (s: string) => {
    const has = profile.extended.includes(s)
    if (!has && extendedFull) return
    onChange({ ...profile, extended: has ? profile.extended.filter(x => x !== s) : [...profile.extended, s] })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto rounded-[18px] p-8 shadow-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-bold">조건 고치기</DialogTitle>
          <DialogDescription className="text-[14px] text-[#7A7A7A]">
            바꾸는 즉시 추천과 남는 돈이 다시 계산됩니다.
          </DialogDescription>
        </DialogHeader>

        {/* 조건 4개 */}
        <div className="mt-2 grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cond-city" className="mb-2.5 block text-[15px] font-bold text-[#161616]">거주 시군</label>
            <NativeSelect
              id="cond-city" className="h-11 rounded-[10px] border-[#E2E2E2] text-base sm:text-sm"
              value={profile.home_city ?? ''}
              onChange={e => onChange({ ...profile, home_city: e.target.value || null })}
            >
              <option value="">모름</option>
              {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
            </NativeSelect>
          </div>
          <Segmented
            label="거주 형태" options={HOUSING_OPTIONS} value={profile.housing}
            onChange={v => onChange({ ...profile, housing: v })}
          />
          <Segmented
            label="근무 형태" options={WORK_OPTIONS} value={profile.work_mode}
            onChange={v => onChange({ ...profile, work_mode: v })}
          />
          <div>
            <p className="mb-2.5 text-[15px] font-bold text-[#161616]">차량</p>
            <Chip
              label="차가 있어요" on={profile.has_car}
              onClick={() => onChange({ ...profile, has_car: !profile.has_car })}
            />
          </div>
        </div>

        {/* 기술 */}
        <div className={DIVIDER} />
        <SectionHead title="기술" count={profile.skills.length} max={MAX_SKILLS} />
        <div className="mt-3 space-y-3.5">
          {groupSkills(skillOptions).map(group => (
            <div key={group.name}>
              <p className="mb-2 text-[12px] text-[#9A9A9A]">{group.name}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(s => {
                  const on = profile.skills.includes(s)
                  return <Chip key={s} label={s} on={on} disabled={!on && skillsFull} onClick={() => toggleSkill(s)} />
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 확장 기술 */}
        <div className={DIVIDER} />
        <SectionHead title="확장 기술" count={profile.extended.length} max={MAX_EXTENDED} />
        <p className="mt-1 text-[13px] text-[#7A7A7A]">AI가 내 경험을 읽고 할 수 있는 기술로 넓혔어요</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.extended.map(s => (
            <Chip key={s} label={`✦ ${s}`} kind="ai" onClick={() => toggleExtended(s)} />
          ))}
          <Chip label={addOpen ? '− 닫기' : '+ 추가'} kind="add" onClick={() => setAddOpen(o => !o)} />
        </div>
        {addOpen && (
          <div className="mt-3 flex flex-wrap gap-2 rounded-[12px] border border-[#ECECEC] p-3">
            {extendedOptions.map(s => {
              const on = profile.extended.includes(s)
              return <Chip key={s} label={s} on={on} disabled={!on && extendedFull} onClick={() => toggleExtended(s)} />
            })}
          </div>
        )}

        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button" variant="ghost" className="text-muted-foreground"
            onClick={() => { onOpenChange(false); onReset() }}
          >
            처음부터 다시
          </Button>
          <Button type="button" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}