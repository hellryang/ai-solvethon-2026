import type { PayBasis, Scenario, SimulationResponse, UnavailableScenario } from '@/types'

export function scenarioByKey(sim: SimulationResponse, key: string): Scenario | undefined {
  return sim.scenarios.find(s => s.key === key)
}

/** 강조된 지역 시나리오 (이사 의향에 맞는 쪽, 재택이면 저축이 가장 큰 거주지) */
export function highlighted(sim: SimulationResponse): Scenario | undefined {
  return sim.scenarios.find(s => s.highlight)
}

/** 만 원 단위 정수를 천 단위 쉼표로. 예: 14876 → "14,876" */
export function won(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 부호를 항상 붙인다. 0은 "0". 예: 30 → "+30", -5 → "−5" */
export function signed(n: number): string {
  if (n === 0) return '0'
  return (n > 0 ? '+' : '−') + won(Math.abs(n))
}

export const PAY_BASIS_LABEL: Record<PayBasis, string> = {
  district_sample_mean: '구별 공고 표본 평균 (직무 혼합)',
}

export const SUPPORT_REASON_LABEL: Record<NonNullable<Scenario['support_reason']>, string> = {
  not_eligible: '청년 주거 지원 대상이 아니어서 지원금을 넣지 않았습니다.',
  no_rent: '월세가 없어 지원금을 넣지 않았습니다.',
  no_policy: '해당 지역에서 금액이 확인된 지원 제도가 없어 지원금을 넣지 않았습니다.',
}

export function isSeoulScenario(key: string): boolean {
  return key.startsWith('seoul_')
}

/** 시나리오 키에서 표시 이름을 만든다 (unavailable 항목에는 label이 없다) */
export function labelForKey(key: string): string {
  if (key === 'seoul_ktx') return '광주 거주 + KTX 통근 (참고)'
  if (key.startsWith('seoul_')) return `서울 ${key.slice('seoul_'.length)}`
  if (key.startsWith('residence_')) return `${key.slice('residence_'.length)}에 거주`
  if (key === 'relocate') return '프로젝트 지역으로 이사'
  if (key === 'commute') return '현재 거주지에서 통근'
  return key
}

export function unavailableLabel(item: UnavailableScenario): string {
  return labelForKey(item.key)
}

export const REQUIRED_NOTICES = [
  '기본 생활비(식비 등)는 반영하지 않았습니다.',
  '보증금·이사 비용은 반영하지 않았습니다.',
] as const
