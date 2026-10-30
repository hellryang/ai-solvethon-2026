// 남는 돈 API를 화면에서 부르는 hook. AI를 부르지 않는 계산(추천·비교)만 화면이 열릴 때 자동으로 부른다.
// AI 호출(해석·분석·로드맵)은 각 화면의 버튼에서 직접 부른다.

import { useEffect, useState } from 'react'

import type { CompareResponse, RecommendItem, SavingsProfile } from '@/types'
import { errorMessage } from './api'
import { compareProject, MAX_PICKS, recommendProjects } from './savings'
import { isStringArray, useSessionState } from './session'

/** 비교에 담은 회사(1~3순위). 순서가 곧 순위다 */
export interface Picks {
  ids: string[]
  isFull: boolean
  has: (id: string) => boolean
  toggle: (id: string) => void
  remove: (id: string) => void
  moveUp: (id: string) => void
  clear: () => void
}

export function usePicks(): Picks {
  const [ids, setIds] = useSessionState<string[]>('kiroro.picks', [], isStringArray)
  return {
    ids,
    isFull: ids.length >= MAX_PICKS,
    has: id => ids.includes(id),
    toggle: id => setIds(current => {
      if (current.includes(id)) return current.filter(x => x !== id)
      return current.length >= MAX_PICKS ? current : [...current, id]
    }),
    remove: id => setIds(current => current.filter(x => x !== id)),
    moveUp: id => setIds(current => {
      const index = current.indexOf(id)
      if (index <= 0) return current
      return [...current.slice(0, index - 1), id, current[index - 1], ...current.slice(index + 1)]
    }),
    clear: () => setIds([]),
  }
}

const compareCache = new Map<string, Promise<CompareResponse>>()

/** 같은 조건·같은 회사의 비교 결과는 바뀌지 않는다(순수 계산). 성공한 결과만 다시 쓴다 */
function compareCached(profile: SavingsProfile, projectId: string): Promise<CompareResponse> {
  const key = `${JSON.stringify(profile)}|${projectId}`
  const hit = compareCache.get(key)
  if (hit) return hit
  const request = compareProject(profile, projectId)
  compareCache.set(key, request)
  request.catch(() => compareCache.delete(key))
  return request
}

interface Loaded<T> {
  key: string
  data: T | null
  error: string
}

export interface RequestState<T> {
  data: T | null
  loading: boolean
  error: string
  retry: () => void
}

/** 여러 공고의 남는 돈 비교. 순서는 projectIds 그대로 */
export function useCompares(profile: SavingsProfile, projectIds: string[]): RequestState<CompareResponse[]> {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify({ profile, projectIds, attempt })
  const [loaded, setLoaded] = useState<Loaded<CompareResponse[]>>({ key: '', data: null, error: '' })

  useEffect(() => {
    const request = JSON.parse(key) as { profile: SavingsProfile; projectIds: string[] }
    let ignore = false
    Promise.all(request.projectIds.map(id => compareCached(request.profile, id)))
      .then(data => { if (!ignore) setLoaded({ key, data, error: '' }) })
      .catch((e: unknown) => {
        if (!ignore) setLoaded({ key, data: null, error: errorMessage(e, '남는 돈을 계산하지 못했습니다.') })
      })
    return () => { ignore = true }
  }, [key])

  return toState(loaded, key, () => setAttempt(n => n + 1))
}

/** 상위 3곳. 기술을 하나도 고르지 않았으면 부르지 않는다 (점수가 모두 같아 의미가 없다) */
export function useRecommend(profile: SavingsProfile): RequestState<RecommendItem[]> {
  const [attempt, setAttempt] = useState(0)
  const enabled = profile.skills.length > 0
  const key = JSON.stringify({ profile, attempt, enabled })
  const [loaded, setLoaded] = useState<Loaded<RecommendItem[]>>({ key: '', data: null, error: '' })

  useEffect(() => {
    const request = JSON.parse(key) as { profile: SavingsProfile; enabled: boolean }
    let ignore = false
    const pending = request.enabled ? recommendProjects(request.profile).then(r => r.items) : Promise.resolve([])
    pending
      .then(data => { if (!ignore) setLoaded({ key, data, error: '' }) })
      .catch((e: unknown) => {
        if (!ignore) setLoaded({ key, data: null, error: errorMessage(e, '추천을 불러오지 못했습니다.') })
      })
    return () => { ignore = true }
  }, [key])

  return toState(loaded, key, () => setAttempt(n => n + 1))
}

function toState<T>(loaded: Loaded<T>, key: string, retry: () => void): RequestState<T> {
  const current = loaded.key === key
  return {
    data: current ? loaded.data : null,
    loading: !current,
    error: current ? loaded.error : '',
    retry,
  }
}
