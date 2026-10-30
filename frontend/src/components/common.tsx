import type { ComponentProps, ReactNode } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { AiText } from '@/types'

/** 네이티브 select (새 shadcn 컴포넌트를 추가하지 않는다) */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50',
        className,
      )}
    />
  )
}

/** 라벨 + 입력 + 항목별 오류 */
export function Field({
  id, label, error, hint, children, className,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
      {children}
    </div>
  )
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-lg border bg-muted p-3 text-sm">
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** 수치 옆에 붙이는 "가정값" 라벨 */
export function AssumptionBadge({ title }: { title?: string }) {
  return <Badge variant="outline" title={title} className="text-amber-700 dark:text-amber-400">가정값</Badge>
}

/** AI 응답 상태 배지 (mock / AI / 코드 문장 / 저장 결과) */
export function AiBadges({ result }: { result: AiText }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {result.mode === 'mock' && <Badge variant="secondary">모의 응답 · 실제 AI 결과 아님</Badge>}
      {result.mode === 'bedrock' && result.source === 'ai' && <Badge variant="outline">AI 생성</Badge>}
      {result.source === 'fallback' && <Badge variant="outline">코드 템플릿 문장</Badge>}
      {result.cached && <Badge variant="outline">저장된 결과</Badge>}
    </div>
  )
}

/**
 * AI 호출 버튼 + 결과. 자동 재시도는 하지 않고, 실패하면 사용자가 다시 누른다 (R9.3).
 * 실패해도 result.text(코드가 만든 대체 문장)를 항상 보여준다.
 */
export function AiResult({
  result, busy, onRun, runLabel, disabled, error,
}: {
  result: AiText | null
  busy: boolean
  onRun: () => void
  runLabel: string
  disabled?: boolean
  /** 네트워크 오류 등으로 응답 자체를 못 받았을 때의 메시지 */
  error?: string
}) {
  const failed = result?.error ?? null
  const label = failed || error ? `${runLabel} 다시 시도` : result ? `${runLabel} 다시 생성` : runLabel
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant={result ? 'outline' : 'default'}
          onClick={onRun} disabled={busy || disabled}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {label}
        </Button>
        {busy && <span className="text-xs text-muted-foreground">처리 중입니다. 최대 약 45초 걸릴 수 있습니다.</span>}
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {failed && (
        <ErrorBanner>
          <p className="font-medium">
            {failed.code === 429 ? 'AI 호출 한도를 넘었습니다.' : 'AI 호출에 실패했습니다.'}
          </p>
          <p className="mt-1 text-muted-foreground">
            {failed.message} 아래 문장은 코드가 계산 결과로 만든 대체 문장입니다.
            {failed.code === 429 && ' 잠시 뒤에 직접 다시 눌러 주세요. 자동으로 다시 호출하지 않습니다.'}
          </p>
        </ErrorBanner>
      )}
      {result && (
        <div role="status" className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <AiBadges result={result} />
          <p className="whitespace-pre-wrap break-words text-sm leading-7">{result.text}</p>
        </div>
      )}
    </div>
  )
}
