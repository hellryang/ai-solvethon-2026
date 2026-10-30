// 칩 모양 선택. single: 하나만 (다시 누르면 해제, allowNone일 때), multi: 여러 개.

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
    <div role="group" aria-label={label} className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const on = value.includes(option)
          return (
            <button
              key={option} type="button" aria-pressed={on} onClick={() => toggle(option)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
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
