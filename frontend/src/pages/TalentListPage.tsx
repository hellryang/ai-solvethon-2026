// 기업용: 광주·전남 인재 PR 목록 (추가 기능). Elancer 프리랜서 목록 구조:
// 검색창 → 왼쪽 스마트 필터 → 인원 수 + 정렬 → 인재 카드.

import { useState } from 'react'
import { Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'

import { EmptyState, ErrorBanner } from '@/components/common'
import { ChoiceChips } from '@/components/talents/ChoiceChips'
import { TalentCard } from '@/components/talents/TalentCard'
import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { EMPTY_FILTERS, MEMBER_TYPES, PR_LEVELS, PR_REGIONS, PR_WORK_MODES, SORT_LABELS } from '@/lib/talents'
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
  const [showFilters, setShowFilters] = useState(false)
  const { data, loading, error, retry } = useTalentList(filters)
  const activeCount = GROUPS.filter(group => filters[group.key]).length

  function reset() {
    setFilters(current => ({ ...EMPTY_FILTERS, sort: current.sort }))
    setQuery('')
  }

  return (
    <>
      <section aria-labelledby="talents-title" className="rounded-xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary">기업용</p>
            <h1 id="talents-title" className="text-lg font-bold">광주·전남 인재 PR</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              지역에서 일하고 싶은 사람이 직접 쓴 자기 PR입니다. 이름은 성만 보입니다.
            </p>
          </div>
          <Button asChild size="lg">
            <a href={href.talentNew}><Plus /> 내 PR 올리기</a>
          </Button>
        </div>
        <form role="search" className="relative mt-4" onSubmit={e => { e.preventDefault(); setFilters(f => ({ ...f, q: query })) }}>
          <Search aria-hidden className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search" value={query} maxLength={50} aria-label="기술 키워드 검색"
            onChange={e => setQuery(e.target.value)} placeholder="관련 기술 키워드로 검색해 보세요 (예: Java, 임베디드)"
            className="h-12 w-full rounded-full border bg-card pr-4 pl-11 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          />
        </form>
      </section>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="스마트 필터" className="lg:self-start">
          <Button
            type="button" variant="outline" className="h-10 w-full lg:hidden" aria-expanded={showFilters}
            onClick={() => setShowFilters(open => !open)}
          >
            <SlidersHorizontal /> 필터{activeCount > 0 && ` ${activeCount}개`} {showFilters ? '접기' : '펼치기'}
          </Button>
          <div className={cn('mt-2 space-y-4 rounded-xl border bg-card p-4 lg:mt-0 lg:block', showFilters ? 'block' : 'hidden')}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">스마트 필터</h2>
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <RotateCcw className="size-3" /> 초기화
              </button>
            </div>
            {GROUPS.map(group => (
              <ChoiceChips
                key={group.key} label={group.label} options={group.options} allowNone
                value={filters[group.key] ? [filters[group.key]] : []}
                onChange={next => setFilters(f => ({ ...f, [group.key]: next[0] ?? '' }))}
              />
            ))}
          </div>
        </aside>

        <section aria-labelledby="talent-count" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="talent-count" className="text-base font-semibold">
              <span className="text-primary">{data?.length ?? 0}</span>명의 인재
              {filters.q && <span className="ml-2 text-sm font-normal text-muted-foreground">&lsquo;{filters.q}&rsquo; 검색 결과</span>}
            </h2>
            <div role="tablist" aria-label="정렬" className="flex rounded-lg border bg-card p-0.5">
              {SORTS.map(sort => (
                <button
                  key={sort} type="button" role="tab" aria-selected={filters.sort === sort}
                  onClick={() => setFilters(f => ({ ...f, sort }))}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[13px]',
                    filters.sort === sort ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground',
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
          {data && data.map(talent => <TalentCard key={talent.id} talent={talent} />)}
        </section>
      </div>
    </>
  )
}
