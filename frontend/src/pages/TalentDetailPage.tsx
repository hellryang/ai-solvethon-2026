// 기업용: 인재 PR 상세. 2열 — 왼쪽 자기 PR·기술·대표 프로젝트 / 오른쪽 경력·프로젝트 숫자와 희망 조건.
// 만든 브라우저에서만 [고치기]·[지우기]가 보인다.
// 대표 프로젝트는 예시(가상) 인물에만 화면에 적어 둔 시연용 데이터다. 서버 데이터는 바꾸지 않는다.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'

import { ErrorBanner } from '@/components/common'
import { PhotoTile } from '@/components/talents/TalentCard'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import { availableText, deleteTalent, forgetOwnedPr, ownedPr } from '@/lib/talents'
import { useTalent } from '@/lib/useTalents'

interface SampleProject {
  title: string
  period: string
  role: string
  team: string
  summary: string
  skills: string[]
}

/** 예시 인물별 대표 프로젝트 (가상). 키는 가린 이름 */
const SAMPLE_PROJECTS: Record<string, SampleProject[]> = {
  '최**': [
    { title: '지역 전력 수요 예측 모델 고도화', period: '2025.03 – 2025.10', role: '데이터 분석', team: '4명',
      summary: '시간대별 전력 사용량으로 다음 날 수요를 예측하는 모델을 만들고, 계절 요인을 넣어 예측 오차를 줄였어요.', skills: ['Python', '시계열 예측'] },
    { title: '사업장별 에너지 사용량 대시보드', period: '2024.06 – 2024.12', role: '시각화 담당', team: '3명',
      summary: '흩어진 사용량 데이터를 SQL로 모아 한 화면에서 사업장끼리 비교하는 대시보드를 만들었어요.', skills: ['SQL', 'Tableau'] },
    { title: '주간 보고 데이터 정제 자동화', period: '2023.09 – 2023.11', role: '개인', team: '1명',
      summary: '매주 손으로 하던 데이터 정리를 Python 스크립트로 바꿔 보고서 준비 시간을 줄였어요.', skills: ['Python', '데이터 분석'] },
  ],
  '박**': [
    { title: '공공기관 홈페이지 유지보수', period: '2024.01 – 2025.12', role: '백엔드 개발', team: '5명',
      summary: '게시판·민원 신청 기능을 고치고, 웹 접근성 점검 결과를 화면에 반영했어요.', skills: ['전자정부 표준프레임워크', 'Java', 'JSP'] },
    { title: '지자체 시설 예약 시스템 기능 추가', period: '2024.05 – 2024.08', role: '백엔드 개발', team: '3명',
      summary: '예약 조회 화면을 추가하고 Oracle 쿼리를 손봐 조회 속도를 개선했어요.', skills: ['Oracle', 'jQuery'] },
  ],
  '한**': [
    { title: '시민 민원 신청 화면 개편', period: '2025.02 – 2025.07', role: '화면 설계 · 구현', team: '3명',
      summary: '사용자 인터뷰로 불편한 단계를 찾고, 피그마로 흐름을 다시 설계해 React로 구현했어요.', skills: ['Figma', 'React', 'TypeScript'] },
    { title: '지역 축제 안내 웹', period: '2024.08 – 2024.10', role: '개인', team: '1명',
      summary: '휴대폰에서도 잘 보이는 반응형 축제 안내 페이지를 만들었어요.', skills: ['HTML/CSS', 'UI/UX 디자인'] },
  ],
  '김**': [
    { title: '설비 진동 센서 데이터 수집 장치', period: '2025.03 – 2025.09', role: '펌웨어 개발', team: '4명',
      summary: 'C로 진동 센서 값을 읽어 서버로 보내는 수집 장치를 만들고, 현장에서 끊김 없이 돌아가게 안정화했어요.', skills: ['C', '임베디드', 'IoT 센서'] },
    { title: 'PLC 설비 상태 모니터링', period: '2024.07 – 2024.11', role: '데이터 수집 · 알림', team: '3명',
      summary: 'PLC 데이터를 Python으로 모아 이상 값이 나오면 담당자에게 알림이 가도록 했어요.', skills: ['PLC', 'Python'] },
  ],
  '이**': [
    { title: '학사관리 웹 서비스', period: '2025.03 – 2025.06', role: '백엔드 개발', team: '4명',
      summary: '수강신청·성적 조회 기능을 Spring과 MySQL로 만들고, Git으로 팀원과 코드를 나눠 관리했어요.', skills: ['Java', 'Spring', 'MySQL', 'Git'] },
    { title: '도서 대여 관리 프로그램', period: '2024.09 – 2024.12', role: '개인', team: '1명',
      summary: 'JSP로 도서 검색·대여·반납 화면을 만든 첫 웹 프로젝트예요.', skills: ['JSP', 'Java'] },
  ],
  '정**': [
    { title: '학교 규정 LLM 상담 챗봇', period: '2025.04 – 2025.08', role: '4인 팀 (AI·백엔드·프론트)', team: '4명',
      summary: '학교 규정 문서를 찾아 근거와 함께 답하는 RAG 챗봇을 FastAPI와 React로 만들었어요.', skills: ['RAG', '생성형 AI', 'FastAPI', 'React'] },
    { title: '해커톤 민원 자동 분류 AI', period: '2024.11', role: '4인 팀', team: '4명',
      summary: '민원 글을 생성형 AI로 읽어 담당 부서를 자동으로 추천하는 서비스를 이틀 만에 만들었어요.', skills: ['Python', '생성형 AI'] },
  ],
}

export function TalentDetailPage({ talentId }: { talentId: number }) {
  const { data, loading, error, retry } = useTalent(talentId)
  const owned = ownedPr(talentId)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function remove() {
    if (!owned) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteTalent(talentId, owned.token)
      forgetOwnedPr(talentId)
      navigate(href.talents)
    } catch (e) {
      setDeleteError(errorMessage(e, 'PR을 지우지 못했습니다.'))
    } finally {
      setDeleting(false)
    }
  }

  const projects = data?.is_sample ? SAMPLE_PROJECTS[data.display_name] ?? [] : []
  const years = Number(data?.career_years) || 0

  return (
    <>
      <a href={href.talents} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 인재 목록
      </a>

      {loading && <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p>}
      {error && (
        <ErrorBanner>
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>다시 시도</Button>
        </ErrorBanner>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* 왼쪽: 소개·기술·프로젝트 */}
          <article aria-labelledby="talent-title" className="min-w-0 space-y-7">
            <header className="flex items-center gap-4">
              <PhotoTile talent={data} className="size-[72px] shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span className="text-[17px] font-bold">{data.display_name}</span>
                  <span className="rounded-full border border-[#E6E6E6] px-2 text-[11px] text-[#9A9A9A]">{data.member_type}</span>
                  <span className="rounded-full border border-[#E6E6E6] px-2 text-[11px] text-[#9A9A9A]">{data.level}</span>
                  {data.is_sample && <span className="rounded-full border border-[#E6E6E6] px-2 text-[11px] text-[#9A9A9A]">예시 · 가상 인물</span>}
                </p>
                <h1 id="talent-title" className="mt-1.5 text-[24px] leading-snug font-extrabold tracking-tight">{data.headline}</h1>
              </div>
            </header>

            {data.intro && (
              <Section title="자기 PR">
                <p className="whitespace-pre-wrap text-[15px] leading-7">{data.intro}</p>
              </Section>
            )}

            <Section title="기술">
              {data.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">쓴 기술이 없습니다.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {data.skills.map(skill => (
                    <li key={skill} className="rounded-full bg-[#F4F4F4] px-3 py-1 text-[13px] text-[#555555]">{skill}</li>
                  ))}
                </ul>
              )}
            </Section>

            {projects.length > 0 && (
              <Section title="대표 프로젝트" note="예시 · 가상 프로젝트">
                <ol className="space-y-3">
                  {projects.map(project => (
                    <li key={project.title} className="rounded-[14px] border border-[#ECECEC] p-4 md:p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="text-[16px] font-bold">{project.title}</h3>
                        <span className="text-[13px] text-muted-foreground">{project.period}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground">{project.role} · {project.team}</p>
                      <p className="mt-2 text-[14px] leading-6">{project.summary}</p>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {project.skills.map(skill => (
                          <li key={skill} className="rounded-full border border-[#E6E6E6] px-2.5 py-0.5 text-[12px] text-[#555555]">{skill}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {data.image_urls.length > 1 && (
              <Section title="사진">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {data.image_urls.map((url, index) => (
                    <img key={url} src={url} alt={`${data.display_name} 사진 ${index + 1}`} loading="lazy"
                      className="aspect-square w-full rounded-lg border object-cover" />
                  ))}
                </div>
              </Section>
            )}
          </article>

          {/* 오른쪽: 숫자와 희망 조건 (스크롤해도 따라온다) */}
          <aside aria-label="경력과 희망 조건" className="lg:sticky lg:top-[76px] lg:self-start">
            <div className="rounded-2xl border border-[#ECECEC] bg-white p-5">
              <div className="grid grid-cols-2 gap-3">
                <BigNumber value={years > 0 ? String(years) : '신입'} unit={years > 0 ? '년' : ''} label="경력" />
                <BigNumber value={String(data.project_count)} unit="건" label="프로젝트 참여" />
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="근무 형태">{data.work_modes.join(', ')}</Row>
                <Row label="근무 지역">{data.regions.join(', ') || '무관'}</Row>
                <Row label="시작 가능">{availableText(data.available_from)}</Row>
              </dl>
            </div>
          </aside>
        </div>
      )}

      {data && owned && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {deleteError && <p role="alert" className="mr-auto text-sm text-destructive">{deleteError}</p>}
          {confirming ? (
            <>
              <span className="text-sm">정말 지울까요? 되돌릴 수 없습니다.</span>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>취소</Button>
              <Button type="button" variant="destructive" disabled={deleting} onClick={() => void remove()}>
                <Trash2 /> 지우기
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setConfirming(true)}><Trash2 /> 지우기</Button>
              <Button asChild><a href={href.talentEdit(talentId)}><Pencil /> 고치기</a></Button>
            </>
          )}
        </div>
      )}
    </>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[#ECECEC] pt-6">
      <h2 className="flex items-baseline gap-2 text-[13px] font-bold text-muted-foreground">
        {title}
        {note && <span className="text-[11px] font-normal text-[#B0B0B0]">{note}</span>}
      </h2>
      {children}
    </section>
  )
}

function BigNumber({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="rounded-xl bg-[#FAFAFA] p-3.5">
      <p className="text-[26px] leading-none font-extrabold">
        {value}<span className="ml-0.5 text-[13px] font-semibold">{unit}</span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}