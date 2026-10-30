// API 계약 타입. 근거: .kiro/specs/gwangju-talent-matching/design.md §4, §7.6, §8.4, §9.
// design.md가 필드 이름을 정하지 않은 부분(meta, talent, project 요청·응답)은
// DB 컬럼 이름을 그대로 쓰고, 목록형 값(희망 지역, 기술 이름 등)은 배열로 둔다.
// 백엔드 구현 전에 tasks.md 0.4(API 계약 검토)에서 확정해야 한다.

export type AiMode = 'mock' | 'bedrock'

export type Region = '광주' | '나주' | '광양'
export type Category = '개발' | '기획' | '퍼블리싱' | '디자인' | '기타'
export type WorkMode = '상주' | '재택' | '혼합'
export type WorkModePref = '상주' | '재택' | '무관'

export interface JobFamily {
  name: string
  category: Category
}

export interface PayGrade {
  key: string
  label: string
  /** 만 원/월. 확인 전이면 null */
  monthly: number | null
}

/** GET /meta */
export interface Meta {
  skills: string[]
  categories: Category[]
  job_families: JobFamily[]
  regions: Region[]
  gwangju_districts: string[]
  work_modes: WorkMode[]
  pay_grades: PayGrade[]
}

export interface TalentSkill {
  skill: string
  /** 1~5, 사용자 입력값. AI가 바꾸지 않는다 */
  level: number
  evidence: string | null
  evidence_source: 'ai-mock' | 'ai-bedrock' | 'user' | null
}

export interface TalentSummary {
  id: number
  nickname: string
  account_type: 'individual' | 'team'
  desired_category: Category
  is_demo: boolean
}

export interface TalentFields {
  nickname: string
  account_type: 'individual' | 'team'
  affiliation: '광주 소재 대학 재학' | '광주 거주 구직자'
  desired_category: Category
  work_mode_pref: WorkModePref
  desired_regions: Region[]
  /** YYYY-MM-DD */
  available_start: string
  available_end: string
  days_per_week: number
  living_type: '자취' | '본가' | '기숙사'
  home_district: string
  commute_mode: '대중교통' | '자차'
  move_willingness: '이사 가능' | '현재 거주지에서 통근'
  housing_pref: '원룸' | '투룸' | '셰어하우스' | null
  /** 만 원/월 */
  fixed_expense: number | null
  support_eligible: boolean
  narrative: string
  portfolio_url: string | null
}

export interface Talent extends TalentFields {
  id: number
  team_id: number | null
  card_mode: AiMode | null
  is_demo: boolean
  skills: TalentSkill[]
}

/** POST /talents, PUT /talents/{id} 본문 */
export interface TalentInput extends TalentFields {
  skills: { skill: string; level: number }[]
}

export interface ProjectSkill {
  skill: string
  min_level: number
  is_required: boolean
}

export interface ProjectRole {
  role_name: string
  headcount: number
  skills: string[]
}

export interface ProjectSummary {
  id: number
  title: string
  company_name: string
  region: Region
  work_mode: WorkMode
  pay_monthly: number
  category: Category
  job_family: string
}

/** GET /projects 목록 항목 */
export interface ProjectListItem extends ProjectSummary {
  district: string
  pay_grade: string
  start_date: string
  end_date: string
  status: 'open' | 'closed'
}

/** GET /projects/{id} */
export interface Project extends ProjectListItem {
  description: string
  onsite_days_per_week: number | null
  meeting_per_month: number | null
  housing_support: boolean
  commute_support: boolean
  is_demo: boolean
  skills: ProjectSkill[]
  roles: ProjectRole[]
}

/** design.md §8.4 */
export interface AiText {
  text: string
  source: 'ai' | 'fallback'
  mode: AiMode | null
  model_id: string
  cached: boolean
  error: { code: number; message: string } | null
}

/** POST /talents/{id}/card 응답 */
export interface CardResponse extends AiText {
  skills: TalentSkill[]
}

export interface ScoreParts {
  total: number
  /** 0~70 */
  skill: number
  /** 0~15 */
  work_mode: number
  /** 0~15 */
  schedule: number
}

export interface SkillGap {
  skill: string
  current: number
  required: number
  kind: 'required' | 'preferred'
}

export interface RecommendationItem {
  rank: number
  project: ProjectSummary
  score: ScoreParts
  matched: string[]
  gaps: SkillGap[]
  explanation: AiText | null
}

export interface RecommendationsResponse {
  talent_id: number
  candidates: number
  excluded: { closed: number; category: number; region: number }
  items: RecommendationItem[]
}

// ---- 정주 시뮬레이션 (design.md §7.6) ----

export type PayBasis = 'district_posting' | 'family_mean' | 'same_pay_assumed'

export interface SourceNote {
  item: string
  source: string
  is_assumption: boolean
}

export interface Scenario {
  key: string
  label: string
  residence: string
  highlight?: boolean
  pay: number
  /** 서울 구 시나리오에만 있다 */
  pay_basis?: PayBasis
  take_home: number
  rent: number
  transport: number
  fixed: number
  support: number
  support_months: number
  support_name: string | null
  support_reason: 'not_eligible' | 'no_rent' | 'no_policy' | null
  /** 지원 기간 중 월 저축 */
  saving_with_support: number
  /** 지원 종료 후 월 저축 */
  saving_after_support: number
  asset_24: number
  asset_60: number
  /** 0~60개월, 61개 */
  asset_curve: number[]
  flags: { housing_fallback: boolean; route_estimated: boolean; car_fallback: boolean }
  sources: SourceNote[]
}

export interface UnavailableScenario {
  key: string
  reason: string
}

export interface PayCompareRow {
  district: string
  seoul_pay: number
  /** 서울 − 선택한 프로젝트. 부호를 그대로 둔다 */
  diff: number
  ratio_pct: number
  take_home_diff: number
}

export interface BenchmarkPeer {
  id: number
  district: string
  title: string
  pay_monthly: number
  pay_grade: string
  work_mode: WorkMode
  job_family_match: boolean
  grade_match: boolean
  work_mode_match: boolean
  shared_skills: string[]
}

export interface SimulationResponse {
  mode: 'relocate_vs_commute' | 'residence_compare'
  project: {
    id: number
    title: string
    region: Region
    work_mode: WorkMode
    pay_monthly: number
    pay_grade: string
    job_family: string
    annual_gross: number
  }
  scenarios: Scenario[]
  unavailable: UnavailableScenario[]
  pay_compare: PayCompareRow[]
  peers: BenchmarkPeer[]
  /** 화면은 best_seoul 키만 쓰고, 차이는 scenarios에서 직접 계산한다 */
  summary: {
    best_seoul: string | null
    saving_diff: number
    asset_24_diff: number
    asset_60_diff: number
  }
  notices: string[]
}

export interface Health {
  ok?: boolean
  ai_mode: AiMode
}
