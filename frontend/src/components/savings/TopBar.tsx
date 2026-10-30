// 상단 바(데스크톱)와 하단 탭바(모바일). 두 곳이 같은 탭 목록을 쓴다.
// 상단 바: 높이 52px, 흰 바탕, 아래 1px 테두리, 탭은 아이콘 위 + 12px 라벨 아래 (docs/ui-reference.md §2).
// 하단 탭바: 심사위원이 폰으로 접속하므로 1024px 미만에서는 앱처럼 화면 아래에 고정한다.

import { BookOpen, House, Route as RouteIcon, Scale, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { href } from '@/lib/router'
import type { Route } from '@/lib/router'
import { cn } from '@/lib/utils'
import type { AiMode } from '@/types'

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

export function TopBar({ page, compareHref, pickCount, aiMode }: NavProps & { aiMode: AiMode | null }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="mx-auto flex h-[52px] max-w-[1128px] items-center gap-3 px-4">
        <a href={href.home} className="mr-auto flex min-w-0 items-baseline gap-2">
          <span className="text-base font-bold">남는 돈 비교</span>
          <span className="truncate text-xs text-muted-foreground">광주·전남 사회초년생을 위한</span>
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
