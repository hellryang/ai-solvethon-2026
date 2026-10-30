// 인재 PR 목록·상세를 불러오는 hook. useSavings.ts와 같은 방식(요청 키가 바뀌면 다시 부른다).

import { useEffect, useState } from 'react'

import type { TalentPR } from '@/types'
import { errorMessage } from './api'
import { getTalent, listTalents } from './talents'
import type { TalentFilters } from './talents'
import type { RequestState } from './useSavings'

interface Loaded<T> {
  key: string
  data: T | null
  error: string
}

function toState<T>(loaded: Loaded<T>, key: string, retry: () => void): RequestState<T> {
  const current = loaded.key === key
  return { data: current ? loaded.data : null, loading: !current, error: current ? loaded.error : '', retry }
}

export function useTalentList(filters: TalentFilters): RequestState<TalentPR[]> {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify({ filters, attempt })
  const [loaded, setLoaded] = useState<Loaded<TalentPR[]>>({ key: '', data: null, error: '' })

  useEffect(() => {
    const request = JSON.parse(key) as { filters: TalentFilters }
    let ignore = false
    listTalents(request.filters)
      .then(result => { if (!ignore) setLoaded({ key, data: result.items, error: '' }) })
      .catch((e: unknown) => {
        if (!ignore) setLoaded({ key, data: null, error: errorMessage(e, '인재 목록을 불러오지 못했습니다.') })
      })
    return () => { ignore = true }
  }, [key])

  return toState(loaded, key, () => setAttempt(n => n + 1))
}

export function useTalent(id: number | null): RequestState<TalentPR> {
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify({ id, attempt })
  const [loaded, setLoaded] = useState<Loaded<TalentPR>>({ key: '', data: null, error: '' })

  useEffect(() => {
    const request = JSON.parse(key) as { id: number | null }
    let ignore = false
    const pending = request.id === null ? Promise.resolve(null) : getTalent(request.id)
    pending
      .then(data => { if (!ignore) setLoaded({ key, data, error: '' }) })
      .catch((e: unknown) => {
        if (!ignore) setLoaded({ key, data: null, error: errorMessage(e, 'PR을 불러오지 못했습니다.') })
      })
    return () => { ignore = true }
  }, [key])

  return toState(loaded, key, () => setAttempt(n => n + 1))
}
