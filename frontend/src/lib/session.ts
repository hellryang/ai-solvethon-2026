// 탭을 닫기 전까지 유지되는 화면 상태. 새로고침하거나 주소로 바로 들어와도 입력한 조건이 남는다.

import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** 저장소를 쓸 수 없거나(사생활 보호 모드) 저장된 모양이 지금과 다르면 초기값을 쓴다 */
export function useSessionState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(key, initial, isValid))

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 저장하지 못해도 화면은 메모리 값으로 계속 동작한다
    }
  }, [key, value])

  return [value, setValue]
}

function readStored<T>(key: string, initial: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return initial
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : initial
  } catch {
    return initial
  }
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}
