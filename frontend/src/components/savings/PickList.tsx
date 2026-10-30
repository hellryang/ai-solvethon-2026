// 오른쪽 열 '나의 비교 카트'. 담은 회사를 한 칸씩 박스로, 남은 자리는 점선 빈 칸으로 보여 준다.

import { ArrowRight, ShoppingCart, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { MAX_PICKS, signedManwon } from '@/lib/savings'
import type { Picks } from '@/lib/useSavings'
import { useCompares } from '@/lib/useSavings'
import type { SavingsProfile } from '@/types'

/** "+64.0만원" → "+64만원" (소수점이 .0일 때만 뺀다) */
function shortManwon(won: number): string {
  return signedManwon(won).replace(/\.0(?=만원)/, '')
}

export function PickList({ profile, picks }: { profile: SavingsProfile; picks: Picks }) {
  const { data, loading, error, retry } = useCompares(profile, picks.ids)
  const count = picks.ids.length
  const empty = Math.max(0, MAX_PICKS - count)

  return (
    <section aria-labelledby="pick-title" className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between px-4">
        <h2 id="pick-title" className="flex items-center gap-1.5 text-base font-semibold">
          <ShoppingCart className="size-[18px]" strokeWidth={2.2} aria-hidden />
          로드맵 카트
        </h2>
        <p className="text-[13px] text-[#7A7A7A]" aria-label={`${MAX_PICKS}곳 중 ${count}곳 담음`}>
          <b className="text-[15px] text-[#D9261C]">{count}</b> / {MAX_PICKS}
        </p>
      </div>
      <p className="mt-0.5 px-4 text-xs text-muted-foreground">비교에 담은 회사 · 같은 일 서울 공고 대비</p>

      <ul className="mt-3 space-y-2">
        {picks.ids.map((id, index) => {
          const result = data?.[index]
          const name = result?.project.display_name ?? id
          return (
            <li
              key={id}
              className="flex h-[52px] items-center gap-2 rounded-[12px] border border-[#ECECEC] bg-white px-4"
            >
              <a href={href.compare(id)} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {name}
                {result ? ` · 월 ${shortManwon(result.advantage_monthly)}` : loading ? ' · 계산 중…' : ''}
              </a>
              <Button
                type="button" size="icon-xs" variant="ghost" aria-label={`${name} 빼기`}
                onClick={() => picks.remove(id)}
              >
                <X />
              </Button>
            </li>
          )
        })}
        {Array.from({ length: empty }, (_, i) => (
          <li
            key={`empty-${i}`} aria-hidden
            className="flex h-[52px] items-center rounded-[12px] border border-dashed border-[#DADADA] px-4 text-[13px] text-[#B0B0B0]"
          >
            {count === 0 && i === 0 ? '카드의 [카트에 담기]로 채워 보세요' : '빈 자리'}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}{' '}
          <button type="button" className="underline" onClick={retry}>다시 시도</button>
        </p>
      )}

      <Button asChild className="mt-3 w-full">
        <a href={href.roadmap}>④ 준비 로드맵 만들기 <ArrowRight /></a>
      </Button>
    </section>
  )
}