// '내 조건' 카드. LinkedIn 왼쪽 프로필 요약처럼 AI가 무엇을 읽었는지 늘 보이게 둔다 (docs/ui-reference.md §1 ①).
// full: 데스크톱 왼쪽 열. compact: 모바일에서 화면 위쪽에 한 줄로 둔다.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ParseInfo } from '@/lib/savings'
import type { SavingsProfile } from '@/types'
import { ConditionDialog } from './ConditionDialog'
import { SkillTag } from './parts'

interface ConditionCardProps {
  variant: 'full' | 'compact'
  profile: SavingsProfile
  parseInfo: ParseInfo | null
  /** 기술 사전 (GET /savings/data). 불러오기 전에는 빈 배열 */
  skillOptions: string[]
  onChange: (next: SavingsProfile) => void
  onReset: () => void
}

const SOURCE_TEXT: Record<ParseInfo['source'], string> = {
  ai: 'AI가 자기소개에서 읽은 조건',
  keyword: 'AI 응답을 받지 못해 키워드로 뽑은 조건',
  manual: '직접 고친 조건',
}

export function ConditionCard({ variant, profile, parseInfo, skillOptions, onChange, onReset }: ConditionCardProps) {
  const [editing, setEditing] = useState(false)
  const sourceText = parseInfo ? SOURCE_TEXT[parseInfo.source] : '아직 입력 전 · 자취·차 없음으로 계산'
  const dialog = (
    <ConditionDialog
      open={editing} onOpenChange={setEditing} profile={profile} skillOptions={skillOptions}
      onChange={onChange} onReset={onReset}
    />
  )

  if (variant === 'compact') {
    return (
      <section aria-label="내 조건" className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">내 조건 · {sourceText}</p>
          <p className="truncate text-sm font-semibold">
            {profile.home_city ?? '거주 모름'} {profile.housing} · 차 {profile.has_car ? '있음' : '없음'} · {profile.work_mode}
            {profile.skills.length > 0 && ` · ${profile.skills.join(', ')}`}
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setEditing(true)}>
          <Pencil /> 고치기
        </Button>
        {dialog}
      </section>
    )
  }

  return (
    <section aria-labelledby="condition-title" className="rounded-xl border bg-card p-4">
      <h2 id="condition-title" className="text-base font-semibold">내 조건</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{sourceText}</p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="거주">{profile.home_city ?? '모름'} · {profile.housing}</Row>
        <Row label="차량">{profile.has_car ? '있음' : '없음'}</Row>
        <Row label="근무">{profile.work_mode}</Row>
      </dl>

      <SkillBlock label="기술" skills={profile.skills} kind="owned" />
      <SkillBlock label="확장 기술" skills={profile.extended} kind="extended" />

      {parseInfo?.rationale && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">근거: {parseInfo.rationale}</p>
      )}

      <Button type="button" variant="outline" size="sm" className="mt-4 w-full" onClick={() => setEditing(true)}>
        <Pencil /> 조건 고치기
      </Button>
      {dialog}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-10 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function SkillBlock({ label, skills, kind }: { label: string; skills: string[]; kind: 'owned' | 'extended' }) {
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {skills.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">없음</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1">
          {skills.map(skill => <li key={skill}><SkillTag skill={skill} kind={kind} /></li>)}
        </ul>
      )}
    </div>
  )
}
