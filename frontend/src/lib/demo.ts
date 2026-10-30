// 개발용 데모 API. `vite --mode demo`에서만 쓰이며 운영 빌드에는 포함되지 않는다.
// 백엔드(team 라우터)가 없어도 화면을 확인할 수 있도록 design.md §5, §7, §14, §15의 산식을 따른 응답을 만든다.
//
// 지역 기준값(월세, 지원 제도, 교통 요금, 서울 보수)은 팀이 조사한 값이며 backend/app/team/region_data.py와
// 같은 값이다. 서울 보수는 아래 표본에서 코드로 평균을 낸다.
// 프로젝트·인재·기업 이름, 월 단가, 기업 유형·산업·특성 태그, 지역 기술 수요 비율은 화면 확인용 가상 값이다.
// ?ai_error=429 (또는 502)를 주소에 붙이면 AI 호출이 실패한 상태를 확인할 수 있다.

import type {
  AiText, CardResponse, Category, CompanyOption, JobFamily, Meta, PayBasis, PayGrade,
  PayCompareRow, Preference, PreferenceFields, PreferenceMatchesResponse, Project, ProjectInput,
  ProjectListItem, ProjectSkill, RecommendationItem, RecommendationsResponse, Region, Scenario,
  SimilarTo, SimulationResponse, SkillGap, SourceNote, StackDemandResponse, StackGroup, Talent,
  TalentInput, TalentSkill, TalentSummary, UnavailableScenario,
} from '@/types'
import { ApiError } from './api'

const MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
const DEMO_NOTE = '데모 값 (실제 자료 아님)'

// ---------------------------------------------------------------- 카탈로그

const SKILLS = [
  'Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'SQL', 'Docker', 'AWS', 'Spark',
  'React', 'TypeScript', 'HTML/CSS', 'Figma', '서비스 기획', '데이터 분석',
  'Java', 'Spring', '전자정부프레임워크', 'MyBatis', 'JSP', 'Oracle',
]

const JOB_FAMILIES: JobFamily[] = [
  { name: 'AI 모델링', category: '개발' },
  { name: '데이터 엔지니어링', category: '개발' },
  { name: '백엔드·API', category: '개발' },
  { name: '프론트엔드', category: '개발' },
  { name: '서비스 기획', category: '기획' },
  { name: '웹 퍼블리싱', category: '퍼블리싱' },
  { name: 'UI·UX 디자인', category: '디자인' },
  { name: '기타', category: '기타' },
]

const PAY_GRADES: PayGrade[] = [
  { key: 'G1', label: '등급 1 (데모)', monthly: 280 },
  { key: 'G2', label: '등급 2 (데모)', monthly: 320 },
  { key: 'G3', label: '등급 3 (데모)', monthly: 360 },
]

const ORG_TYPES = ['공공기관', '대기업·제조', '스타트업·IT', '지역 SI']
const INDUSTRIES = ['에너지·전력', '철강·화학', '농업·식품', '자동차·가전', 'AI·데이터', '공공행정·SI', '기타']
const STYLE_TAGS = ['안정 지향', '빠른 성장', '체계적 프로세스', '수평적 문화', '신기술 적극 도입', '워라밸 중시']

const META: Meta = {
  skills: SKILLS,
  categories: ['개발', '기획', '퍼블리싱', '디자인', '기타'],
  job_families: JOB_FAMILIES,
  regions: ['광주', '나주', '광양'],
  gwangju_districts: ['광산구', '북구', '서구', '남구', '동구'],
  work_modes: ['상주', '재택', '혼합'],
  pay_grades: PAY_GRADES,
  org_types: ORG_TYPES,
  industries: INDUSTRIES,
  style_tags: STYLE_TAGS,
}

// ---------------------------------------------------------------- 지역 기준표 (팀 조사값)

interface Note { value: number | null; source: string; is_assumption: boolean }

const DEDUCTION_RATE = 0.033

const RENT_SRC = (n: number, extra = '') =>
  `국토교통부 실거래가, 2026-05-01~10-30 계약, 연립다세대+단독다가구 월세 33㎡ 이하 중앙값 (${n}건${extra})`
const RENT: Record<string, Note> = {
  광주: { value: 38, source: RENT_SRC(2116), is_assumption: false },
  나주: { value: 35, source: RENT_SRC(74, ', 건수 적음 참고용'), is_assumption: false },
  광양: { value: 38, source: RENT_SRC(80, ', 건수 적음 참고용'), is_assumption: false },
  강남구: { value: 69, source: RENT_SRC(1955), is_assumption: false },
  영등포구: { value: 42, source: RENT_SRC(2131), is_assumption: false },
  중구: { value: 52, source: RENT_SRC(502), is_assumption: false },
}

/** 지역 안에서 타는 편도 요금(원) */
const LOCAL_FARE: Record<string, Note> = {
  광주: { value: 1250, source: '아시아경제 2026-07-08, 시내버스 카드', is_assumption: false },
  나주: { value: 1450, source: '나주시 BIS, 시내버스 교통카드', is_assumption: false },
  광양: { value: 1500, source: '광양시청, 시내버스 교통카드', is_assumption: false },
  서울: { value: 1550, source: '이투데이, 지하철 기본요금 (환승·거리 추가요금 미반영)', is_assumption: false },
}

/** 지역 사이 편도 요금(원). 양방향 같은 값 */
const FARES: { a: string; b: string; note: Note }[] = [
  { a: '광주', b: '나주', note: { value: 2750, source: '나주시 BIS, 광주↔나주 광역버스 (보수적 값)', is_assumption: false } },
  { a: '광주', b: '광양', note: { value: 11900, source: '시외버스 우등 (일반 9,100 / 프리미엄 14,300)', is_assumption: false } },
  { a: '광주', b: '서울', note: { value: 38600, source: 'KTX 일반실 용산→광주송정 (반대 방향은 같다고 추정)', is_assumption: true } },
]

const POLICIES = [
  { name: '국가 청년월세 지원', scope: '전국', monthly: 20 as number | null, months: 24, source: '광양시 공고, 토스뱅크' },
  { name: '나주시 청년 취업자 주거비 지원', scope: '나주', monthly: 20 as number | null, months: 12, source: '위키트리 2026-08-11' },
  { name: '서울시 청년월세지원', scope: '서울', monthly: 20 as number | null, months: 12, source: 'gobang.kr' },
  { name: '광양시 청년 주거 지원', scope: '광양', monthly: null as number | null, months: 0, source: '조사 자료 없음' },
]
const SCOPE: Record<string, string> = {
  광주: '광주', 나주: '나주', 광양: '광양', 강남구: '서울', 영등포구: '서울', 중구: '서울',
}
const SEOUL_DISTRICTS = ['강남구', '영등포구', '중구']

/** 서울 공고 표본: 구, 연봉 하한·상한(만 원). 기업명·원문은 두지 않는다. null은 비공개 */
interface PaySample { district: string; min: number | null; max: number | null; lowerBound?: boolean }
const SEOUL_PAY_SAMPLES: PaySample[] = [
  { district: '강남구', min: 3000, max: 5000 }, { district: '강남구', min: 2600, max: 2800 },
  { district: '강남구', min: 4000, max: 6000 }, { district: '강남구', min: 5000, max: 5500 },
  { district: '영등포구', min: 5000, max: 5000 }, { district: '영등포구', min: 3000, max: 3400 },
  { district: '영등포구', min: 3500, max: 4500 }, { district: '영등포구', min: 3200, max: 5000 },
  { district: '중구', min: 3368, max: 3368 }, { district: '중구', min: 3000, max: 4000 },
  { district: '중구', min: 6000, max: 6000, lowerBound: true }, // "월 500만원 이상"의 하한
  { district: '중구', min: null, max: null }, // 비공개
]
const SEOUL_PAY_SOURCE = {
  source: '고용24 공고 표본 (팀 직접 수집, 기업명·원문 미저장)',
  collected_at: null as string | null,
  note: '구별 3~4건, 직무 혼합 평균. 선택한 프로젝트와 같은 직무의 보수가 아닙니다.',
}

/** 구별(또는 전체) 평균 월 단가와 표본 수. 평균 연봉 ÷ 12를 반올림한다 */
function seoulPay(district: string | null): { monthly: number; n: number; lowerBound: boolean } {
  const used = SEOUL_PAY_SAMPLES.filter(s =>
    s.min !== null && s.max !== null && (district === null || s.district === district))
  const annual = used.reduce((sum, s) => sum + ((s.min ?? 0) + (s.max ?? 0)) / 2, 0) / used.length
  return { monthly: Math.trunc(annual / 12 + 0.5), n: used.length, lowerBound: used.some(s => s.lowerBound) }
}

// ---------------------------------------------------------------- 시드 (가상)

function sk(skill: string, min_level: number, is_required: boolean): ProjectSkill {
  return { skill, min_level, is_required }
}

type ProjectSeed = Omit<Project, 'is_demo' | 'status' | 'housing_support' | 'commute_support' | 'roles'> &
  Partial<Pick<Project, 'status' | 'housing_support' | 'commute_support' | 'roles'>>

/** 데모 시계: 시드는 기준 시각 이전, 새로 등록한 공고는 이후로 만든다 */
let clock = Date.parse('2026-10-30T09:00:00Z')
const createdAt = new Map<number, number>()

function project(base: ProjectSeed): Project {
  createdAt.set(base.id, Date.parse('2026-10-20T09:00:00Z'))
  return { status: 'open', housing_support: false, commute_support: false, roles: [], ...base, is_demo: true }
}

const PROJECTS: Project[] = [
  project({
    id: 1, company_name: '가상기업 A', region: '나주', district: '빛가람동', category: '개발',
    job_family: 'AI 모델링', title: '에너지 사용량 예측 모델 개발',
    description: '지역 에너지 사용 데이터를 학습해 수요 예측 모델을 만들고 평가합니다.',
    work_mode: '상주', onsite_days_per_week: 4, meeting_per_month: null,
    pay_monthly: 320, pay_grade: 'G2', start_date: '2026-11-16', end_date: '2027-03-31',
    housing_support: true, org_type: '공공기관', industry: '에너지·전력', style_tags: ['안정 지향', '체계적 프로세스'],
    skills: [sk('Python', 4, true), sk('PyTorch', 3, true), sk('SQL', 2, true), sk('Docker', 2, false)],
    roles: [
      { role_name: '모델링', headcount: 2, skills: ['Python', 'PyTorch'] },
      { role_name: '데이터', headcount: 1, skills: ['SQL', 'Docker'] },
    ],
  }),
  project({
    id: 3, company_name: '가상기업 C', region: '나주', district: '성북동', category: '개발',
    job_family: '백엔드·API', title: '지역 농산물 유통 API 구축',
    description: '농산물 출하·주문 데이터를 다루는 REST API를 설계하고 구현합니다.',
    work_mode: '상주', onsite_days_per_week: 5, meeting_per_month: null,
    pay_monthly: 320, pay_grade: 'G2', start_date: '2026-11-23', end_date: '2027-02-26',
    org_type: '공공기관', industry: '농업·식품', style_tags: ['안정 지향'],
    skills: [sk('Java', 3, true), sk('Spring', 3, true), sk('SQL', 3, true), sk('전자정부프레임워크', 2, false), sk('Oracle', 2, false)],
  }),
  project({
    id: 4, company_name: '가상기업 D', region: '광양', district: '중동', category: '개발',
    job_family: 'AI 모델링', title: '설비 이상 탐지 모델 PoC',
    description: '제조 설비 센서 데이터에서 이상 징후를 찾는 모델의 개념 검증을 진행합니다.',
    work_mode: '상주', onsite_days_per_week: 3, meeting_per_month: null,
    pay_monthly: 360, pay_grade: 'G3', start_date: '2026-12-01', end_date: '2027-04-30',
    commute_support: true, org_type: '대기업·제조', industry: '철강·화학', style_tags: ['체계적 프로세스', '신기술 적극 도입'],
    skills: [sk('Python', 4, true), sk('TensorFlow', 3, true), sk('Spark', 2, false)],
    roles: [
      { role_name: '모델링', headcount: 1, skills: ['Python', 'TensorFlow'] },
      { role_name: '데이터', headcount: 1, skills: ['Spark'] },
    ],
  }),
  project({
    id: 6, company_name: '가상기업 F', region: '광주', district: '첨단동', category: '개발',
    job_family: '백엔드·API', title: '시민 민원 처리 서비스 백엔드',
    description: '민원 접수·분류·처리 상태를 관리하는 서비스의 백엔드를 개발합니다.',
    work_mode: '상주', onsite_days_per_week: 3, meeting_per_month: null,
    pay_monthly: 320, pay_grade: 'G2', start_date: '2026-11-16', end_date: '2027-03-12',
    org_type: '지역 SI', industry: '공공행정·SI', style_tags: ['체계적 프로세스', '워라밸 중시'],
    skills: [sk('Java', 4, true), sk('Spring', 3, true), sk('MyBatis', 3, true), sk('전자정부프레임워크', 2, false)],
    roles: [
      { role_name: 'API', headcount: 2, skills: ['Java', 'Spring'] },
      { role_name: '인프라', headcount: 1, skills: ['MyBatis'] },
    ],
  }),
  project({
    id: 8, company_name: '가상기업 H', region: '광주', district: '금남로', category: '기획',
    job_family: '서비스 기획', title: '지역 상권 데이터 서비스 기획',
    description: '상권 데이터를 활용한 서비스의 요구사항 정의와 화면 기획을 맡습니다.',
    work_mode: '상주', onsite_days_per_week: 4, meeting_per_month: null,
    pay_monthly: 280, pay_grade: 'G1', start_date: '2026-11-16', end_date: '2027-01-29',
    org_type: '스타트업·IT', industry: 'AI·데이터', style_tags: ['빠른 성장', '수평적 문화'],
    skills: [sk('서비스 기획', 3, true), sk('데이터 분석', 2, false), sk('Figma', 2, false)],
  }),
  project({
    id: 10, company_name: '가상기업 J', region: '광주', district: '상무지구', category: '개발',
    job_family: 'AI 모델링', title: '문서 분류 모델 개발 (재택)',
    description: '문서 분류 모델을 원격으로 개발하고 월 2회 대면 미팅으로 진행 상황을 공유합니다.',
    work_mode: '재택', onsite_days_per_week: null, meeting_per_month: 2,
    pay_monthly: 360, pay_grade: 'G3', start_date: '2026-11-16', end_date: '2027-05-14',
    org_type: '스타트업·IT', industry: 'AI·데이터', style_tags: ['빠른 성장', '신기술 적극 도입', '수평적 문화'],
    skills: [sk('Python', 3, true), sk('PyTorch', 3, true), sk('데이터 분석', 2, false)],
  }),
  project({
    id: 11, company_name: '가상기업 K', region: '광주', district: '북구청 인근', category: '개발',
    job_family: '프론트엔드', title: '(마감) 관광 안내 웹 프론트엔드',
    description: '이미 모집이 끝난 프로젝트입니다. 필터에서 제외되는 사례를 보여줍니다.',
    work_mode: '혼합', onsite_days_per_week: 2, meeting_per_month: null,
    pay_monthly: 280, pay_grade: 'G1', status: 'closed', start_date: '2026-10-01', end_date: '2026-12-18',
    org_type: '스타트업·IT', industry: '기타', style_tags: ['워라밸 중시'],
    skills: [sk('React', 3, true), sk('TypeScript', 3, true)],
  }),
]
let nextProjectId = 100

function tskill(skill: string, level: number): TalentSkill {
  return { skill, level, evidence: null, evidence_source: null }
}

const TALENTS: Talent[] = [
  {
    id: 1, nickname: '인재-01', account_type: 'individual', team_id: null,
    affiliation: '광주 소재 대학 재학', desired_category: '개발', work_mode_pref: '무관',
    desired_regions: ['광주', '나주', '광양'], available_start: '2026-11-16', available_end: '2027-03-31',
    days_per_week: 5, living_type: '자취', home_district: '광산구', commute_mode: '대중교통',
    move_willingness: '이사 가능', housing_pref: '원룸', fixed_expense: 15, support_eligible: true,
    narrative: '교내 프로젝트에서 수요 예측 모델을 PyTorch로 만들고 FastAPI로 서빙해 보았습니다. Docker로 실행 환경을 정리한 경험이 있습니다.',
    portfolio_url: null, card_mode: null, is_demo: true,
    skills: [tskill('Python', 4), tskill('PyTorch', 3), tskill('SQL', 3), tskill('Docker', 2), tskill('FastAPI', 3), tskill('Java', 3)],
  },
  {
    id: 2, nickname: '인재-02', account_type: 'individual', team_id: null,
    affiliation: '광주 거주 구직자', desired_category: '개발', work_mode_pref: '상주',
    desired_regions: ['광주', '나주'], available_start: '2026-11-23', available_end: '2027-02-26',
    days_per_week: 3, living_type: '본가', home_district: '북구', commute_mode: '자차',
    move_willingness: '현재 거주지에서 통근', housing_pref: null, fixed_expense: null, support_eligible: false,
    narrative: '부트캠프에서 Java와 Spring, SQL 중심으로 API 서버를 만들고 AWS에 배포했습니다.',
    portfolio_url: null, card_mode: null, is_demo: true,
    skills: [tskill('Java', 4), tskill('Spring', 3), tskill('SQL', 4), tskill('AWS', 3), tskill('Docker', 3), tskill('MyBatis', 2)],
  },
  {
    id: 3, nickname: '인재-03', account_type: 'individual', team_id: null,
    affiliation: '광주 소재 대학 재학', desired_category: '기획', work_mode_pref: '무관',
    desired_regions: ['광주'], available_start: '2026-11-16', available_end: '2027-01-29',
    days_per_week: 4, living_type: '기숙사', home_district: '동구', commute_mode: '대중교통',
    move_willingness: '현재 거주지에서 통근', housing_pref: '원룸', fixed_expense: 10, support_eligible: true,
    narrative: '창업 동아리에서 서비스 기획과 사용자 인터뷰를 맡았고, 설문 데이터를 분석해 개선안을 냈습니다.',
    portfolio_url: null, card_mode: null, is_demo: true,
    skills: [tskill('서비스 기획', 4), tskill('데이터 분석', 3), tskill('Figma', 2)],
  },
]
let nextTalentId = 4

const EMPTY_PREF: PreferenceFields = {
  org_types: [], industries: [], style_tags: [], preferred_skills: [], favorite_companies: [],
}
interface StoredPref extends PreferenceFields { lastSeen: number }
const PREFS = new Map<number, StoredPref>([
  [2, {
    org_types: ['공공기관', '지역 SI'], industries: ['공공행정·SI', '에너지·전력'], style_tags: ['안정 지향', '체계적 프로세스'],
    preferred_skills: ['Java', 'Spring'], favorite_companies: ['가상기업 F'], lastSeen: Date.parse('2026-10-25T00:00:00Z'),
  }],
])

// 지역 기술 수요: 화면 확인용 임의 비율이다 (실제 집계가 아님). 백엔드 STACK_DEMAND는 수집 전까지 비어 있다.
const DEMO_STACK: Record<string, { n: number; skills: Record<string, number> }> = {
  공공기관: { n: 8, skills: { Java: 75, Spring: 63, 전자정부프레임워크: 50, MyBatis: 38, Oracle: 38, SQL: 63, Python: 13 } },
  '대기업·제조': { n: 12, skills: { Java: 42, Python: 50, SQL: 58, Spark: 17, Oracle: 25 } },
  '스타트업·IT': { n: 14, skills: { Python: 57, React: 43, TypeScript: 36, AWS: 50, Docker: 36, Java: 14 } },
  '지역 SI': { n: 6, skills: { Java: 83, Spring: 67, MyBatis: 50, JSP: 33, Oracle: 50 } },
}
const DEMO_METRO = { n: 40, skills: { Java: 35, Spring: 30, React: 55, TypeScript: 48, Python: 45, AWS: 52 } as Record<string, number> }

// ---------------------------------------------------------------- 유틸

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const roundHalf = (x: number) => Math.trunc(x + 0.5) // 설계서의 int(x + 0.5)
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const dayMs = 86_400_000

function days(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / dayMs + 1
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(Date.parse(aStart), Date.parse(bStart))
  const end = Math.min(Date.parse(aEnd), Date.parse(bEnd))
  return end < start ? 0 : (end - start) / dayMs + 1
}

function findTalent(id: number): Talent {
  const talent = TALENTS.find(t => t.id === id)
  if (!talent) throw new ApiError(404, '인재를 찾을 수 없습니다.')
  return talent
}

function findProject(id: number): Project {
  const found = PROJECTS.find(p => p.id === id)
  if (!found) throw new ApiError(404, '프로젝트를 찾을 수 없습니다.')
  return found
}

function aiText(text: string): AiText {
  const forced = new URLSearchParams(window.location.search).get('ai_error')
  if (forced) {
    const code = Number(forced) || 502
    return {
      text, source: 'fallback', mode: null, model_id: MODEL, cached: false,
      error: {
        code,
        message: code === 429 ? 'AI 호출 한도 초과: 분당 20회 또는 하루 600회' : 'AI 서버 오류가 발생했습니다.',
      },
    }
  }
  return { text, source: 'fallback', mode: 'mock', model_id: MODEL, cached: false, error: null }
}

// ---------------------------------------------------------------- 적합도 점수 (§5)

const MODE_SCORE: Record<string, Record<string, number>> = {
  상주: { 상주: 15, 재택: 0, 혼합: 8 },
  재택: { 상주: 0, 재택: 15, 혼합: 8 },
  무관: { 상주: 15, 재택: 15, 혼합: 15 },
}

function levelOf(talent: Talent, skill: string): number {
  return talent.skills.find(s => s.skill.toLowerCase() === skill.toLowerCase())?.level ?? 0
}

function scoreProject(talent: Talent, p: Project) {
  const required = p.skills.filter(s => s.is_required)
  const preferred = p.skills.filter(s => !s.is_required)
  const requiredPart = required.length === 0
    ? 60
    : 60 * mean(required.map(s => Math.min(levelOf(talent, s.skill), s.min_level) / s.min_level))
  const preferredPart = preferred.length === 0
    ? 10
    : 10 * preferred.filter(s => levelOf(talent, s.skill) >= s.min_level).length / preferred.length
  const skill = roundHalf(requiredPart + preferredPart)
  const workMode = MODE_SCORE[talent.work_mode_pref]?.[p.work_mode] ?? 0
  const overlap = overlapDays(talent.available_start, talent.available_end, p.start_date, p.end_date)
  const periodPart = 10 * overlap / days(p.start_date, p.end_date)
  const daysPart = p.work_mode === '재택' || talent.days_per_week >= (p.onsite_days_per_week ?? 0) ? 5 : 0
  const schedule = roundHalf(periodPart + daysPart)

  const gaps: SkillGap[] = p.skills
    .filter(s => levelOf(talent, s.skill) < s.min_level)
    .map(s => ({
      skill: s.skill, current: levelOf(talent, s.skill), required: s.min_level,
      kind: s.is_required ? 'required' : 'preferred',
    }))
  const matched = p.skills.filter(s => levelOf(talent, s.skill) >= s.min_level).map(s => s.skill)
  return {
    score: { total: skill + workMode + schedule, skill, work_mode: workMode, schedule },
    requiredPart, gaps, matched,
  }
}

function summaryOfProject(x: Project) {
  return {
    id: x.id, title: x.title, company_name: x.company_name, region: x.region, work_mode: x.work_mode,
    pay_monthly: x.pay_monthly, category: x.category, job_family: x.job_family,
    org_type: x.org_type, industry: x.industry, style_tags: x.style_tags,
  }
}

/** §5.2 필터. 통과한 공고와 제외 건수 */
function filterFor(talent: Talent, pool: Project[]) {
  const excluded = { closed: 0, category: 0, region: 0 }
  const kept: Project[] = []
  for (const p of pool) {
    if (p.status !== 'open') { excluded.closed++; continue }
    if (p.category !== talent.desired_category) { excluded.category++; continue }
    if (p.work_mode !== '재택' && !talent.desired_regions.includes(p.region)) { excluded.region++; continue }
    kept.push(p)
  }
  return { kept, excluded }
}

function recommend(talent: Talent): RecommendationsResponse {
  const { kept, excluded } = filterFor(talent, PROJECTS)
  const scored = kept.map(p => {
    const s = scoreProject(talent, p)
    return { project: summaryOfProject(p), score: s.score, matched: s.matched, gaps: s.gaps, requiredPart: s.requiredPart }
  })
  scored.sort((a, b) =>
    b.score.total - a.score.total || b.requiredPart - a.requiredPart || a.project.id - b.project.id)
  return {
    talent_id: talent.id,
    candidates: scored.length,
    excluded,
    items: scored.map(({ requiredPart: _unused, ...rest }, index) => ({
      ...rest, rank: index + 1, explanation: null,
    })),
  }
}

function matchSentence(item: RecommendationItem): string {
  const required = item.gaps.filter(g => g.kind === 'required')
  const gapText = required.length === 0
    ? '필수 기술은 모두 충족합니다.'
    : `부족한 필수 기술: ${required.map(g => `${g.skill} (현재 ${g.current} → 필요 ${g.required})`).join(', ')}.`
  return `총점 ${item.score.total}점, 일치 기술 ${item.matched.length}개. ${gapText}`
}

// ---------------------------------------------------------------- 선호 일치도 (§14.4)

const W_ORG = 25
const W_INDUSTRY = 25
const W_STYLE = 20
const W_STACK = 30
const SIMILAR_THRESHOLD = 50

const key = (s: string) => s.trim().toLowerCase()
const overlapOf = (wanted: string[], have: string[]) => {
  const haveKeys = new Set(have.map(key))
  return wanted.filter(w => haveKeys.has(key(w)))
}

function prefScore(prefs: PreferenceFields, p: Project) {
  const skills = p.skills.map(s => s.skill)
  const matchedOrg = prefs.org_types.includes(p.org_type) ? [p.org_type] : []
  const org = prefs.org_types.length === 0 ? W_ORG : matchedOrg.length > 0 ? W_ORG : 0
  const matchedIndustry = prefs.industries.includes(p.industry) ? [p.industry] : []
  const industry = prefs.industries.length === 0 ? W_INDUSTRY : matchedIndustry.length > 0 ? W_INDUSTRY : 0
  const matchedStyle = prefs.style_tags.filter(t => p.style_tags.includes(t))
  const style = prefs.style_tags.length === 0 ? W_STYLE : roundHalf(W_STYLE * matchedStyle.length / prefs.style_tags.length)
  const matchedSkills = overlapOf(prefs.preferred_skills, skills)
  const stack = prefs.preferred_skills.length === 0
    ? W_STACK : roundHalf(W_STACK * matchedSkills.length / prefs.preferred_skills.length)
  return {
    total: org + industry + style + stack, org_type: org, industry, style, stack,
    matched: { org_types: matchedOrg, industries: matchedIndustry, style_tags: matchedStyle, skills: matchedSkills },
  }
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map(key))
  const setB = new Set(b.map(key))
  const union = new Set([...setA, ...setB])
  if (union.size === 0) return 0
  let common = 0
  for (const x of setA) if (setB.has(x)) common++
  return common / union.size
}

function similarTo(prefs: PreferenceFields, p: Project): SimilarTo | null {
  let best: SimilarTo | null = null
  for (const company of prefs.favorite_companies) {
    if (company === p.company_name) continue
    const refs = PROJECTS.filter(x => x.company_name === company)
    if (refs.length === 0) continue
    const ref = refs.reduce((a, b) => (a.id < b.id ? a : b))
    const sameOrg = p.org_type === ref.org_type
    const sameIndustry = p.industry === ref.industry
    const mine = p.skills.map(s => s.skill)
    const theirs = ref.skills.map(s => s.skill)
    const similarity = roundHalf(40 * Number(sameOrg) + 40 * Number(sameIndustry) + 20 * jaccard(mine, theirs))
    if (best === null || similarity > best.similarity) {
      best = { company, similarity, same_org_type: sameOrg, same_industry: sameIndustry, shared_skills: overlapOf(mine, theirs) }
    }
  }
  return best !== null && best.similarity >= SIMILAR_THRESHOLD ? best : null
}

function matches(talent: Talent, scope: 'new' | 'all'): PreferenceMatchesResponse {
  const stored = PREFS.get(talent.id)
  const base = { scope, new_count: 0, candidates: 0, excluded: { closed: 0, category: 0, region: 0 }, items: [] }
  if (!stored) return { ...base, preference_set: false }

  const prefs: PreferenceFields = stored
  const { kept, excluded } = filterFor(talent, PROJECTS)
  const isNew = (p: Project) => (createdAt.get(p.id) ?? 0) > stored.lastSeen
  const newCount = kept.filter(isNew).length
  const pool = scope === 'new' ? kept.filter(isNew) : kept

  const rows = pool.map(p => {
    const fit = scoreProject(talent, p)
    const rank = prefs.favorite_companies.indexOf(p.company_name)
    const similar = similarTo(prefs, p)
    return { p, fit, pref: prefScore(prefs, p), favoriteRank: rank >= 0 ? rank + 1 : null, similar }
  })
  rows.sort((a, b) =>
    (a.favoriteRank ?? 99) - (b.favoriteRank ?? 99) ||
    b.pref.total - a.pref.total ||
    (b.similar?.similarity ?? 0) - (a.similar?.similarity ?? 0) ||
    b.fit.score.total - a.fit.score.total ||
    a.p.id - b.p.id)

  return {
    preference_set: true, scope, new_count: newCount, candidates: rows.length, excluded,
    items: rows.map((r, index) => ({
      rank: index + 1,
      project: { ...summaryOfProject(r.p), is_new: isNew(r.p) },
      pref: r.pref, favorite_rank: r.favoriteRank, similar_to: r.similar,
      fit: r.fit.score, gaps: r.fit.gaps, explanation: null,
    })),
  }
}

function prefSentence(item: PreferenceMatchesResponse['items'][number]): string {
  const m = item.pref.matched
  const parts: string[] = []
  if (m.org_types.length > 0) parts.push(`기업 유형(${m.org_types.join(', ')})`)
  if (m.industries.length > 0) parts.push(`산업(${m.industries.join(', ')})`)
  if (m.style_tags.length > 0) parts.push(`특성 태그 ${m.style_tags.length}개`)
  if (m.skills.length > 0) parts.push(`선호 기술 ${m.skills.length}개`)
  const head = parts.length > 0 ? `선호한 ${parts.join(', ')}이(가) 맞습니다.` : '선호 조건과 겹치는 속성이 적습니다.'
  const rank = item.favorite_rank !== null ? ` 관심 기업 ${item.favorite_rank}순위의 공고입니다.` : ''
  const like = item.similar_to ? ` 관심 기업 ${item.similar_to.company}과 비슷합니다 (유사도 ${item.similar_to.similarity}).` : ''
  return `${head}${rank}${like} 선호 일치도 ${item.pref.total}점.`
}

// ---------------------------------------------------------------- 지역 기술 수요 (§14.6)

function stackDemand(talentId: number | null): StackDemandResponse {
  const levels = new Map<string, number>()
  if (talentId !== null) for (const s of findTalent(talentId).skills) levels.set(key(s.skill), s.level)

  const groups: StackGroup[] = ORG_TYPES.map(group => {
    const data = DEMO_STACK[group]
    const items = Object.entries(data.skills)
      // 동점은 기술명 코드포인트 순. 백엔드(insights.py)와 같은 순서를 위해 localeCompare를 쓰지 않는다.
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, 10)
      .map(([skill, share]) => {
        const level = levels.get(key(skill)) ?? 0
        return {
          skill, share_pct: share, metro_share_pct: DEMO_METRO.skills[skill] ?? null, my_level: level,
          status: level <= 0 ? ('none' as const) : level < 3 ? ('low' as const) : ('ok' as const),
        }
      })
    return {
      group, sample_n: data.n, small_sample: data.n < 10, data_ready: true,
      metro_sample_n: DEMO_METRO.n, metro_label: '수도권 비교 표본',
      collected_at: '2026-10-30', source: `${DEMO_NOTE}. 실제 집계가 아닌 화면 확인용 임의 비율`, is_assumption: true, items,
    }
  })
  return { groups }
}

// ---------------------------------------------------------------- 시뮬레이션 (§7, §15)

function takeHome(pay: number): number {
  return roundHalf(pay * (1 - DEDUCTION_RATE))
}

function rentOf(place: string, talent: Talent): { value: number | null; note: Note; fallback: boolean } {
  const note = RENT[place]
  const fallback = talent.housing_pref !== null && talent.housing_pref !== '원룸'
  return { value: note?.value ?? null, note: note ?? { value: null, source: '확인 전', is_assumption: true }, fallback }
}

interface Fare { wonOneWay: number | null; estimated: boolean; note: Note }

const normPlace = (x: string) => (SEOUL_DISTRICTS.includes(x) ? '서울' : x)

/** 편도 요금. 같은 지역이면 그 지역의 시내 요금(§15.3) */
function fareBetween(a: string, b: string): Fare {
  const from = normPlace(a)
  const to = normPlace(b)
  const empty: Note = { value: null, source: '확인 전', is_assumption: true }
  if (from === to) {
    const local = LOCAL_FARE[from]
    return local ? { wonOneWay: local.value, estimated: false, note: local } : { wonOneWay: null, estimated: false, note: empty }
  }
  const direct = FARES.find(f => (f.a === from && f.b === to) || (f.a === to && f.b === from))
  if (direct) return { wonOneWay: direct.note.value, estimated: false, note: direct.note }
  if (from !== '광주' && to !== '광주') {
    const first = fareBetween(from, '광주')
    const second = fareBetween('광주', to)
    if (first.wonOneWay !== null && second.wonOneWay !== null) {
      return { wonOneWay: first.wonOneWay + second.wonOneWay, estimated: true, note: first.note }
    }
  }
  return { wonOneWay: null, estimated: false, note: empty }
}

function tripsOf(p: Project): number {
  return p.work_mode === '재택' ? (p.meeting_per_month ?? 0) : (p.onsite_days_per_week ?? 0) * 4
}

function supportFor(talent: Talent, residence: string, rent: number) {
  if (!talent.support_eligible) return { amount: 0, months: 0, name: null, reason: 'not_eligible' as const }
  if (rent <= 0) return { amount: 0, months: 0, name: null, reason: 'no_rent' as const }
  const candidates = POLICIES
    .filter(p => (p.scope === '전국' || p.scope === SCOPE[residence]) && p.monthly !== null)
    .map(p => ({ name: p.name, amount: Math.min(p.monthly ?? 0, rent), months: p.months }))
    .sort((a, b) => b.amount * b.months - a.amount * a.months || b.amount - a.amount || a.name.localeCompare(b.name))
  const best = candidates[0]
  if (!best) return { amount: 0, months: 0, name: null, reason: 'no_policy' as const }
  return { amount: best.amount, months: best.months, name: best.name, reason: null }
}

interface ScenarioArgs {
  key: string
  label: string
  residence: string
  pay: number
  payNote: SourceNote
  payBasis?: PayBasis
  /** null이면 월세 데이터 없음 */
  rent: number | null
  rentNote: Note
  rentFallback: boolean
  /** null이면 교통 요금 데이터 없음 */
  transport: number | null
  transportNote?: Note
  routeEstimated?: boolean
  fixed: number
  highlight?: boolean
}

function buildScenario(talent: Talent, a: ScenarioArgs): Scenario | UnavailableScenario {
  if (a.rent === null) return { key: a.key, reason: '월세 데이터 없음' }
  if (a.transport === null) return { key: a.key, reason: '교통 요금 데이터 없음' }
  const home = takeHome(a.pay)
  const base = home - a.rent - a.transport - a.fixed
  const support = supportFor(talent, a.residence, a.rent)
  const curve = [0]
  for (let m = 1; m <= 60; m++) {
    curve.push(curve[m - 1] + base + (m <= support.months ? support.amount : 0))
  }
  const sources: SourceNote[] = [
    a.payNote,
    { item: '월세', source: a.rentNote.source, is_assumption: a.rentNote.is_assumption },
    { item: '공제율 3.3%', source: '단일 공제율 가정 (Q2)', is_assumption: true },
  ]
  if (a.transport > 0 && a.transportNote) {
    sources.push({ item: '교통비', source: a.transportNote.source, is_assumption: a.transportNote.is_assumption })
  }
  if (support.name) {
    sources.push({
      item: '청년 지원금',
      source: `${support.name}. 소득·연령·거주 요건은 반영하지 않음 (본인 판단 체크 기준)`,
      is_assumption: false,
    })
  }
  return {
    key: a.key, label: a.label, residence: a.residence, highlight: a.highlight ?? false,
    pay: a.pay, pay_basis: a.payBasis, take_home: home, rent: a.rent, transport: a.transport, fixed: a.fixed,
    support: support.amount, support_months: support.months, support_name: support.name,
    support_reason: support.reason,
    saving_with_support: base + support.amount, saving_after_support: base,
    asset_24: curve[24], asset_60: curve[60], asset_curve: curve,
    flags: {
      housing_fallback: a.rentFallback && a.rent > 0,
      route_estimated: a.routeEstimated ?? false,
      car_fallback: talent.commute_mode === '자차' && a.transport > 0,
    },
    sources,
  }
}

function isScenario(x: Scenario | UnavailableScenario): x is Scenario {
  return 'asset_curve' in x
}

/** 월 교통비(만 원) = 2 × 편도 요금 × 횟수 ÷ 10,000 */
function transportCost(from: string, to: string, trips: number) {
  const fare = fareBetween(from, to)
  if (fare.wonOneWay === null) return { cost: null, fare }
  return { cost: roundHalf(2 * fare.wonOneWay * trips / 10_000), fare }
}

function simulate(talent: Talent, p: Project): SimulationResponse {
  const fixed = talent.fixed_expense ?? 0
  const trips = tripsOf(p)
  const localPay: SourceNote = { item: '보수(월 단가)', source: `${DEMO_NOTE} · 가상 프로젝트`, is_assumption: true }
  const built: (Scenario | UnavailableScenario)[] = []
  let mode: SimulationResponse['mode']

  if (p.work_mode === '재택') {
    mode = 'residence_compare'
    const regions: Region[] = ['광주', '나주', '광양']
    const list: (Scenario | UnavailableScenario)[] = regions.map(place => {
      const atHome = place === '광주' && talent.living_type === '본가'
      const r = rentOf(place, talent)
      const t = p.commute_support
        ? { cost: 0, fare: fareBetween(place, place) }
        : transportCost(place, p.region, trips)
      return buildScenario(talent, {
        key: `residence_${place}`, label: `${place}에 거주`, residence: place,
        pay: p.pay_monthly, payNote: localPay,
        rent: atHome ? 0 : r.value, rentNote: r.note, rentFallback: r.fallback,
        transport: t.cost, transportNote: t.fare.note, routeEstimated: t.fare.estimated, fixed,
      })
    })
    const available = list.filter(isScenario)
    const best = [...available].sort((a, b) => b.asset_60 - a.asset_60 || b.asset_24 - a.asset_24)[0]
    if (best) best.highlight = true
    built.push(...list)
  } else {
    mode = 'relocate_vs_commute'
    const r = rentOf(p.region, talent)
    const living = p.commute_support
      ? { cost: 0, fare: fareBetween(p.region, p.region) }
      : transportCost(p.region, p.region, trips)
    const relocate = buildScenario(talent, {
      key: 'relocate', label: p.region === '광주' ? '광주에서 새로 자취' : `${p.region}로 이사`,
      residence: p.region, pay: p.pay_monthly, payNote: localPay,
      rent: p.housing_support ? 0 : r.value, rentNote: r.note, rentFallback: r.fallback,
      transport: living.cost, transportNote: living.fare.note, fixed,
      highlight: talent.move_willingness === '이사 가능',
    })
    const home = rentOf('광주', talent)
    const commuteCost = p.commute_support
      ? { cost: 0, fare: fareBetween('광주', p.region) }
      : transportCost('광주', p.region, trips)
    const commute = buildScenario(talent, {
      key: 'commute', label: '현재 거주지(광주)에서 통근', residence: '광주',
      pay: p.pay_monthly, payNote: localPay,
      rent: talent.living_type === '본가' ? 0 : home.value, rentNote: home.note, rentFallback: home.fallback,
      transport: commuteCost.cost, transportNote: commuteCost.fare.note,
      routeEstimated: commuteCost.fare.estimated, fixed, highlight: talent.move_willingness !== '이사 가능',
    })
    built.push(relocate, commute)
  }

  // 서울 비교: 구별 공고 표본 평균 (§15.4)
  const payCompare: PayCompareRow[] = []
  const seoulNote = (n: number, lowerBound: boolean): SourceNote => ({
    item: '보수(월 단가)',
    source: `${SEOUL_PAY_SOURCE.source} · ${n}건 평균, 직무 혼합${lowerBound ? ' · "월 N만원 이상" 하한값 포함' : ''}`,
    is_assumption: false,
  })
  for (const district of SEOUL_DISTRICTS) {
    const sample = seoulPay(district)
    const r = rentOf(district, talent)
    const t = transportCost(district, district, trips)
    built.push(buildScenario(talent, {
      key: `seoul_${district}`, label: `서울 ${district}`, residence: district,
      pay: sample.monthly, payNote: seoulNote(sample.n, sample.lowerBound), payBasis: 'district_sample_mean',
      rent: r.value, rentNote: r.note, rentFallback: r.fallback,
      transport: t.cost, transportNote: t.fare.note, fixed,
    }))
    const diff = sample.monthly - p.pay_monthly
    payCompare.push({
      district, seoul_pay: sample.monthly, sample_n: sample.n, diff,
      ratio_pct: Math.trunc(diff / p.pay_monthly * 100 + 0.5),
      take_home_diff: takeHome(sample.monthly) - takeHome(p.pay_monthly),
    })
  }
  const overall = seoulPay(null)
  const home = rentOf('광주', talent)
  const ktx = transportCost('광주', '강남구', trips)
  built.push(buildScenario(talent, {
    key: 'seoul_ktx', label: '광주 거주 + KTX 통근 (참고)', residence: '광주',
    pay: overall.monthly, payNote: seoulNote(overall.n, overall.lowerBound), payBasis: 'district_sample_mean',
    rent: talent.living_type === '본가' ? 0 : home.value, rentNote: home.note, rentFallback: home.fallback,
    transport: ktx.cost, transportNote: ktx.fare.note, fixed,
  }))

  const scenarios = built.filter(isScenario)
  const unavailable = built.filter((x): x is UnavailableScenario => !isScenario(x))
  const seoulBest = scenarios
    .filter(s => s.key.startsWith('seoul_') && s.key !== 'seoul_ktx')
    .sort((a, b) => b.asset_60 - a.asset_60 || b.asset_24 - a.asset_24)[0]
  const highlight = scenarios.find(s => s.highlight)

  return {
    mode,
    project: {
      id: p.id, title: p.title, region: p.region, work_mode: p.work_mode, pay_monthly: p.pay_monthly,
      pay_grade: p.pay_grade, job_family: p.job_family, annual_gross: p.pay_monthly * 12,
    },
    scenarios, unavailable, pay_compare: payCompare, seoul_pay_source: SEOUL_PAY_SOURCE,
    summary: {
      best_seoul: seoulBest?.key ?? null,
      saving_diff: seoulBest && highlight ? seoulBest.saving_with_support - highlight.saving_with_support : 0,
      asset_24_diff: seoulBest && highlight ? seoulBest.asset_24 - highlight.asset_24 : 0,
      asset_60_diff: seoulBest && highlight ? seoulBest.asset_60 - highlight.asset_60 : 0,
    },
    notices: [
      '기본 생활비(식비 등)는 반영하지 않았습니다.',
      '보증금·이사 비용은 반영하지 않았습니다.',
      '같은 조건이 계속된다고 가정한 시나리오입니다.',
      '청년 지원금은 소득·연령·거주 요건을 반영하지 않고 본인 판단 체크만 따랐습니다.',
      '서울 보수는 공고 표본의 구별 평균(직무 혼합)이며 선택한 프로젝트와 같은 직무의 보수가 아닙니다.',
    ],
  }
}

function simSentence(sim: SimulationResponse): string {
  const local = sim.scenarios.find(s => s.highlight)
  const seoul = sim.scenarios.find(s => s.key === sim.summary.best_seoul)
  if (!local || !seoul) return '비교할 수 있는 시나리오가 부족합니다.'
  const diff = local.saving_with_support - seoul.saving_with_support
  const word = diff === 0 ? '같고' : diff > 0 ? '많고' : '적고'
  return `${local.label} 기준 월 저축은 서울 ${seoul.residence}보다 ${Math.abs(diff)}만 원 ${word}, ` +
    `60개월 뒤 자산 차이는 ${Math.abs(local.asset_60 - seoul.asset_60)}만 원입니다.`
}

// ---------------------------------------------------------------- 입력 검증

function validateTalent(input: TalentInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.nickname?.trim()) errors.nickname = '표시명을 입력하세요.'
  if (!input.narrative?.trim()) errors.narrative = '서술형 경험을 입력하세요.'
  else if (input.narrative.length > 1500) errors.narrative = '1,500자 이내로 입력하세요.'
  if (!input.desired_regions?.length) errors.desired_regions = '희망 근무 지역을 1곳 이상 고르세요.'
  if (!input.home_district) errors.home_district = '현재 거주 구를 고르세요.'
  if (!input.available_start) errors.available_start = '시작일을 입력하세요.'
  if (!input.available_end) errors.available_end = '종료일을 입력하세요.'
  else if (input.available_start && input.available_end < input.available_start) {
    errors.available_end = '종료일은 시작일보다 빠를 수 없습니다.'
  }
  if (!Number.isInteger(input.days_per_week) || input.days_per_week < 1 || input.days_per_week > 5) {
    errors.days_per_week = '주 근무일은 1~5입니다.'
  }
  if (!input.skills?.length) errors.skills = '기술을 1개 이상 추가하세요.'
  else if (input.skills.some(s => !Number.isInteger(s.level) || s.level < 1 || s.level > 5)) {
    errors.skills = '숙련도는 1~5 사이여야 합니다.'
  }
  return errors
}

function validateProject(input: ProjectInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.company_name?.trim()) errors.company_name = '기업명을 입력하세요.'
  if (!META.regions.includes(input.region)) errors.region = '지역은 광주·나주·광양만 가능합니다.'
  if (!input.title?.trim()) errors.title = '제목을 입력하세요.'
  if (!input.description?.trim()) errors.description = '설명을 입력하세요.'
  if (!ORG_TYPES.includes(input.org_type)) errors.org_type = '기업 유형을 고르세요.'
  if (!INDUSTRIES.includes(input.industry)) errors.industry = '산업을 고르세요.'
  if (!input.job_family || JOB_FAMILIES.find(f => f.name === input.job_family)?.category !== input.category) {
    errors.job_family = '분류에 속한 직무군을 고르세요.'
  }
  if (input.style_tags.length > 3 || input.style_tags.some(t => !STYLE_TAGS.includes(t))) {
    errors.style_tags = '특성 태그는 목록에서 최대 3개까지 고를 수 있습니다.'
  }
  if (!Number.isInteger(input.pay_monthly) || input.pay_monthly <= 0) errors.pay_monthly = '월 단가(만 원)를 입력하세요.'
  if (!input.start_date) errors.start_date = '시작일을 입력하세요.'
  if (!input.end_date) errors.end_date = '종료일을 입력하세요.'
  else if (input.start_date && input.end_date < input.start_date) errors.end_date = '종료일은 시작일보다 빠를 수 없습니다.'
  if (input.work_mode !== '재택' && (input.onsite_days_per_week === null || input.onsite_days_per_week < 1 || input.onsite_days_per_week > 5)) {
    errors.onsite_days_per_week = '주 출근일(1~5)을 입력하세요.'
  }
  if (input.work_mode === '재택' && (input.meeting_per_month === null || input.meeting_per_month < 0)) {
    errors.meeting_per_month = '월 대면 미팅 횟수(0 이상)를 입력하세요.'
  }
  if (input.skills.length === 0) errors.skills = '요구 기술을 1개 이상 추가하세요.'
  return errors
}

function validatePrefs(input: PreferenceFields): Record<string, string> {
  const errors: Record<string, string> = {}
  if (input.org_types.some(x => !ORG_TYPES.includes(x))) errors.org_types = '목록에 없는 기업 유형입니다.'
  if (input.industries.some(x => !INDUSTRIES.includes(x))) errors.industries = '목록에 없는 산업입니다.'
  if (input.style_tags.length > 3 || input.style_tags.some(x => !STYLE_TAGS.includes(x))) {
    errors.style_tags = '특성 태그는 목록에서 최대 3개까지 고를 수 있습니다.'
  }
  if (input.preferred_skills.some(x => !SKILLS.includes(x))) errors.preferred_skills = '목록에 없는 기술입니다.'
  const known = new Set(PROJECTS.map(p => p.company_name))
  if (input.favorite_companies.length > 3) errors.favorite_companies = '관심 기업은 최대 3개입니다.'
  else if (new Set(input.favorite_companies).size !== input.favorite_companies.length) {
    errors.favorite_companies = '같은 기업을 두 번 고를 수 없습니다.'
  } else if (input.favorite_companies.some(c => !known.has(c))) {
    errors.favorite_companies = '등록된 광주·나주·광양 기업만 고를 수 있습니다.'
  }
  return errors
}

function applyInput(target: Talent, input: TalentInput): void {
  const { skills, ...fields } = input
  Object.assign(target, fields)
  target.skills = skills.map(s => {
    const previous = target.skills.find(x => x.skill === s.skill)
    return { skill: s.skill, level: s.level, evidence: previous?.evidence ?? null, evidence_source: previous?.evidence_source ?? null }
  })
}

// ---------------------------------------------------------------- 라우터

function summaryOf(t: Talent): TalentSummary {
  return { id: t.id, nickname: t.nickname, account_type: t.account_type, desired_category: t.desired_category, is_demo: t.is_demo }
}

function listItem(x: Project): ProjectListItem {
  return { ...summaryOfProject(x), district: x.district, pay_grade: x.pay_grade, start_date: x.start_date, end_date: x.end_date, status: x.status }
}

function companies(): CompanyOption[] {
  const seen = new Map<string, CompanyOption>()
  for (const p of [...PROJECTS].sort((a, b) => a.id - b.id)) {
    if (!seen.has(p.company_name)) {
      seen.set(p.company_name, { company_name: p.company_name, region: p.region, org_type: p.org_type, industry: p.industry })
    }
  }
  return [...seen.values()]
}

function preferenceOf(talentId: number): Preference {
  const stored = PREFS.get(talentId)
  if (!stored) return { exists: false, last_seen_at: null, ...EMPTY_PREF }
  const { lastSeen, ...fields } = stored
  return { exists: true, last_seen_at: new Date(lastSeen).toISOString(), ...fields }
}

function route(method: string, path: string, query: URLSearchParams, body: unknown): unknown {
  if (method === 'GET' && path === '/api/health') return { ok: true, ai_mode: 'mock' }
  if (!path.startsWith('/api/team')) throw new ApiError(404, `데모 API에 없는 경로: ${path}`)
  const p = path.slice('/api/team'.length)
  let m: RegExpMatchArray | null

  if (method === 'GET' && p === '/meta') return META
  if (method === 'POST' && p === '/seed') return { created: 0, skipped: TALENTS.length + PROJECTS.length }
  if (method === 'GET' && p === '/companies') return companies()
  if (method === 'GET' && p === '/stack-demand') {
    const talentId = query.get('talent_id')
    return stackDemand(talentId ? Number(talentId) : null)
  }

  if (method === 'GET' && p === '/talents') return TALENTS.map(summaryOf)
  if (method === 'POST' && p === '/talents') {
    const input = body as TalentInput
    const errors = validateTalent(input)
    if (Object.keys(errors).length > 0) throw new ApiError(422, '입력값을 확인하세요.', errors)
    const created: Talent = {
      ...(input as TalentInput), id: nextTalentId++, team_id: null, card_mode: null, is_demo: false, skills: [],
    }
    applyInput(created, input)
    TALENTS.push(created)
    return created
  }

  if ((m = p.match(/^\/talents\/(\d+)$/))) {
    const talent = findTalent(Number(m[1]))
    if (method === 'GET') return talent
    if (method === 'PUT') {
      const input = body as TalentInput
      const errors = validateTalent(input)
      if (Object.keys(errors).length > 0) throw new ApiError(422, '입력값을 확인하세요.', errors)
      applyInput(talent, input)
      return talent
    }
  }

  if ((m = p.match(/^\/talents\/(\d+)\/card$/))) {
    const talent = findTalent(Number(m[1]))
    if (method === 'POST') {
      const result = aiText('모의 응답: 근거 문장은 팀 서버에서 생성됩니다.')
      if (!result.error) talent.card_mode = 'mock'
      const response: CardResponse = { ...result, skills: talent.skills }
      return response
    }
    if (method === 'PUT') {
      const edits = (body as { skills: { skill: string; evidence: string | null }[] }).skills
      for (const edit of edits) {
        const target = talent.skills.find(s => s.skill === edit.skill)
        if (!target) continue
        const text = edit.evidence?.trim() ?? ''
        target.evidence = text === '' ? null : text.slice(0, 200)
        target.evidence_source = text === '' ? null : 'user'
      }
      return { skills: talent.skills }
    }
  }

  if ((m = p.match(/^\/talents\/(\d+)\/preferences$/))) {
    const talent = findTalent(Number(m[1]))
    if (method === 'GET') return preferenceOf(talent.id)
    if (method === 'PUT') {
      const input = body as PreferenceFields
      const errors = validatePrefs(input)
      if (Object.keys(errors).length > 0) throw new ApiError(422, '입력값을 확인하세요.', errors)
      const previous = PREFS.get(talent.id)
      PREFS.set(talent.id, { ...input, lastSeen: previous?.lastSeen ?? clock })
      return preferenceOf(talent.id)
    }
  }
  if (method === 'GET' && (m = p.match(/^\/talents\/(\d+)\/preference-matches$/))) {
    const scope = query.get('scope') === 'new' ? 'new' : 'all'
    return matches(findTalent(Number(m[1])), scope)
  }
  if (method === 'POST' && (m = p.match(/^\/talents\/(\d+)\/preference-matches\/seen$/))) {
    const talent = findTalent(Number(m[1]))
    const stored = PREFS.get(talent.id)
    if (!stored) throw new ApiError(422, '선호를 먼저 저장하세요.')
    clock += 60_000
    stored.lastSeen = clock
    return preferenceOf(talent.id)
  }
  if (method === 'POST' && (m = p.match(/^\/talents\/(\d+)\/preference-matches\/(\d+)\/explain$/))) {
    const talent = findTalent(Number(m[1]))
    const scope = (body as { scope?: string } | undefined)?.scope === 'new' ? 'new' : 'all'
    const result = matches(talent, scope)
    const item = result.items.find(i => i.project.id === Number(m?.[2]))
    if (!item) throw new ApiError(404, '목록에 없는 공고입니다.')
    if (item.rank > 3) throw new ApiError(422, '상위 3개 공고만 AI 설명을 요청할 수 있습니다.')
    return aiText(prefSentence(item))
  }

  if (method === 'GET' && (m = p.match(/^\/talents\/(\d+)\/recommendations$/))) {
    return recommend(findTalent(Number(m[1])))
  }
  if (method === 'POST' && (m = p.match(/^\/talents\/(\d+)\/recommendations\/(\d+)\/explain$/))) {
    const rec = recommend(findTalent(Number(m[1])))
    const item = rec.items.find(i => i.project.id === Number(m?.[2]))
    if (!item) throw new ApiError(404, '추천 목록에 없는 프로젝트입니다.')
    if (item.rank > 3) throw new ApiError(422, '추천 상위 3개 프로젝트만 AI 설명을 요청할 수 있습니다.')
    return aiText(matchSentence(item))
  }

  if (method === 'GET' && (m = p.match(/^\/talents\/(\d+)\/simulation$/))) {
    const projectId = Number(query.get('project_id'))
    if (!projectId) throw new ApiError(422, 'project_id가 필요합니다.', { project_id: '프로젝트를 고르세요.' })
    return simulate(findTalent(Number(m[1])), findProject(projectId))
  }
  if (method === 'POST' && (m = p.match(/^\/talents\/(\d+)\/simulation\/explain$/))) {
    const projectId = (body as { project_id?: number } | undefined)?.project_id
    if (!projectId) throw new ApiError(422, 'project_id가 필요합니다.', { project_id: '프로젝트를 고르세요.' })
    return aiText(simSentence(simulate(findTalent(Number(m[1])), findProject(projectId))))
  }

  if (method === 'GET' && p === '/projects') {
    const region = query.get('region')
    const category = query.get('category') as Category | null
    const workMode = query.get('work_mode')
    return PROJECTS
      .filter(x => (!region || x.region === region) && (!category || x.category === category) &&
        (!workMode || x.work_mode === workMode))
      .map(listItem)
  }
  if (method === 'POST' && p === '/projects') {
    const input = body as ProjectInput
    const errors = validateProject(input)
    if (Object.keys(errors).length > 0) throw new ApiError(422, '입력값을 확인하세요.', errors)
    const created: Project = { ...input, id: nextProjectId++, status: 'open', is_demo: false }
    clock += 60_000
    createdAt.set(created.id, clock)
    PROJECTS.push(created)
    return created
  }
  if (method === 'GET' && (m = p.match(/^\/projects\/(\d+)$/))) return findProject(Number(m[1]))

  throw new ApiError(404, `데모 API에 없는 경로: ${method} ${path}`)
}

export async function demoFetch<T>(url: string, init?: RequestInit): Promise<T> {
  await sleep(150)
  const method = (init?.method ?? 'GET').toUpperCase()
  const target = new URL(url, window.location.origin)
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  return structuredClone(route(method, target.pathname, target.searchParams, body)) as T
}
