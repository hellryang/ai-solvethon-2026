// 오른쪽 열 '계산 기준' 요약. 심사위원이 숫자를 물으면 여기서 출처 화면으로 바로 간다.

import { href } from '@/lib/router'
import { manwon } from '@/lib/savings'
import type { SavingsData } from '@/types'

export function BasisCard({ assumptions }: { assumptions: SavingsData['assumptions'] | null }) {
  return (
    <section aria-labelledby="basis-title" className="rounded-xl border bg-card p-4">
      <h2 id="basis-title" className="text-base font-semibold">계산 기준</h2>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
        <li>금액은 코드가 계산하고, AI는 숫자를 만들지 않습니다.</li>
        <li>연봉은 공고 하한값, 월급은 4대보험·세금을 뺀 실수령액입니다.</li>
        {assumptions && (
          <>
            <li>생활비 {manwon(assumptions.living_cost)}은 서울과 전남에 같이 넣었습니다.</li>
            <li>차가 있으면 보험·세금 {manwon(assumptions.car_fixed)}을 양쪽에 넣었습니다.</li>
            {assumptions.notes.map(note => <li key={note}>{note}</li>)}
          </>
        )}
      </ul>
      <a href={href.sources} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
        출처와 공고 12곳 전체 보기
      </a>
    </section>
  )
}
