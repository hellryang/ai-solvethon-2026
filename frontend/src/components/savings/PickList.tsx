// 오른쪽 열 '내 1~3순위'. LinkedIn 오른쪽 순위 목록처럼 굵은 제목 한 줄 + 회색 메타 줄을 반복한다 (docs/ui-reference.md §1 ③).

import { ArrowRight, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { manwon, MAX_PICKS, signedManwon } from '@/lib/savings'
import type { Picks } from '@/lib/useSavings'
import { useCompares } from '@/lib/useSavings'
import type { SavingsProfile } from '@/types'

export function PickList({ profile, picks }: { profile: SavingsProfile; picks: Picks }) {
  const { data, loading, error, retry } = useCompares(profile, picks.ids)

  return (
    <section aria-labelledby="pick-title" className="rounded-xl border bg-card p-4">
      <h2 id="pick-title" className="text-base font-semibold">내 1~3순위</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">비교에 담은 회사 · 같은 일 서울 공고 대비</p>

      {picks.ids.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          카드의 [비교에 담기]를 누르면 여기에 순서대로 쌓입니다. 최대 {MAX_PICKS}곳.
        </p>
      ) : (
        <ol className="mt-2 divide-y">
          {picks.ids.map((id, index) => {
            const result = data?.[index]
            const name = result?.project.display_name ?? id
            return (
              <li key={id} className="flex items-start gap-2 py-3">
                <span className="w-4 pt-0.5 text-sm font-bold">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <a href={href.compare(id)} className="block truncate text-sm font-semibold hover:underline">
                    {name}{result && ` · 월 ${signedManwon(result.advantage_monthly)}`}
                  </a>
                  {result ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        2년 {manwon(result.cumulative['24'].jeonnam)} · 5년 {manwon(result.cumulative['60'].jeonnam)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        5년이면 서울보다 {signedManwon(result.cumulative['60'].jeonnam - result.cumulative['60'].seoul)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{loading ? '계산 중…' : ''}</p>
                  )}
                </div>
                <Button
                  type="button" size="icon-xs" variant="ghost" aria-label={`${name} 빼기`}
                  onClick={() => picks.remove(id)}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ol>
      )}

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
