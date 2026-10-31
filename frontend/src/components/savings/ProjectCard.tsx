// 전남·광주 공고 카드. 이랜서 "추천 프로젝트" 카드 순서를 따른다 (docs/ui-reference.md §3):
// 남는 돈 배지 + 적합도 막대 → 비교에 담기 → [조건 요약] 제목 → 기술 태그 → 메타 4칸(지역·연봉·월세·교통).

import { ArrowRight, Check, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { manwon, salaryText } from '@/lib/savings'
import { cn } from '@/lib/utils'
import type { CompareResponse } from '@/types'
import { AdvantageBadge, FitBar, MetaDivider, MetaItem, SkillTag } from './parts'

interface ProjectCardProps {
  result: CompareResponse
  /** 추천 순위. 지역 탭에서는 없다 */
  rank?: number
  picked: boolean
  /** 이미 3곳을 담아 더 담을 수 없을 때 */
  pickDisabled: boolean
  onTogglePick: () => void
  /** 상세 화면 위에 다시 그릴 때는 [자세히] 버튼을 숨긴다 */
  showDetail?: boolean
}

export function ProjectCard({ result, rank, picked, pickDisabled, onTogglePick, showDetail = true }: ProjectCardProps) {
  const { project, fit, jeonnam } = result
  const owned = new Set(fit.owned_hits)
  const extended = new Set(fit.extended_hits)
  const titleId = `project-${project.id}`

  return (
    <article aria-labelledby={titleId} className="rounded-xl border bg-card p-5 md:p-6">
      {/* 윗줄: 왼쪽 금액, 오른쪽 적합도 막대 */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {rank !== undefined && <span className="mr-1 text-[15px] font-bold">{rank}위</span>}
          <AdvantageBadge won={result.advantage_monthly} />
          <span className="ml-1 text-[14px] text-muted-foreground">같은 일 서울 대비</span>
        </div>
        <FitBar score={fit.score} />
      </div>

      {/* 비교에 담기 (640px 이상). 폰에서는 카드 맨 아래 버튼 줄로 옮긴다 */}
      <div className="mt-3 hidden sm:block">
        <CartButton picked={picked} pickDisabled={pickDisabled} onTogglePick={onTogglePick} className="h-8" />
      </div>

      <h3 id={titleId} className="mt-3 text-lg leading-snug">
        <span style={{ color: '#161616', fontWeight: 700 }}>
          [{project.skills[0]}/{project.place}/{salaryText(project.salary_floor_manwon)}]
        </span>{' '}
        <span style={{ color: '#7A7A7A', fontWeight: 500 }}>
          {project.display_name}
        </span>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{project.work}</p>

      <ul aria-label="필요 기술" className="mt-3 flex flex-wrap gap-1.5">
        {project.skills.map(skill => (
          <li key={skill}>
            <SkillTag skill={skill} kind={owned.has(skill) ? 'owned' : extended.has(skill) ? 'extended' : 'other'} />
          </li>
        ))}
      </ul>

      {/* 메타 4칸: 폰에서는 2×2 칸, 그 이상에서는 한 줄 + 구분선 */}
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-3 sm:flex sm:flex-wrap sm:items-center sm:gap-y-1">
        <MetaItem label="지역" value={project.place} />
        <MetaDivider />
        <MetaItem
          label="연봉" value={salaryText(project.salary_floor_manwon)}
          title={`공고 표기: ${project.salary_text} (하한값으로 계산)`}
        />
        <MetaDivider />
        <MetaItem label="월세" value={jeonnam.rent === 0 ? `0원 (${jeonnam.housing})` : manwon(jeonnam.rent)} />
        <MetaDivider />
        <MetaItem label="교통" value={manwon(jeonnam.transit)} title={jeonnam.transit_label} />
      </div>

      {showDetail && (
        <div className="mt-4 hidden justify-end sm:flex">
          <a
            href={href.compare(project.id)}
            className="inline-flex items-center gap-1 text-[14px] text-[#7A7A7A] transition-colors hover:text-[#161616]"
          >
            남는 돈 자세히 <ArrowRight className="size-4" />
          </a>
        </div>
      )}

      {/* 폰: 엄지로 누르기 쉬운 높이 44px 버튼 두 개를 카드 맨 아래에 나란히 */}
      <div className={cn('mt-4 grid gap-2 sm:hidden', showDetail ? 'grid-cols-2' : 'grid-cols-1')}>
        <CartButton picked={picked} pickDisabled={pickDisabled} onTogglePick={onTogglePick} className="h-11 w-full" />
        {showDetail && (
          <a
            href={href.compare(project.id)}
            className="inline-flex h-11 items-center justify-center gap-1 rounded-full bg-[#161616] text-sm font-semibold text-white"
          >
            남는 돈 자세히 <ArrowRight className="size-4" />
          </a>
        )}
      </div>
    </article>
  )
}

function CartButton({ picked, pickDisabled, onTogglePick, className }: {
  picked: boolean
  pickDisabled: boolean
  onTogglePick: () => void
  className?: string
}) {
  return (
    <Button
      type="button" size="sm" variant={picked ? 'default' : 'outline'} className={cn('rounded-full', className)}
      aria-pressed={picked} disabled={!picked && pickDisabled} onClick={onTogglePick}
      title={!picked && pickDisabled ? '최대 3곳까지 담을 수 있습니다' : undefined}
    >
      {picked ? <Check /> : <Plus />}
      {picked ? '카트에 담음' : '카트에 담기'}
    </Button>
  )
}