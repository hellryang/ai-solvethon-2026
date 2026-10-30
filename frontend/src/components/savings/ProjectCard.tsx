// 전남·광주 공고 카드. 이랜서 "추천 프로젝트" 카드 순서를 따른다 (docs/ui-reference.md §3):
// 남는 돈 배지 → [조건 요약] 제목 → 기술 태그 → 메타 4칸(지역·연봉·월세·교통).

import { ArrowRight, Check, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { href } from '@/lib/router'
import { manwon, salaryText } from '@/lib/savings'
import type { CompareResponse } from '@/types'
import { AdvantageBadge, MetaDivider, MetaItem, SkillTag } from './parts'

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
  const { project, fit, jeonnam, seoul_project: seoul } = result
  const owned = new Set(fit.owned_hits)
  const extended = new Set(fit.extended_hits)
  const titleId = `project-${project.id}`

  return (
    <article aria-labelledby={titleId} className="rounded-xl border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {rank !== undefined && <span className="text-[13px] font-bold">{rank}위</span>}
          <AdvantageBadge won={result.advantage_monthly} />
          <span className="text-[13px] text-muted-foreground">
            같은 일 서울 공고({seoul.display_name}) 대비 · 적합도 {fit.score}점
          </span>
        </div>
        <Button
          type="button" size="sm" variant={picked ? 'default' : 'outline'} className="h-9 rounded-full sm:h-7"
          aria-pressed={picked} disabled={!picked && pickDisabled} onClick={onTogglePick}
          title={!picked && pickDisabled ? '최대 3곳까지 담을 수 있습니다' : undefined}
        >
          {picked ? <Check /> : <Plus />}
          {picked ? '비교에 담음' : '비교에 담기'}
        </Button>
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

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3">
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
        <div className="mt-4 flex justify-end">
          <a
            href={href.compare(project.id)}
            className="inline-flex items-center gap-1 text-[14px] text-[#7A7A7A] transition-colors hover:text-[#161616]"
          >
            남는 돈 자세히 <ArrowRight className="size-4" />
          </a>
        </div>
      )}
    </article>
  )
}
