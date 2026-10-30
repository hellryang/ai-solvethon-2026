// 화면 주소. 해시(#/compare/NJ-D)를 써서 서버 설정 없이 새로고침·뒤로 가기·주소 공유가 된다.
// 새 라우터 패키지는 쓰지 않는다 (잠금 파일이 바뀌면 배포가 거부된다).

import { useSyncExternalStore } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'compare'; projectId: string | null }
  | { page: 'roadmap' }
  | { page: 'sources' }
  // 기업이 보는 인재 PR (추가 기능)
  | { page: 'talents' }
  | { page: 'talent'; talentId: number }
  | { page: 'talent-edit'; talentId: number | null }
  | { page: 'not-found' }

/** savings_data.py 전남·광주 공고 id 형식 (예: NJ-D). 주소로 들어온 값은 이 형식만 받는다 */
const PROJECT_ID = /^[A-Z]{2}-[A-Z]$/

export const href = {
  home: '#/',
  compare: (projectId?: string | null): string => (projectId ? `#/compare/${projectId}` : '#/compare'),
  roadmap: '#/roadmap',
  sources: '#/sources',
  talents: '#/talents',
  talentNew: '#/talents/new',
  talent: (id: number): string => `#/talents/${id}`,
  talentEdit: (id: number): string => `#/talents/${id}/edit`,
}

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/') return { page: 'home' }
  if (path === '/roadmap') return { page: 'roadmap' }
  if (path === '/sources') return { page: 'sources' }
  if (path === '/compare') return { page: 'compare', projectId: null }
  if (path === '/talents') return { page: 'talents' }
  if (path === '/talents/new') return { page: 'talent-edit', talentId: null }
  const compare = path.match(/^\/compare\/([^/]+)$/)
  if (compare && PROJECT_ID.test(compare[1])) return { page: 'compare', projectId: compare[1] }
  const talent = path.match(/^\/talents\/(\d{1,6})(\/edit)?$/)
  if (talent) {
    const talentId = Number(talent[1])
    return talent[2] ? { page: 'talent-edit', talentId } : { page: 'talent', talentId }
  }
  return { page: 'not-found' }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** 현재 해시. 바뀌면 다시 렌더링한다 */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}

export function navigate(to: string): void {
  window.location.hash = to.replace(/^#/, '')
}
