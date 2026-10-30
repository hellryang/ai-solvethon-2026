// 개발용 데모 API. `vite --mode demo`에서만 쓰이며 운영 빌드에는 포함되지 않는다.
// 백엔드(team 라우터)가 없어도 화면을 확인할 수 있도록 design.md §5, §7의 산식을 따른 응답을 만든다.
//
// 이 파일의 모든 숫자와 이름은 화면 확인용 가상 값이다. 실제 월세·요금·지원금·보수 값이 아니다.
// 응답 안의 source 문구에도 "데모 값"을 적어 화면에서 가정값으로 보이게 한다.
// ?ai_error=429 (또는 502)를 주소에 붙이면 AI 호출이 실패한 상태를 확인할 수 있다.

import type {
  AiText, BenchmarkPeer, CardResponse, Category, JobFamily, Meta, PayBasis, PayGrade,
  PayCompareRow, Project, ProjectSkill, RecommendationItem, RecommendationsResponse,
  Region, Scenario, SimulationResponse, SkillGap, SourceNote, Talent, TalentInput,
  TalentSkill, TalentSummary, UnavailableScenario, WorkMode,
} from '@/types'
import { ApiError } from './api'

const MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
const DEMO_NOTE = '데모 값 (실제 자료 아님)'

// ---------------------------------------------------------------- 카탈로그

const SKILLS = [
  'Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'SQL', 'Docker', 'AWS', 'Spark',
  'React', 'TypeScript', 'HTML/CSS', 'Figma', '서비스 기획', '데이터 분석',
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

const META: Meta = {
  skills: SKILLS,
  categories: ['개발', '기획', '퍼블리싱', '디자인', '기타'],
  job_families: JOB_FAMILIES,
  regions: ['광주', '나주', '광양'],
  gwangju_districts: ['광산구', '북구', '서구', '남구', '동구'],
  work_modes: ['상주', '재택', '혼합'],
  pay_grades: PAY_GRADES,
}

// ---------------------------------------------------------------- 지역 기준표 (데모)

interface Note { value: number | null; source: string; is_assumption: boolean }

const DEDUCTION_RATE = 0.033
const RENT: Record<string, Note> = {
  광주: { value: 45, source: '보고서 화면 예시 (확인 전)', is_assumption: true },
  나주: { value: 42, source: '보고서 화면 예시 (확인 전)', is_assumption: true },
  광양: { value: 35, source: '보고서 화면 예시 (확인 전)', is_assumption: true },
  강남구: { value: 80, source: DEMO_NOTE, is_assumption: true },
  영등포구: { value: 70, source: DEMO_NOTE, is_assumption: true },
  // 일부러 비워 둔다: unavailable 표시 확인용
  중구: { value: null, source: '확인 전', is_assumption: true },
}
/** 편도 요금(원). 양방향 같은 값 */
const FARES: { a: string; b: string; note: Note }[] = [
  { a: '광주', b: '나주', note: { value: 4000, source: DEMO_NOTE, is_assumption: true } },
  { a: '광주', b: '광양', note: { value: 8000, source: DEMO_NOTE, is_assumption: true } },
  { a: '광주', b: '서울', note: { value: 46000, source: DEMO_NOTE, is_assumption: true } },
]
const POLICIES = [
  { name: '국가 청년월세 지원', scope: '전국', monthly: 20 as number | null, months: 12, source: '설계서 초기값 (확인 전)' },
  { name: '서울시 청년 주거 지원', scope: '서울', monthly: null as number | null, months: 0, source: '확인 전' },
  { name: '광양시 청년 주거 지원', scope: '광양', monthly: null as number | null, months: 0, source: '확인 전' },
  { name: '나주시 청년 주거 지원', scope: '나주', monthly: null as number | null, months: 0, source: '확인 전' },
]
const SCOPE: Record<string, string> = {
  광주: '광주', 나주: '나주', 광양: '광양', 강남구: '서울', 영등포구: '서울', 중구: '서울',
}
const SEOUL_DISTRICTS = ['강남구', '영등포구', '중구']

// ---------------------------------------------------------------- 시드 (가상)

function sk(skill: string, min_level: number, is_required: boolean): ProjectSkill {
  return { skill, min_level, is_required }
}

function project(
  base: Omit<Project, 'is_demo' | 'status' | 'housing_support' | 'commute_support' | 'roles'> &
    Partial<Pick<Project, 'status' | 'housing_support' | 'commute_support' | 'roles'>>,
): Project {
  return {
    status: 'open', housing_support: false, commute_support: false, roles: [], ...base, is_demo: true,
  }
}

const PROJECTS: Project[] = [
  project({
    id: 1, company_name: '가상기업 A', region: '나주', district: '빛가람동', category: '개발',
    job_family: 'AI 모델링', title: '에너지 사용량 예측 모델 개발',
    description: '지역 에너지 사용 데이터를 학습해 수요 예측 모델을 만들고 평가합니다.',
    work_mode: '상주', onsite_days_per_week: 4, meeting_per_month: null,
    pay_monthly: 320, pay_grade: 'G2', start_date: '2026-11-16', end_date: '2027-03-31',
    housing_support: true,
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
    skills: [sk('Python', 3, true), sk('FastAPI', 3, true), sk('SQL', 3, true), sk('Docker', 2, false), sk('AWS', 2, false)],
  }),
  project({
    id: 4, company_name: '가상기업 D', region: '광양', district: '중동', category: '개발',
    job_family: 'AI 모델링', title: '설비 이상 탐지 모델 PoC',
    description: '제조 설비 센서 데이터에서 이상 징후를 찾는 모델의 개념 검증을 진행합니다.',
    work_mode: '상주', onsite_days_per_week: 3, meeting_per_month: null,
    pay_monthly: 360, pay_grade: 'G3', start_date: '2026-12-01', end_date: '2027-04-30',
    commute_support: true,
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
    skills: [sk('FastAPI', 4, true), sk('SQL', 3, true), sk('AWS', 3, true)],
    roles: [
      { role_name: 'API', headcount: 2, skills: ['FastAPI', 'SQL'] },
      { role_name: '인프라', headcount: 1, skills: ['AWS'] },
    ],
  }),
  project({
    id: 8, company_name: '가상기업 H', region: '광주', district: '금남로', category: '기획',
    job_family: '서비스 기획', title: '지역 상권 데이터 서비스 기획',
    description: '상권 데이터를 활용한 서비스의 요구사항 정의와 화면 기획을 맡습니다.',
    work_mode: '상주', onsite_days_per_week: 4, meeting_per_month: null,
    pay_monthly: 280, pay_grade: 'G1', start_date: '2026-11-16', end_date: '2027-01-29',
    skills: [sk('서비스 기획', 3, true), sk('데이터 분석', 2, false), sk('Figma', 2, false)],
  }),
  project({
    id: 10, company_name: '가상기업 J', region: '광주', district: '상무지구', category: '개발',
    job_family: 'AI 모델링', title: '문서 분류 모델 개발 (재택)',
    description: '문서 분류 모델을 원격으로 개발하고 월 2회 대면 미팅으로 진행 상황을 공유합니다.',
    work_mode: '재택', onsite_days_per_week: null, meeting_per_month: 2,
    pay_monthly: 360, pay_grade: 'G3', start_date: '2026-11-16', end_date: '2027-05-14',
    skills: [sk('Python', 3, true), sk('PyTorch', 3, true), sk('데이터 분석', 2, false)],
  }),
  project({
    id: 11, company_name: '가상기업 K', region: '광주', district: '북구청 인근', category: '개발',
    job_family: '프론트엔드', title: '(마감) 관광 안내 웹 프론트엔드',
    description: '이미 모집이 끝난 프로젝트입니다. 필터에서 제외되는 사례를 보여줍니다.',
    work_mode: '혼합', onsite_days_per_week: 2, meeting_per_month: null,
    pay_monthly: 280, pay_grade: 'G1', status: 'closed', start_date: '2026-10-01', end_date: '2026-12-18',
    skills: [sk('React', 3, true), sk('TypeScript', 3, true)],
  }),
]

interface SeoulPost {
  id: number
  district: string
  title: string
  job_family: string
  work_mode: WorkMode
  pay_monthly: number
  pay_grade: string
  skills: ProjectSkill[]
}

const SEOUL_POSTS: SeoulPost[] = [
  { id: 1, district: '강남구', title: '[가상] AI 모델 개발 (상주)', job_family: 'AI 모델링', work_mode: '상주',
    pay_monthly: 420, pay_grade: 'G3', skills: [sk('Python', 4, true), sk('PyTorch', 3, true), sk('Docker', 2, false)] },
  { id: 2, district: '영등포구', title: '[가상] AI 모델 개발 (재택)', job_family: 'AI 모델링', work_mode: '재택',
    pay_monthly: 420, pay_grade: 'G3', skills: [sk('Python', 3, true), sk('PyTorch', 3, true)] },
  { id: 4, district: '강남구', title: '[가상] 백엔드 API 개발 (상주)', job_family: '백엔드·API', work_mode: '상주',
    pay_monthly: 380, pay_grade: 'G2', skills: [sk('Python', 3, true), sk('FastAPI', 3, true), sk('SQL', 3, true)] },
  { id: 6, district: '중구', title: '[가상] 서비스 기획 (상주)', job_family: '서비스 기획', work_mode: '상주',
    pay_monthly: 330, pay_grade: 'G1', skills: [sk('서비스 기획', 3, true), sk('Figma', 2, false)] },
]

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
    skills: [tskill('Python', 4), tskill('PyTorch', 3), tskill('SQL', 3), tskill('Docker', 2), tskill('FastAPI', 3)],
  },
  {
    id: 2, nickname: '인재-02', account_type: 'individual', team_id: null,
    affiliation: '광주 거주 구직자', desired_category: '개발', work_mode_pref: '상주',
    desired_regions: ['광주', '나주'], available_start: '2026-11-23', available_end: '2027-02-26',
    days_per_week: 3, living_type: '본가', home_district: '북구', commute_mode: '자차',
    move_willingness: '현재 거주지에서 통근', housing_pref: null, fixed_expense: null, support_eligible: false,
    narrative: '부트캠프에서 FastAPI와 SQL 중심으로 API 서버를 만들고 AWS에 배포했습니다.',
    portfolio_url: null, card_mode: null, is_demo: true,
    skills: [tskill('FastAPI', 4), tskill('Python', 3), tskill('SQL', 4), tskill('AWS', 3), tskill('Docker', 3)],
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

// ---------------------------------------------------------------- 점수 (§5)

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

function recommend(talent: Talent): RecommendationsResponse {
  const excluded = { closed: 0, category: 0, region: 0 }
  const scored: (Omit<RecommendationItem, 'rank' | 'explanation'> & { requiredPart: number })[] = []
  for (const p of PROJECTS) {
    if (p.status !== 'open') { excluded.closed++; continue }
    if (p.category !== talent.desired_category) { excluded.category++; continue }
    if (p.work_mode !== '재택' && !talent.desired_regions.includes(p.region)) { excluded.region++; continue }
    const s = scoreProject(talent, p)
    scored.push({
      project: {
        id: p.id, title: p.title, company_name: p.company_name, region: p.region,
        work_mode: p.work_mode, pay_monthly: p.pay_monthly, category: p.category, job_family: p.job_family,
      },
      score: s.score, matched: s.matched, gaps: s.gaps, requiredPart: s.requiredPart,
    })
  }
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

// ---------------------------------------------------------------- 시뮬레이션 (§7)

function takeHome(pay: number): number {
  return roundHalf(pay * (1 - DEDUCTION_RATE))
}

function rentOf(place: string, talent: Talent): { value: number | null; note: Note; fallback: boolean } {
  const note = RENT[place]
  const fallback = talent.housing_pref !== null && talent.housing_pref !== '원룸'
  return { value: note?.value ?? null, note: note ?? { value: null, source: '확인 전', is_assumption: true }, fallback }
}

interface Fare { wonOneWay: number | null; estimated: boolean; note: Note }

function fareBetween(a: string, b: string): Fare {
  const norm = (x: string) => (SEOUL_DISTRICTS.includes(x) ? '서울' : x)
  const from = norm(a)
  const to = norm(b)
  const empty: Note = { value: null, source: '확인 전', is_assumption: true }
  if (from === to) return { wonOneWay: 0, estimated: false, note: empty }
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
        : transportCost(place, p.region, place === p.region ? 0 : trips)
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
    const relocate = buildScenario(talent, {
      key: 'relocate', label: p.region === '광주' ? '광주에서 새로 자취' : `${p.region}로 이사`,
      residence: p.region, pay: p.pay_monthly, payNote: localPay,
      rent: p.housing_support ? 0 : r.value, rentNote: r.note, rentFallback: r.fallback,
      transport: 0, fixed, highlight: talent.move_willingness === '이사 가능',
    })
    const home = rentOf('광주', talent)
    const commuteCost = p.commute_support || p.region === '광주'
      ? { cost: 0, fare: fareBetween('광주', '광주') }
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

  // 서울 비교 (§7.5)
  let candidates = SEOUL_POSTS.filter(s => s.job_family === p.job_family).sort((a, b) => a.id - b.id)
  if (candidates.length > 1) {
    const sameMode = candidates.filter(s => s.work_mode === p.work_mode)
    if (sameMode.length > 0) candidates = sameMode
    const sameGrade = candidates.filter(s => s.pay_grade === p.pay_grade)
    if (sameGrade.length > 0) candidates = sameGrade
  }
  const familyMean = candidates.length > 0 ? roundHalf(mean(candidates.map(c => c.pay_monthly))) : p.pay_monthly
  const seoulPayNote = (basis: PayBasis): SourceNote => ({
    item: '보수(월 단가)',
    source: basis === 'same_pay_assumed' ? '동일 단가 가정' : `가상 공고 · ${DEMO_NOTE}`,
    is_assumption: true,
  })

  const payCompare: PayCompareRow[] = []
  for (const district of SEOUL_DISTRICTS) {
    const posting = candidates.find(c => c.district === district)
    const basis: PayBasis = posting ? 'district_posting' : candidates.length > 0 ? 'family_mean' : 'same_pay_assumed'
    const pay = posting ? posting.pay_monthly : familyMean
    const r = rentOf(district, talent)
    built.push(buildScenario(talent, {
      key: `seoul_${district}`, label: `서울 ${district}`, residence: district,
      pay, payNote: seoulPayNote(basis), payBasis: basis,
      rent: r.value, rentNote: r.note, rentFallback: r.fallback, transport: 0, fixed,
    }))
    const diff = pay - p.pay_monthly
    payCompare.push({
      district, seoul_pay: pay, diff,
      ratio_pct: Math.trunc(diff / p.pay_monthly * 100 + 0.5),
      take_home_diff: takeHome(pay) - takeHome(p.pay_monthly),
    })
  }
  const ktxPay = candidates.length > 0 ? familyMean : p.pay_monthly
  const ktxBasis: PayBasis = candidates.length > 0 ? 'family_mean' : 'same_pay_assumed'
  const home = rentOf('광주', talent)
  const ktx = transportCost('광주', '강남구', trips)
  built.push(buildScenario(talent, {
    key: 'seoul_ktx', label: '광주 거주 + KTX 통근 (참고)', residence: '광주',
    pay: ktxPay, payNote: seoulPayNote(ktxBasis), payBasis: ktxBasis,
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
    scenarios, unavailable, pay_compare: payCompare,
    peers: candidates.map<BenchmarkPeer>(c => ({
      id: c.id, district: c.district, title: c.title, pay_monthly: c.pay_monthly, pay_grade: c.pay_grade,
      work_mode: c.work_mode, job_family_match: true, grade_match: c.pay_grade === p.pay_grade,
      work_mode_match: c.work_mode === p.work_mode,
      shared_skills: c.skills.map(s => s.skill).filter(name => p.skills.some(ps => ps.skill === name)),
    })),
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
      '서울 공고는 가상 공고입니다.',
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

// ---------------------------------------------------------------- 입력 검증 (§R1)

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

function route(method: string, path: string, query: URLSearchParams, body: unknown): unknown {
  if (method === 'GET' && path === '/api/health') return { ok: true, ai_mode: 'mock' }
  if (!path.startsWith('/api/team')) throw new ApiError(404, `데모 API에 없는 경로: ${path}`)
  const p = path.slice('/api/team'.length)
  let m: RegExpMatchArray | null

  if (method === 'GET' && p === '/meta') return META
  if (method === 'POST' && p === '/seed') return { created: 0, skipped: TALENTS.length + PROJECTS.length }

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
      .map(x => ({ ...x }))
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
