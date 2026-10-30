// API 계약 타입. 근거: .kiro/specs/gwangju-talent-matching/design.md §4, §7.6, §8.4, §9, §14, §15.
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
  /** 기업 유형 (공공기관, 대기업·제조, 스타트업·IT, 지역 SI) */
  org_types: string[]
  industries: string[]
  /** 기업 특성 태그. 주관적인 값이라 화면에서 가정값으로 표시한다 */
  style_tags: string[]
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
  org_type: string
  industry: string
  style_tags: string[]
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

/** POST /projects 본문 (기업 담당자 등록) */
export interface ProjectInput {
  company_name: string
  region: Region
  district: string
  category: Category
  job_family: string
  title: string
  description: string
  work_mode: WorkMode
  onsite_days_per_week: number | null
  meeting_per_month: number | null
  pay_monthly: number
  pay_grade: string
  start_date: string
  end_date: string
  housing_support: boolean
  commute_support: boolean
  org_type: string
  industry: string
  style_tags: string[]
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

// ---- 선호 기업과 신규 공고 (design.md §14.4~14.5) ----

export interface PreferenceFields {
  org_types: string[]
  industries: string[]
  style_tags: string[]
  preferred_skills: string[]
  /** 기업 이름, 앞쪽이 우선순위가 높다. 최대 3개 */
  favorite_companies: string[]
}

/** GET /talents/{id}/preferences. 저장 전에는 exists가 false이고 목록은 비어 있다 */
export interface Preference extends PreferenceFields {
  exists: boolean
  last_seen_at: string | null
}

/** GET /companies: 관심 기업 선택지 (등록된 광주·나주·광양 프로젝트의 기업만) */
export interface CompanyOption {
  company_name: string
  region: Region
  org_type: string
  industry: string
}

export interface PrefScore {
  /** 0~100 */
  total: number
  /** 0~25 */
  org_type: number
  /** 0~25 */
  industry: number
  /** 0~20 */
  style: number
  /** 0~30 */
  stack: number
  matched: {
    org_types: string[]
    industries: string[]
    style_tags: string[]
    skills: string[]
  }
}

export interface SimilarTo {
  company: string
  /** 0~100. 50 이상이면 비슷하다고 본다 */
  similarity: number
  same_org_type: boolean
  same_industry: boolean
  shared_skills: string[]
}

export interface PreferenceMatchItem {
  rank: number
  project: ProjectSummary & { is_new: boolean }
  pref: PrefScore
  /** 관심 기업 본인의 공고이면 1부터 시작하는 우선순위 */
  favorite_rank: number | null
  similar_to: SimilarTo | null
  fit: ScoreParts
  gaps: SkillGap[]
  explanation: AiText | null
}

export interface PreferenceMatchesResponse {
  preference_set: boolean
  scope: 'new' | 'all'
  /** 전체 범위에서 마지막 확인 이후 등록된 공고 수 */
  new_count: number
  candidates: number
  excluded: { closed: number; category: number; region: number }
  items: PreferenceMatchItem[]
}

// ---- 지역 기술 수요 (design.md §14.6) ----

export interface StackItem {
  skill: string
  /** 그 기술을 요구한 공고의 비율(%). 집계 전이면 null */
  share_pct: number | null
  metro_share_pct: number | null
  /** 미보유는 0 */
  my_level: number
  status: 'none' | 'low' | 'ok'
}

export interface StackGroup {
  group: string
  sample_n: number | null
  small_sample: boolean
  data_ready: boolean
  metro_sample_n: number | null
  metro_label: string | null
  collected_at: string | null
  source: string
  is_assumption: boolean
  items: StackItem[]
}

/** GET /stack-demand?talent_id= */
export interface StackDemandResponse {
  groups: StackGroup[]
}

// ---- 정주 시뮬레이션 (design.md §7.6, §15) ----

/** 서울 구별 보수는 수집한 공고 표본의 평균이다 (design.md §15.4) */
export type PayBasis = 'district_sample_mean'

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
  /** 이 구의 보수를 계산한 공고 표본 수 */
  sample_n: number
  /** 서울 − 선택한 프로젝트. 부호를 그대로 둔다 */
  diff: number
  ratio_pct: number
  take_home_diff: number
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
  /** 서울 보수의 출처와 한계 (직무 혼합 평균) */
  seoul_pay_source: { source: string; collected_at: string | null; note: string }
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

// ---- 남는 돈 비교 (backend/app/team/savings_routes.py, 기준: docs/calc-criteria.md) ----
// 금액은 모두 정수 원 단위다. 화면에서 만원으로 바꿔 보여 준다.

export type Housing = '본가' | '자취' | '모름'
export type SavingsWorkMode = '상주' | '재택' | '무관'
/** jeonnam_wins: "남으면, 남는다." / even: 비슷하다 / seoul_wins: 역전 지원금 S를 보여 준다 */
export type SavingsMessage = 'jeonnam_wins' | 'even' | 'seoul_wins'

/** ① AI가 뽑고 사용자가 토글로 고치는 조건. POST /savings/recommend 본문 */
export interface SavingsProfile {
  /** 거주 시군. null = 모름 */
  home_city: string | null
  housing: Housing
  has_car: boolean
  work_mode: SavingsWorkMode
  /** 기술 사전 안에서 최대 5개 */
  skills: string[]
  /** 확장 기술 최대 3개 */
  extended: string[]
}

/** 고용24 공고 1곳. 회사 실명은 응답에 없다 ("나주 D사") */
export interface SavingsProject {
  id: string
  place: string
  display_name: string
  work: string
  skills: string[]
  skills_from_posting: string[]
  salary_text: string
  salary_floor_manwon: number | null
}

/** GET /savings/data */
export interface SavingsData {
  skills: string[]
  projects: SavingsProject[]
  sources: Record<string, string>
  assumptions: {
    living_cost: number
    commute_days: number
    car_fixed: number
    age: number
    notes: string[]
  }
}

/** POST /savings/parse */
export interface ParseResponse {
  profile: SavingsProfile
  rationale: string
  /** keyword = AI 응답을 못 받아 키워드로 대체 */
  source: 'ai' | 'keyword'
}

export interface FitScore {
  score: number
  skill_points: number
  condition_points: number
  owned_hits: string[]
  extended_hits: string[]
  missing: string[]
}

export interface RecommendItem {
  project: SavingsProject
  fit: FitScore
  /** 같은 일 서울 공고 */
  seoul: { display_name: string; place: string }
  /** 전남 − 서울, 월 */
  advantage_monthly: number
  savings_monthly: number
  message: SavingsMessage
}

/** POST /savings/recommend */
export interface RecommendResponse {
  items: RecommendItem[]
}

export interface Subsidy {
  name: string
  monthly: number
  months: number
  selection: string
}

/** 한쪽(전남 또는 서울)의 1년차 월 기준 남는 돈 내역 */
export interface SavingsBreakdown {
  project_id: string
  display_name: string
  place: string
  salary_floor_manwon: number
  net_pay: number
  housing: string
  rent: number
  transit: number
  transit_label: string
  living_cost: number
  car_fixed: number
  car_alt: { fuel: number; round_trip_km: number } | null
  subsidy: Subsidy | null
  costs: number
  savings: number
  savings_after_subsidy: number
}

export type CumulativeMonths = '12' | '24' | '60'
export type Cumulative = Record<CumulativeMonths, { jeonnam: number; seoul: number }>

/** POST /savings/compare */
export interface CompareResponse {
  jeonnam: SavingsBreakdown
  seoul: SavingsBreakdown
  advantage_monthly: number
  /** 역전 지원금 S (월). 전남이 더 남으면 0 */
  reversal_subsidy: number
  /** 손익분기 X (0.194 = 19.4%) */
  break_even_ratio: number
  /** 실제 격차 g */
  actual_gap_ratio: number
  message: SavingsMessage
  cumulative: Cumulative
  project: SavingsProject
  fit: FitScore
  seoul_project: SavingsProject
}

/** POST /savings/analysis. 형식이 맞지 않으면 lines가 null이고 raw만 있다 (로컬 mock 포함) */
export interface AnalysisResponse {
  lines: Record<'맞는 점' | '아쉬운 점' | '판단', string> | null
  raw: string
  mode: AiMode
}

/** POST /savings/roadmap */
export interface RoadmapResponse {
  lines: Record<'1개월' | '3개월' | '6개월' | '경력', string> | null
  raw: string
  mode: AiMode
  totals: { project_id: string; display_name: string; cumulative: Cumulative }[]
}
