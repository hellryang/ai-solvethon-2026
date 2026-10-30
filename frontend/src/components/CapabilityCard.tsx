import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { AiResult, InfoBanner } from '@/components/common'
import { errorMessage, postJson, putJson, TEAM } from '@/lib/api'
import type { AiMode, AiText, CardResponse, Talent, TalentSkill } from '@/types'

const SOURCE_LABEL: Record<NonNullable<TalentSkill['evidence_source']>, string> = {
  'ai-mock': '모의 응답',
  'ai-bedrock': 'AI 생성',
  user: '직접 수정',
}

function Dots({ level }: { level: number }) {
  return (
    <span aria-label={`숙련도 ${level} / 5`} className="font-mono tracking-widest text-primary">
      {'●'.repeat(level)}<span className="text-muted-foreground/40">{'○'.repeat(5 - level)}</span>
    </span>
  )
}

/**
 * AI 역량 카드. 기술과 숙련도는 사용자가 입력한 값 그대로이고 AI가 바꾸지 못한다 (R2.2).
 * 생성은 버튼을 누를 때만 일어나며 자동 재시도는 없다 (R2.6).
 */
export function CapabilityCard({
  talent, skillsDirty, onChange,
}: {
  talent: Talent
  /** 폼의 기술 목록이 저장된 값과 다르면 true */
  skillsDirty: boolean
  onChange: (skills: TalentSkill[], cardMode?: AiMode | null) => void
}) {
  const [result, setResult] = useState<AiText | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  const evidenceOf = (s: TalentSkill) => drafts[s.skill] ?? s.evidence ?? ''
  const hasDrafts = Object.keys(drafts).length > 0

  async function generate() {
    if (busy) return
    setBusy('generate')
    setError('')
    setSaved('')
    try {
      const { skills, ...ai } = await postJson<CardResponse>(`${TEAM}/talents/${talent.id}/card`)
      setResult(ai)
      setDrafts({})
      onChange(skills, ai.error ? undefined : ai.mode)
    } catch (e) {
      setError(errorMessage(e, '역량 카드 생성에 실패했습니다.'))
    } finally {
      setBusy(null)
    }
  }

  async function saveEvidence() {
    if (busy || !hasDrafts) return
    setBusy('save')
    setError('')
    setSaved('')
    try {
      const response = await putJson<{ skills: TalentSkill[] }>(`${TEAM}/talents/${talent.id}/card`, {
        skills: talent.skills.map(s => ({ skill: s.skill, evidence: evidenceOf(s).trim() || null })),
      })
      setDrafts({})
      onChange(response.skills)
      setSaved('근거 문장을 저장했습니다.')
    } catch (e) {
      setError(errorMessage(e, '근거 문장 저장에 실패했습니다.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          AI 역량 카드
          {talent.card_mode === 'mock' && <Badge variant="secondary">모의 응답 · 실제 AI 결과 아님</Badge>}
        </CardTitle>
        <CardDescription>
          서술형 경험을 "기술 · 숙련도 · 근거 문장"으로 정리합니다. 숙련도는 입력한 값 그대로이며 AI가 바꾸지 못합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skillsDirty && (
          <InfoBanner>프로필의 기술 목록이 저장되지 않았습니다. 저장한 뒤 카드를 생성하세요.</InfoBanner>
        )}

        <AiResult
          result={result} busy={busy === 'generate'} onRun={() => void generate()}
          runLabel="역량 카드 생성" disabled={skillsDirty || busy === 'save'} error={error}
        />

        <div className="grid gap-3 md:grid-cols-2">
          {talent.skills.map(s => (
            <div key={s.skill} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{s.skill}</span>
                <span className="flex items-center gap-2 text-xs">
                  <Dots level={s.level} />
                  <span className="text-muted-foreground">입력값 {s.level}/5</span>
                </span>
              </div>
              <Textarea
                aria-label={`${s.skill} 근거 문장`} rows={2} maxLength={200}
                value={evidenceOf(s)} placeholder="근거 문장이 없습니다. 직접 쓰거나 카드를 생성하세요."
                onChange={e => setDrafts(prev => ({ ...prev, [s.skill]: e.target.value }))}
              />
              {s.evidence_source && !(s.skill in drafts) && (
                <Badge variant="outline">{SOURCE_LABEL[s.evidence_source]}</Badge>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={() => void saveEvidence()} disabled={busy !== null || !hasDrafts}>
            {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />}
            근거 문장 저장
          </Button>
          {saved && <span role="status" className="text-xs text-muted-foreground">{saved}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
