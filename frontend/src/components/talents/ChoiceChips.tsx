// 칩 모양 선택. single: 하나만 (다시 누르면 해제, allowNone일 때), multi: 여러 개.
// 선택됨: 연한 빨강 배경 + 빨간 테두리 (조건 고치기 창과 같은 모양)

import { cn } from '@/lib/utils'

interface ChoiceChipsProps {
  label: string
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
  multiple?: boolean
  /** single일 때 다시 눌러 선택을 비울 수 있는지 (필터용) */
  allowNone?: boolean
  error?: string
}

export function ChoiceChips({ label, options, value, onChange, multiple = false, allowNone = false, error }: ChoiceChipsProps) {
  function toggle(option: string) {
    const on = value.includes(option)
    if (multiple) {
      onChange(on ? value.filter(v => v !== option) : [...value, option])
    } else if (on) {
      if (allowNone) onChange([])
    } else {
      onChange([option])
    }
  }

  return (
    <div role="group" aria-label={label} className="space-y-2.5">
      <p className="text-[15px] font-bold text-[#161616]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const on = value.includes(option)
          return (
            <button
              key={option} type="button" aria-pressed={on} onClick={() => toggle(option)}
              className={cn(
                'h-9 rounded-full border px-3.5 text-[14px] transition-colors',
                on
                  ? 'border-[#D9261C] bg-[#FDEEEC] font-semibold text-[#D9261C]'
                  : 'border-transparent bg-[#F4F4F4] text-[#555555] hover:bg-[#EAEAEA]',
              )}
            >
              {option}
            </button>
          )
        })}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}