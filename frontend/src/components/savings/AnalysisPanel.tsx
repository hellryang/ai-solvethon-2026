// ③ AI 해석 영역. 코드가 계산한 숫자(밝은 카드)와 AI 해석(어두운 면)을 면으로 구분한다 (docs/ui-reference.md §1 ②).
// AI는 [분석 보기]를 누를 때만 부른다. 실패하면 오류와 함께 같은 버튼으로 다시 시도한다.

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { analyzeProject } from '@/lib/savings'
import type { AnalysisResponse, SavingsProfile } from '@/types'

const KEYS = ['맞는 점', '아쉬운 점', '판단'] as const

interface AnalysisPanelProps {
  profile: SavingsProfile
  projectId: string
}

export function AnalysisPanel({ profile, projectId }: AnalysisPanelProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)

  async function run() {
    setBusy(true)
    setError('')
    try {
      setResult(await analyzeProject(profile, projectId))
    } catch (e) {
      setError(errorMessage(e, 'AI 분석을 받지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="ai-title" className="ai-surface p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white/60">AI 해석</p>
          <h2 id="ai-title" className="mt-1 text-xl font-bold">나에게 맞는 점과 아쉬운 점</h2>
          <p className="mt-1 text-sm text-white/60">
            금액은 위에서 코드가 계산했습니다. AI는 그 숫자만 인용하고, 금액 밖의 이유를 씁니다.
          </p>
        </div>
        <Button type="button" variant="secondary" size="lg" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {error ? '다시 시도' : result ? '다시 분석' : '분석 보기'}
        </Button>
      </div>

      {busy && <p role="status" className="mt-4 text-sm text-white/70">AI가 분석하는 중입니다…</p>}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-white/10 p-3 text-sm text-red-200">
          {error} 버튼을 다시 눌러 주세요. 자동으로 다시 부르지 않습니다.
        </p>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {KEYS.map(key => (
          <div key={key} className="ai-surface-card p-4">
            <p className="text-xs font-semibold text-white/60">{key}</p>
            <p className="mt-2 text-sm leading-6">
              {result?.lines?.[key] ?? (result ? '—' : '[분석 보기]를 누르면 채워집니다.')}
            </p>
          </div>
        ))}
      </div>

      {result && !result.lines && (
        <div className="ai-surface-card mt-3 p-4">
          <p className="text-xs text-white/60">
            AI 응답이 정해진 3줄 형식이 아니어서 원문을 그대로 보여 줍니다
            {result.mode === 'mock' && ' (로컬 모의 응답 · 실제 AI 결과는 팀 서버에서 확인)'}.
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{result.raw}</p>
        </div>
      )}
    </section>
  )
}
