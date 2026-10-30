// 기업용: 광주·전남 인재 PR 목록 (추가 기능).
// 검색창 → 그 아래 한 줄 필터 칩 → 인원 수 + 정렬 → 인재 카드(넓게).

import { Fragment, useState } from 'react'
import { ChevronRight, Pencil, Plus, RotateCcw, Search } from 'lucide-react'
import { EmptyState, ErrorBanner } from '@/components/common'
import { PhotoTile, TalentCard } from '@/components/talents/TalentCard'
import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { EMPTY_FILTERS, MEMBER_TYPES, ownedPr, PR_LEVELS, PR_REGIONS, PR_WORK_MODES, SORT_LABELS } from '@/lib/talents'
import type { TalentFilters } from '@/lib/talents'
import { useTalentList } from '@/lib/useTalents'
import { cn } from '@/lib/utils'
import type { PrSort } from '@/types'

const SORTS = Object.keys(SORT_LABELS) as PrSort[]
type FilterKey = 'member_type' | 'work_mode' | 'level' | 'region'

const GROUPS: { key: FilterKey; label: string; options: readonly string[] }[] = [
  { key: 'work_mode', label: '근무 형태', options: PR_WORK_MODES },
  { key: 'member_type', label: '유형', options: MEMBER_TYPES },
  { key: 'level', label: '숙련도', options: PR_LEVELS },
  { key: 'region', label: '희망 근무 지역', options: PR_REGIONS },
]

export function TalentListPage() {
  const [filters, setFilters] = useState<TalentFilters>(EMPTY_FILTERS)
  const [query, setQuery] = useState('')
  const { data, loading, error, retry } = useTalentList(filters)
    // 이 브라우저에서 올린 PR (고치기 권한이 있는 것)
  const mine = (data ?? []).filter(talent => ownedPr(talent.id) !== null)
  const others = (data ?? []).filter(talent => ownedPr(talent.id) === null)

  function reset() {
    setFilters(current => ({ ...EMPTY_FILTERS, sort: current.sort }))
    setQuery('')
  }

  return (
    <>
      <section aria-labelledby="talents-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-[#D9261C]">기업용</p>
            <h1 id="talents-title" className="mt-1 text-[28px] font-extrabold tracking-tight">광주·전남 인재 PR</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              지역에서 일하고 싶은 사람이 직접 쓴 자기 PR입니다. 이름은 성만 보입니다.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 rounded-xl bg-[#161616] px-5 hover:bg-[#333333]">
            <a href={href.talentNew}><Plus /> 내 PR 올리기</a>
          </Button>
        </div>

        <form role="search" className="relative" onSubmit={e => { e.preventDefault(); setFilters(f => ({ ...f, q: query })) }}>
          <Search aria-hidden className="absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={query} maxLength={50} aria-label="기술 키워드 검색"
            onChange={e => setQuery(e.target.value)} placeholder="기술 키워드로 검색 (예: Java, 임베디드)"
            className="h-[52px] w-full rounded-full border border-[#DADADA] bg-white pr-5 pl-12 text-base outline-none focus:border-[#D9261C] sm:text-sm"
          />
        </form>

        {/* 필터: 검색창 아래 한 줄. 묶음 사이는 세로선으로 나눈다. 다시 누르면 해제 */}
        <div className="flex flex-wrap items-center gap-2" aria-label="필터">
          {GROUPS.map((group, gi) => (
            <Fragment key={group.key}>
              {gi > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-[#E6E6E6]" />}
              <div role="group" aria-label={group.label} className="flex flex-wrap gap-2">
                {group.options.map(option => {
                  const on = filters[group.key] === option
                  return (
                    <button
                      key={option} type="button" aria-pressed={on}
                      onClick={() => setFilters(f => ({ ...f, [group.key]: on ? '' : option }))}
                      className={cn(
                        'h-9 rounded-full border px-3.5 text-[14px] transition-colors',
                        on ? 'border-[#D9261C] bg-[#FDEEEC] font-semibold text-[#D9261C]' : 'border-transparent bg-[#F4F4F4] text-[#555555] hover:bg-[#EAEAEA]',
                      )}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </Fragment>
          ))}
          <button
            type="button" onClick={reset}
            className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> 초기화
          </button>
        </div>
      </section>

      {mine.length > 0 && (
        <section aria-labelledby="my-pr-title" className="rounded-2xl border border-[#F3C9C5] bg-[#FFF8F7] p-5">
          <h2 id="my-pr-title" className="text-[15px] font-bold">
            내 PR <span className="text-[#D9261C]">{mine.length}</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {mine.map(talent => (
              <li key={talent.id} className="flex items-center gap-3 rounded-xl border border-[#ECECEC] bg-white p-3">
                <PhotoTile talent={talent} className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{talent.headline}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{talent.skills.slice(0, 4).join(' · ')}</p>
                </div>
                <a href={href.talentEdit(talent.id)} className="inline-flex h-9 items-center gap-1 rounded-full border border-[#E2E2E2] px-3 text-[13px] hover:bg-[#F4F4F4]">
                  <Pencil className="size-3.5" /> 고치기
                </a>
                <a href={href.talent(talent.id)} className="inline-flex h-9 items-center gap-0.5 rounded-full bg-[#161616] px-3.5 text-[13px] font-semibold text-white">
                  보기 <ChevronRight className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="talent-count" className="min-w-0 space-y-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="talent-count" className="text-base font-bold">
            <span className="text-[#D9261C]">{data?.length ?? 0}</span>명의 인재
            {filters.q && <span className="ml-2 text-sm font-normal text-muted-foreground">&lsquo;{filters.q}&rsquo; 검색 결과</span>}
          </h2>
          <div role="tablist" aria-label="정렬" className="flex gap-4">
            {SORTS.map(sort => (
              <button
                key={sort} type="button" role="tab" aria-selected={filters.sort === sort}
                onClick={() => setFilters(f => ({ ...f, sort }))}
                className={cn(
                  'text-[13px]',
                  filters.sort === sort ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {SORT_LABELS[sort]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <ErrorBanner>
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>다시 시도</Button>
          </ErrorBanner>
        )}
        {loading && <p role="status" className="text-sm text-muted-foreground">인재를 불러오는 중…</p>}
        {data && data.length === 0 && (
          <EmptyState>
            조건에 맞는 인재가 없습니다.{' '}
            <button type="button" onClick={reset} className="font-semibold underline">필터 초기화</button>
          </EmptyState>
        )}
        {others.map(talent => <TalentCard key={talent.id} talent={talent} />)}
      </section>
    </>
  )
}