// '조건 고치기' 창. 바꾸는 즉시 추천과 남는 돈이 다시 계산된다. AI는 다시 부르지 않는다.
// 입력 글자는 모바일에서 16px로 둔다 (그보다 작으면 iOS가 화면을 확대한다).

import { CheckGroup, Field, NativeSelect } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { CITY_OPTIONS, MAX_EXTENDED, MAX_SKILLS } from '@/lib/savings'
import type { Housing, SavingsProfile, SavingsWorkMode } from '@/types'

const HOUSING_OPTIONS: Housing[] = ['본가', '자취', '모름']
const WORK_OPTIONS: SavingsWorkMode[] = ['상주', '재택', '무관']
const SELECT_CLASS = 'h-11 text-base sm:h-9 sm:text-sm'

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
  const extendedOptions = skillOptions.filter(skill => !profile.skills.includes(skill))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>조건 고치기</DialogTitle>
          <DialogDescription>바꾸는 즉시 추천과 남는 돈이 다시 계산됩니다. AI는 다시 부르지 않습니다.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cond-city" label="거주 시군">
            <NativeSelect
              id="cond-city" className={SELECT_CLASS} value={profile.home_city ?? ''}
              onChange={e => onChange({ ...profile, home_city: e.target.value || null })}
            >
              <option value="">모름</option>
              {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
            </NativeSelect>
          </Field>
          <Field id="cond-housing" label="거주 형태">
            <NativeSelect
              id="cond-housing" className={SELECT_CLASS} value={profile.housing}
              onChange={e => onChange({ ...profile, housing: HOUSING_OPTIONS.find(h => h === e.target.value) ?? '모름' })}
            >
              {HOUSING_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
            </NativeSelect>
          </Field>
          <Field id="cond-work" label="근무 형태">
            <NativeSelect
              id="cond-work" className={SELECT_CLASS} value={profile.work_mode}
              onChange={e => onChange({ ...profile, work_mode: WORK_OPTIONS.find(w => w === e.target.value) ?? '무관' })}
            >
              {WORK_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox" className="size-5 accent-primary" checked={profile.has_car}
              onChange={e => onChange({ ...profile, has_car: e.target.checked })}
            />
            차가 있어요
          </label>
        </div>

        <CheckGroup
          label="기술" options={skillOptions} value={profile.skills} max={MAX_SKILLS}
          onChange={next => onChange({ ...profile, skills: next, extended: profile.extended.filter(s => !next.includes(s)) })}
        />
        <CheckGroup
          label="확장 기술 (이 경험으로 할 수 있는 기술)" options={extendedOptions} value={profile.extended}
          max={MAX_EXTENDED} onChange={next => onChange({ ...profile, extended: next })}
        />

        <DialogFooter className="gap-2">
          <Button
            type="button" variant="ghost" className="text-muted-foreground"
            onClick={() => { onOpenChange(false); onReset() }}
          >
            처음부터 다시
          </Button>
          <Button type="button" className="h-11 sm:h-8" onClick={() => onOpenChange(false)}>완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
