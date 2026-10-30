// 남는 돈 비교 API(backend/app/team/savings_routes.py) 호출과 표시용 값.
// 금액은 서버가 계산한 정수 원을 그대로 받고, 화면에서는 만원으로만 바꾼다. 화면에서 다시 계산하지 않는다.

import type {
  AnalysisResponse, CompareResponse, ParseResponse, RecommendResponse, RoadmapResponse,
  SavingsData, SavingsMessage, SavingsProfile,
} from '@/types'
import { api, postJson, TEAM } from './api'

const SAVINGS = `${TEAM}/savings`

export function getSavingsData(): Promise<SavingsData> {
  return api<SavingsData>(`${SAVINGS}/data`)
}

/** ① 자기소개 → 기술·확장·조건 (AI 1회, 실패하면 서버가 키워드로 대체) */
export function parseIntro(intro: string): Promise<ParseResponse> {
  return postJson<ParseResponse>(`${SAVINGS}/parse`, { intro })
}

/** ② 상위 3곳 (AI 호출 없음) */
export function recommendProjects(profile: SavingsProfile): Promise<RecommendResponse> {
  return postJson<RecommendResponse>(`${SAVINGS}/recommend`, profile)
}

/** ③ 남는 돈 내역 (AI 호출 없음) */
export function compareProject(profile: SavingsProfile, projectId: string): Promise<CompareResponse> {
  return postJson<CompareResponse>(`${SAVINGS}/compare`, { profile, project_id: projectId })
}

/** ③ [분석 보기] 맞는 점 / 아쉬운 점 / 판단 (AI 1회) */
export function analyzeProject(profile: SavingsProfile, projectId: string): Promise<AnalysisResponse> {
  return postJson<AnalysisResponse>(`${SAVINGS}/analysis`, { profile, project_id: projectId })
}

/** ④ [로드맵 만들기] 1~3순위 기준 준비 항목 (AI 1회) */
export function buildRoadmap(profile: SavingsProfile, projectIds: string[]): Promise<RoadmapResponse> {
  return postJson<RoadmapResponse>(`${SAVINGS}/roadmap`, { profile, project_ids: projectIds })
}

export const EMPTY_PROFILE: SavingsProfile = {
  home_city: null, housing: '모름', has_car: false, work_mode: '무관', skills: [], extended: [],
}

/** 작성창 아래 예시 칩. docs/calc-criteria.md 대표 사례 A·B·C (테스트로 숫자를 고정한 사례) */
export const EXAMPLE_INTROS: { label: string; intro: string }[] = [
  { label: 'Java 금융 (대표 시연)', intro: '광주 본가, 차 없음, 학부 때 Java로 학사관리 웹을 만들어 봤고 상주 근무 괜찮음' },
  { label: '광주 웹·DB', intro: '광주 본가에서 다녀요. 차 없음. 웹 프론트엔드와 DB 연동 프로젝트를 해 봤고 상주 근무 가능' },
  { label: '나주 자취 IoT', intro: '순천 출신이고 나주에서 자취할 생각이에요. 차 없음. 아두이노 IoT 센서 졸업작품, 상주 가능' },
]

/** 서버가 알아듣는 거주 시군 (profile_parse.py CITY_WORDS와 같은 목록) */
export const CITY_OPTIONS = ['광주', '나주', '광양', '순천', '여수', '목포', '담양', '화순', '서울'] as const

/** 추천 목록의 알약 탭. 추천 = 상위 3곳, 나머지는 그 지역 공고 4곳 */
export const LIST_TABS = ['추천 3곳', '광주', '나주', '광양'] as const
export type ListTab = (typeof LIST_TABS)[number]

export const MAX_SKILLS = 5
export const MAX_EXTENDED = 3
export const MAX_PICKS = 3

/** GET /savings/data의 sources 키 → 화면 이름 */
export const SOURCE_LABELS: Record<string, string> = {
  salary: '연봉', net_pay: '월 실수령액', rent: '월세', living: '생활비', transit: '교통비',
  commute_gj_naju: '광주↔나주 통근', distance: '거리', car_insurance: '자동차 보험', car_tax: '자동차세',
  fuel: '유류비', median_income: '기준중위소득', subsidy: '월세 지원 제도',
}

/** 원 → "67.7만원". 서버 profile_parse._manwon과 같은 반올림. 0은 "0원" */
export function manwon(won: number): string {
  const tenths = Math.floor(Math.abs(won) / 1_000 + 0.5)
  if (tenths === 0) return '0원'
  const sign = won < 0 ? '−' : ''
  const value = (tenths / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${sign}${value}만원`
}

/** 부호를 항상 붙인다. 예: +67.7만원, −9.4만원, 0원 */
export function signedManwon(won: number): string {
  const text = manwon(won)
  return won > 0 && text !== '0원' ? `+${text}` : text
}

/** 연봉 하한(만원) → "5,000만원" */
export function salaryText(manwonPerYear: number | null): string {
  return manwonPerYear === null ? '비공개' : `${manwonPerYear.toLocaleString('ko-KR')}만원`
}

/** 0.194 → "19.4%" */
export function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

/** 결론 문장 (docs/calc-criteria.md R9, R10). 숫자는 서버 값만 쓴다 */
export function messageText(message: SavingsMessage, reversalSubsidy: number): string {
  if (message === 'jeonnam_wins') return '남으면, 남는다.'
  if (message === 'even') return '연봉은 서울이 높아도 남는 돈은 비슷하다.'
  return `서울이 더 남는다. 지원금이 월 ${manwon(reversalSubsidy)}이면 역전된다.`
}

/** 왼쪽 '내 조건' 카드가 조건의 출처를 보여 주는 데 쓴다. manual = 사용자가 직접 고침 */
export interface ParseInfo {
  source: 'ai' | 'keyword' | 'manual'
  rationale: string
}

export function isParseInfo(value: unknown): value is ParseInfo | null {
  if (value === null) return true
  if (typeof value !== 'object') return false
  const info = value as Partial<ParseInfo>
  return (info.source === 'ai' || info.source === 'keyword' || info.source === 'manual') &&
    typeof info.rationale === 'string'
}

/** 저장된 값이 지금 화면이 쓰는 모양인지 확인한다 (예전 형식이면 버린다) */
export function isSavingsProfile(value: unknown): value is SavingsProfile {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<SavingsProfile>
  return (p.home_city === null || typeof p.home_city === 'string') &&
    typeof p.housing === 'string' && typeof p.has_car === 'boolean' && typeof p.work_mode === 'string' &&
    Array.isArray(p.skills) && Array.isArray(p.extended)
}
