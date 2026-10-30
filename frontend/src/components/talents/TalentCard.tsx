// 기업이 보는 인재 카드. Elancer 프리랜서 목록 순서: 사진 타일 → 이름·경력·참여 수·유형 → 한 줄 소개 → 기술 태그.

import { href } from '@/lib/router'
import { availableText, careerText } from '@/lib/talents'
import { cn } from '@/lib/utils'
import type { TalentPR } from '@/types'

// 사진이 없을 때 가린 이름을 넣는 타일 색 (id로 고정)
const TINTS = [
  'bg-[#FDEEEC] text-[#D9261C]', 'bg-[#EEF2FB] text-[#2F4FA2]', 'bg-[#EEF6EF] text-[#2F7A43]',
  'bg-[#F6F0FB] text-[#7A3FA8]', 'bg-[#FFF4E5] text-[#A35A00]', 'bg-[#F0F0F0] text-[#4A4A4A]',
]
const MAX_CARD_SKILLS = 6

export function PhotoTile({ talent, className }: { talent: TalentPR; className?: string }) {
  const photo = talent.image_urls[0]
  if (photo) {
    return <img src={photo} alt={`${talent.display_name} 대표 사진`} loading="lazy" className={cn('object-cover', className)} />
  }
  return (
    <div aria-hidden className={cn('flex items-center justify-center text-lg font-bold', TINTS[talent.id % TINTS.length], className)}>
      {talent.display_name}
    </div>
  )
}

export function TalentCard({ talent }: { talent: TalentPR }) {
  const shown = talent.skills.slice(0, MAX_CARD_SKILLS)
  const more = talent.skills.length - shown.length

  return (
    <a
      href={href.talent(talent.id)}
      className="flex gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 md:p-5"
    >
      <PhotoTile talent={talent} className="size-20 shrink-0 rounded-lg md:size-28" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-base font-bold">{talent.display_name}</span>
          <span aria-hidden className="text-border">|</span>
          <span className="font-medium">{careerText(talent.career_years)}</span>
          <span className="font-semibold text-primary">{talent.project_count}개 프로젝트 참여</span>
          <span className="rounded-full border px-2 text-xs text-muted-foreground">{talent.member_type}</span>
          {talent.is_sample && <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">예시</span>}
        </p>
        <p className="mt-1.5 font-bold leading-snug">{talent.headline}</p>
        {talent.intro && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{talent.intro}</p>}
        <ul aria-label="기술" className="mt-2 flex flex-wrap items-center gap-1.5">
          {shown.map(skill => (
            <li key={skill} className="rounded-full bg-accent px-2 py-0.5 text-[13px] text-accent-foreground">{skill}</li>
          ))}
          {more > 0 && <li className="text-[13px] text-muted-foreground">외 {more}개</li>}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {talent.work_modes.join('·')} · {talent.regions.join(', ') || '지역 무관'} · {availableText(talent.available_from)}
        </p>
      </div>
    </a>
  )
}
