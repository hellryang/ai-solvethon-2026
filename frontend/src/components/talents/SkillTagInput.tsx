// 기술 직접 쓰기. 쓰고 Enter(또는 쉼표)를 누르면 태그가 된다. 사전에서 고르지 않는다.

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { X } from 'lucide-react'

const MAX_SKILL_LENGTH = 30

interface SkillTagInputProps {
  id: string
  value: string[]
  onChange: (next: string[]) => void
  max: number
}

export function SkillTagInput({ id, value, onChange, max }: SkillTagInputProps) {
  const [draft, setDraft] = useState('')
  const full = value.length >= max

  function add(raw: string) {
    const next = [...value]
    for (const part of raw.split(/[,，\n]/)) {
      const skill = part.trim().replace(/\s+/g, ' ').slice(0, MAX_SKILL_LENGTH)
      if (skill && next.length < max && !next.some(s => s.toLowerCase() === skill.toLowerCase())) next.push(skill)
    }
    onChange(next)
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중 Enter는 글자를 확정하는 키라서 태그로 만들지 않는다
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {value.map(skill => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-2.5 text-[13px] text-accent-foreground">
            {skill}
            <button
              type="button" aria-label={`${skill} 지우기`} onClick={() => onChange(value.filter(s => s !== skill))}
              className="rounded-full p-0.5 hover:bg-primary/10"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id} value={draft} maxLength={MAX_SKILL_LENGTH} disabled={full}
          onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={() => { if (draft.trim()) add(draft) }}
          placeholder={value.length === 0 ? '예: Spring Boot, MySQL, 피그마' : full ? '' : '기술 더 쓰기'}
          className="h-8 min-w-32 flex-1 bg-transparent px-1 text-base outline-none sm:text-sm"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">직접 쓰고 Enter를 누르세요. 최대 {max}개.</p>
    </div>
  )
}
