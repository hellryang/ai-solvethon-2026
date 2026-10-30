// 계산 기준과 출처(가운데 열). 심사 질문 "이 숫자 어디서 왔나"에 이 화면으로 답한다.
// 기준 12개와 예상 질문의 원문은 docs/calc-criteria.md.

import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { href } from '@/lib/router'
import { manwon, SOURCE_LABELS } from '@/lib/savings'
import type { SavingsData } from '@/types'

/** 항목별 짧은 출처 한 줄. 긴 설명은 각 카드의 <details>에 접어 둔다. */
const SHORT_SOURCE: Record<string, string> = {
  rent: '국토교통부 실거래가 · 중앙값',
  net_pay: '2026 연봉별 실수령액표',
  living: '국가데이터처 1인 가구 통계',
  transit: '지역별 버스·지하철 요금',
  commute_gj_naju: '나주 BIS 요금표',
  distance: '네이버지도 길찾기',
  car_insurance: '보험개발원',
  car_tax: '지방세법',
  fuel: '오피넷',
}

export function SourcesPage({ data }: { data: SavingsData | null }) {
  if (!data) return <p role="status" className="text-sm text-muted-foreground">계산 기준을 불러오는 중…</p>

  const { assumptions } = data
  return (
    <>
      <section aria-labelledby="sources-title" className="rounded-xl border bg-card p-5">
        <h1 id="sources-title" className="text-lg font-bold">계산 기준과 출처</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          금액은 모두 코드가 같은 공식으로 계산합니다. AI는 숫자를 만들지 않고, 코드가 넘긴 숫자만 인용합니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(data.sources).map(([key, text]) => (
            <details key={key} className="group h-full rounded-xl border border-[#ECECEC] bg-white p-4">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="text-[15px] font-bold text-[#161616] decoration-[1.5px] underline-offset-[3px] hover:underline">
                  {SOURCE_LABELS[key] ?? key}
                </span>
                {SHORT_SOURCE[key] && (
                  <span className="mt-1 block text-[13px] text-[#7A7A7A]">{SHORT_SOURCE[key]}</span>
                )}
              </summary>
              <p className="mt-3 border-t border-[#ECECEC] pt-3 text-[12px] leading-[1.6] text-[#7A7A7A]">{text}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="assumptions-title" className="rounded-xl border bg-card p-5">
        <h2 id="assumptions-title" className="text-base font-semibold">가정</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>생활비 월 {manwon(assumptions.living_cost)} (서울과 전남에 같은 값)</li>
          <li>통근 월 {assumptions.commute_days}일 왕복</li>
          <li>차가 있으면 보험·세금 월 {manwon(assumptions.car_fixed)} (서울과 전남 양쪽)</li>
          <li>나이 만 {assumptions.age}세 (월세 지원 제도의 나이 요건 판정용)</li>
          {assumptions.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      </section>

      <section aria-labelledby="postings-title" className="rounded-xl border bg-card p-5">
        <h2 id="postings-title" className="text-base font-semibold">전남·광주 공고 {data.projects.length}곳</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">출처: 고용24 채용 공고. 회사명은 가렸습니다.</p>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>회사</TableHead>
              <TableHead>업무</TableHead>
              <TableHead>공고 연봉</TableHead>
              <TableHead>필요 기술</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.projects.map(project => (
              <TableRow key={project.id}>
                <TableCell>
                  <a href={href.compare(project.id)} className="font-semibold text-primary hover:underline">
                    {project.display_name}
                  </a>
                </TableCell>
                <TableCell className="whitespace-normal">{project.work}</TableCell>
                <TableCell>{project.salary_text}</TableCell>
                <TableCell className="whitespace-normal">{project.skills.join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="flex justify-end">
        <Button asChild size="lg">
          <a href={href.home}>자기소개로 시작하기 <ArrowRight /></a>
        </Button>
      </div>
    </>
  )
}
