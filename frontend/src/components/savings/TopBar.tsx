// 상단 바(데스크톱)와 하단 탭바(모바일). 두 곳이 같은 탭 목록을 쓴다.
// 상단 바: 높이 52px, 흰 바탕, 아래 1px 테두리, 탭은 아이콘 위 + 12px 라벨 아래 (docs/ui-reference.md §2).
// 하단 탭바: 심사위원이 폰으로 접속하므로 1024px 미만에서는 앱처럼 화면 아래에 고정한다.
// 상단 바 오른쪽 '내 프로필': 누르면 AI가 읽은 조건 요약이 열리고, [프로필 수정하기]로 조건 고치기 창을 연다.

import { useState } from 'react'
import { BookOpen, House, Pencil, Route as RouteIcon, Scale, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { href } from '@/lib/router'
import type { Route } from '@/lib/router'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/pridge-logo.svg'
import type { AiMode, SavingsProfile } from '@/types'
import { ConditionDialog } from './ConditionDialog'

interface NavProps {
  page: Route['page']
  /** 마지막으로 본 비교 화면 주소 (없으면 회사 고르기) */
  compareHref: string
  pickCount: number
}

interface NavTab {
  page: Route['page']
  label: string
  icon: LucideIcon
  to: string
  count: number
}

function navTabs(compareHref: string, pickCount: number): NavTab[] {
  return [
    { page: 'home', label: '추천', icon: House, to: href.home, count: 0 },
    { page: 'compare', label: '남는 돈 비교', icon: Scale, to: compareHref, count: 0 },
    { page: 'roadmap', label: '준비 로드맵', icon: RouteIcon, to: href.roadmap, count: pickCount },
    // 기업용 추가 기능: 인재 PR 목록·상세·작성 화면 모두 이 탭에 속한다
    { page: 'talents', label: '인재 PR', icon: Users, to: href.talents, count: 0 },
    { page: 'sources', label: '계산 기준', icon: BookOpen, to: href.sources, count: 0 },
  ]
}

/** 현재 화면이 이 탭에 속하는지. 인재 PR 상세·작성 화면은 '인재 PR' 탭으로 본다 */
function isActive(tab: NavTab, page: Route['page']): boolean {
  if (tab.page === 'talents') return page === 'talents' || page === 'talent' || page === 'talent-edit'
  return tab.page === page
}

function TabIcon({ tab }: { tab: NavTab }) {
  const Icon = tab.icon
  return (
    <span className="relative">
      <Icon aria-hidden className="size-5" />
      {tab.count > 0 && (
        <span className="absolute -top-1.5 -right-2.5 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
          {tab.count}
        </span>
      )}
    </span>
  )
}

interface ProfileProps {
  profile: SavingsProfile
  skillOptions: string[]
  onProfileChange: (next: SavingsProfile) => void
  onReset: () => void
  name: string
  onNameChange: (next: string) => void
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[13px] leading-7">
      <span className="w-8 shrink-0 text-[#7A7A7A]">{label}</span>
      <span className="text-[#161616]">{value}</span>
    </div>
  )
}

/** 상단 바의 '내 프로필' 탭 + 요약 창 + 조건 고치기 창 */
function ProfileMenu({ profile, skillOptions, onProfileChange, onReset, name, onNameChange }: ProfileProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const filled = profile.skills.length > 0 || profile.home_city !== null

  return (
    <div className="relative h-full">
      <button
        type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-full min-w-20 flex-col items-center justify-center gap-0.5 border-b-2 px-2 text-xs',
          open ? 'border-transparent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',        )}
      >
        <span className="relative">
          <UserRound aria-hidden className="size-5" />
          {filled && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-primary" aria-hidden />}
        </span>
        <span className="whitespace-nowrap">내 프로필</span>
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다 */}
          <button type="button" aria-label="프로필 닫기" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div
            role="dialog" aria-label="내 프로필"
            className="absolute top-full right-0 z-50 mt-2 w-[300px] rounded-[14px] border border-[#E2E2E2] bg-white p-[18px]"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-[#FDEEEC] text-[16px] font-extrabold text-[#D9261C]">
                {name ? name.trim().charAt(0) : <UserRound className="size-5" aria-hidden />}
              </span>
              <div>
                <p className="text-[15px] font-bold text-[#161616]">{name || '내 프로필'}</p>
                <p className="text-xs text-[#7A7A7A]">{filled ? 'AI가 읽은 조건' : '아직 입력 전'}</p>
              </div>
            </div>

            <div className="mt-3">
              <ProfileRow label="거주" value={`${profile.home_city ?? '모름'} · ${profile.housing}`} />
              <ProfileRow label="차량" value={profile.has_car ? '있음' : '없음'} />
              <ProfileRow label="근무" value={profile.work_mode} />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile.skills.length === 0 && profile.extended.length === 0 && (
                <span className="text-[13px] text-[#9A9A9A]">기술 없음</span>
              )}
              {profile.skills.map(s => (
                <span key={s} className="rounded-full border border-[#D9261C] bg-[#FDEEEC] px-2.5 py-0.5 text-[12px] font-semibold text-[#D9261C]">
                  {s}
                </span>
              ))}
              {profile.extended.map(s => (
                <span key={s} className="rounded-full border border-dashed border-[#D9261C] bg-[#FDEEEC] px-2.5 py-0.5 text-[12px] font-semibold text-[#D9261C]">
                  ✦ {s}
                </span>
              ))}
            </div>

            <button
              type="button" onClick={() => { setOpen(false); setEditing(true) }}
              className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#161616] text-[13px] font-bold text-white"
            >
              <Pencil className="size-4" aria-hidden /> 프로필 수정하기
            </button>
            <button
              type="button" onClick={() => { setOpen(false); onReset() }}
              className="mt-2 w-full text-center text-xs text-[#9A9A9A] hover:text-[#161616]"
            >
              처음부터 다시
            </button>
          </div>
        </>
      )}

      <ConditionDialog
        open={editing} onOpenChange={setEditing} profile={profile} skillOptions={skillOptions}
        onChange={onProfileChange} onReset={onReset} name={name} onNameChange={onNameChange}      />
    </div>
  )
}

export function TopBar({
  page, compareHref, pickCount, aiMode, ...profileProps
}: NavProps & { aiMode: AiMode | null } & ProfileProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="mx-auto flex h-[52px] max-w-[1128px] items-center gap-3 px-4">
        <a href={href.home} aria-label="Pridge 홈" className="mr-auto flex items-center">
          <img src={logoUrl} alt="Pridge" className="h-6 w-auto" />
        </a>
        <nav aria-label="주요 화면" className="hidden h-full lg:flex">
          {navTabs(compareHref, pickCount).map(tab => {
            const active = isActive(tab, page)
            return (
              <a
                key={tab.page} href={tab.to} aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full min-w-20 flex-col items-center justify-center gap-0.5 border-b-2 px-2 text-xs',
                  active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <TabIcon tab={tab} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </a>
            )
          })}
          <ProfileMenu {...profileProps} />
        </nav>
        <Badge variant="outline" className="hidden lg:inline-flex">
          {aiMode === 'mock' ? '로컬 모의 AI' : aiMode === 'bedrock' ? '서버 Bedrock AI' : 'AI 모드 확인 중'}
        </Badge>
      </div>
    </header>
  )
}

/** 모바일 하단 탭바. 아이폰 홈 표시줄 영역(safe area)만큼 아래를 띄운다 */
export function BottomNav({ page, compareHref, pickCount }: NavProps) {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {navTabs(compareHref, pickCount).map(tab => {
          const active = isActive(tab, page)
          return (
            <a
              key={tab.page} href={tab.to} aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[11px]',
                active ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              <TabIcon tab={tab} />
              {tab.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}