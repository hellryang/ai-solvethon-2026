// 기업이 보는 인재 카드. 사람 아이콘(사람별 색) → 이름·유형 → 한 줄 소개 → 기술 태그 → 지역·근무, 오른쪽에 경력·프로젝트 큰 숫자.

import { UserRound } from 'lucide-react'

import { href } from '@/lib/router'
import { availableText } from '@/lib/talents'
import { cn } from '@/lib/utils'
import type { TalentPR } from '@/types'

// 사진이 없을 때 쓰는 아이콘 색. 배경은 연하게, 아이콘은 같은 계열로 진하게 (id로 고정)
const TINTS = [
  'bg-[#FDEEEC] text-[#D9261C]', // 빨강
  'bg-[#EAF0FF] text-[#2F5BFF]', // 파랑
  'bg-[#FFF3DF] text-[#D98200]', // 주황
  'bg-[#F1ECFF] text-[#6B4EFF]', // 보라
  'bg-[#E4F5F5] text-[#12908E]', // 청록
]
const MAX_CARD_SKILLS = 6

/** 사진이 있으면 사진, 없으면 사람 아이콘. 상세 화면에서도 같이 쓴다 */
export function PhotoTile({ talent, className }: { talent: TalentPR; className?: string }) {
  const photo = talent.image_urls[0]
  if (photo) {
    return <img src={photo} alt={`${talent.display_name} 대표 사진`} loading="lazy" className={cn('object-cover', className)} />
  }
  return (
    <div aria-hidden className={cn('flex items-center justify-center', TINTS[talent.id % TINTS.length], className)}>
      <UserRound className="size-1/2" strokeWidth={2} />
    </div>
  )
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div>
      <p className="text-[24px] leading-none font-extrabold text-[#161616]">
        {value}<span className="ml-0.5 text-[13px] font-semibold">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function TalentCard({ talent }: { talent: TalentPR }) {
  const shown = talent.skills.slice(0, MAX_CARD_SKILLS)
  const more = talent.skills.length - shown.length
  const years = Number(talent.career_years) || 0

  return (
    <a
      href={href.talent(talent.id)}
      className="flex gap-4 rounded-2xl border border-[#ECECEC] bg-white p-5 transition-colors hover:border-[#CFCFCF] md:gap-5 md:px-6"
    >
      <PhotoTile talent={talent} className="size-[52px] shrink-0 rounded-full" />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
          <span className="text-[15px] font-bold text-[#161616]">{talent.display_name}</span>
          <span className="rounded-full border border-[#E6E6E6] px-2 text-[11px] text-[#9A9A9A]">{talent.member_type}</span>
          {talent.is_sample && <span className="rounded-full border border-[#E6E6E6] px-2 text-[11px] text-[#9A9A9A]">예시</span>}
        </p>
        <p className="mt-1.5 text-[18px] leading-snug font-bold tracking-tight text-[#161616]">{talent.headline}</p>
        <ul aria-label="기술" className="mt-3 flex flex-wrap items-center gap-1.5">
          {shown.map(skill => (
            <li key={skill} className="rounded-full bg-[#F4F4F4] px-3 py-1 text-[13px] text-[#555555]">{skill}</li>
          ))}
          {more > 0 && <li className="text-[13px] text-muted-foreground">외 {more}개</li>}
        </ul>
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          📍 {talent.regions.join(', ') || '지역 무관'} · {talent.work_modes.join('·')} · {availableText(talent.available_from)}
        </p>
      </div>

      {/* 오른쪽: 경력·프로젝트 큰 숫자 (좁은 화면에서는 숨김) */}
      <div className="hidden w-[130px] shrink-0 flex-col justify-center gap-4 border-l border-[#F0F0F0] pl-5 sm:flex">
        <Stat value={years > 0 ? String(years) : '신입'} unit={years > 0 ? '년' : ''} label="경력" />
        <Stat value={String(talent.project_count)} unit="건" label="프로젝트 참여" />
      </div>
    </a>
  )
}