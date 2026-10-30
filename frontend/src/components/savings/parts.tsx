// 남는 돈 화면의 작은 조각들. 치수 근거: docs/ui-reference.md §3(카드 해부), §4(토큰 실측).

import type { ReactNode } from 'react'

import { manwon, signedManwon } from '@/lib/savings'
import { cn } from '@/lib/utils'

type SkillKind = 'owned' | 'extended' | 'other'

const SKILL_TITLE: Record<SkillKind, string> = {
  owned: '내 기술과 일치',
  extended: '확장 기술로 일치',
  other: '내 기술에 없음',
}

/** 기술 태그. 내 기술과 일치하면 강조색, 확장 기술로 일치하면 테두리, 나머지는 회색 */
export function SkillTag({ skill, kind }: { skill: string; kind: SkillKind }) {
  return (
    <span
      title={SKILL_TITLE[kind]}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[13px]',
        kind === 'owned' && 'bg-accent font-medium text-accent-foreground',
        kind === 'extended' && 'border border-primary/40 text-accent-foreground',
        kind === 'other' && 'bg-muted text-muted-foreground',
      )}
    >
      {skill}{kind === 'extended' && ' (확장)'}
    </span>
  )
}

/** 카드 메타 한 칸: 라벨 13px 회색 + 값 14px 굵게 */
export function MetaItem({ label, value, title }: { label: string; value: ReactNode; title?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1" title={title}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </span>
  )
}

export function MetaDivider() {
  return <span aria-hidden className="text-border">|</span>
}

/**
 * "월 +67.7만원" 금액. 카드에서 가장 먼저 보이는 자리. 배경 없이 글씨로만 보인다.
 * 양수는 빨강 ▲, 음수는 회색 ▼, 0이면 회색 "서울과 비슷".
 */
export function AdvantageBadge({ won }: { won: number }) {
  if (won === 0) {
    return <span className="text-[18px] font-bold text-[#7A7A7A]">서울과 비슷</span>
  }
  const up = won > 0
  const text = signedManwon(won)
  const unit = text.endsWith('만원') ? '만원' : '원'
  const number = text.slice(0, -unit.length)
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-[2px]',
        up ? 'text-[#D9261C]' : 'text-[#F07A70]',
      )}
    >
      <span aria-hidden className="mr-[6px] text-[18px] font-extrabold">{up ? '▲' : '▼'}</span>
      <span className="text-[13px] font-semibold">월</span>
      <span className="text-[18px] font-extrabold">{number}</span>
      <span className="text-[13px] font-semibold">{unit}</span>
    </span>
  )
}

/** 큰 숫자 통계: 숫자는 크게, 단위는 작게 붙이고 라벨은 아래에 둔다 */
export function BigStat({ won, label }: { won: number; label: ReactNode }) {
  const text = signedManwon(won)
  const unit = text.endsWith('만원') ? '만원' : '원'
  return (
    <div>
      <p className={cn('font-bold leading-none tracking-tight', won > 0 && 'text-primary', won < 0 && 'text-destructive')}>
        <span className="text-5xl md:text-[68px]">{text.slice(0, -unit.length)}</span>
        <span className="ml-1 text-2xl md:text-[32px]">{unit}</span>
      </p>
      <p className="mt-3 text-base font-semibold">{label}</p>
    </div>
  )
}

/** 큰 숫자 아래 줄의 작은 통계 */
export function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
    </div>
  )
}

/** 두 줄 막대 (Tailwind div). 음수는 막대 없이 숫자만 보인다 */
export function TwoBar({ rows }: { rows: { label: string; won: number; highlight: boolean }[] }) {
  const max = Math.max(1, ...rows.map(row => row.won))
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground" title={row.label}>{row.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', row.highlight ? 'bg-primary' : 'bg-foreground/30')}
              style={{ width: `${(Math.max(0, row.won) / max) * 100}%` }}
            />
          </div>
          <span className="min-w-24 text-right font-semibold">{manwon(row.won)}</span>
        </div>
      ))}
    </div>
  )
}

/** 알약 탭. 선택된 탭만 어두운 채움, 나머지는 흰 바탕에 테두리 */
export function PillTabs<T extends string>({
  tabs, value, onChange, label,
}: {
  tabs: readonly T[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map(tab => {
        const active = tab === value
        return (
          <button
            key={tab} type="button" role="tab" aria-selected={active} onClick={() => onChange(tab)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:py-1.5',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
