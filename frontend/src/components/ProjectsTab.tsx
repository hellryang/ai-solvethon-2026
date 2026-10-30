import { useEffect, useState } from 'react'
import { Building2, Loader2, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorBanner, Field, NativeSelect } from '@/components/common'
import { api, errorMessage, TEAM } from '@/lib/api'
import { won } from '@/lib/format'
import type { Meta, Project, ProjectListItem } from '@/types'

function payGradeLabel(meta: Meta, key: string): string {
  return meta.pay_grades.find(g => g.key === key)?.label ?? key
}

function workCondition(p: Project): string {
  if (p.work_mode === '재택') return `재택 · 월 대면 미팅 ${p.meeting_per_month ?? 0}회`
  return `${p.work_mode} · 주 ${p.onsite_days_per_week ?? '-'}일 출근`
}

function ProjectDetail({ meta, id, onClose }: { meta: Meta; id: number | null; onClose: () => void }) {
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id === null) return
    let ignore = false
    api<Project>(`${TEAM}/projects/${id}`)
      .then(data => { if (!ignore) { setProject(data); setError('') } })
      .catch((e: unknown) => { if (!ignore) setError(errorMessage(e, '상세를 불러오지 못했습니다.')) })
    return () => { ignore = true; setProject(null); setError('') }
  }, [id])

  return (
    <Dialog open={id !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project?.title ?? '프로젝트 상세'}</DialogTitle>
          <DialogDescription>
            {project ? `${project.company_name} · ${project.region} ${project.district}` : '불러오는 중...'}
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {!project && !error && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        {project && (
          <div className="space-y-5">
            <p className="whitespace-pre-wrap text-sm leading-6">{project.description}</p>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">근무 조건</h3>
              <ul className="space-y-1 text-sm">
                <li>월 단가: <strong>{won(project.pay_monthly)}만 원</strong> ({payGradeLabel(meta, project.pay_grade)})</li>
                <li>근무 형태: {workCondition(project)}</li>
                <li>기간: {project.start_date} ~ {project.end_date}</li>
                <li>직무군: {project.category} · {project.job_family}</li>
                <li>
                  기업: {project.org_type} · {project.industry}
                  {project.style_tags.length > 0 && ` · ${project.style_tags.join(', ')} (특성 태그는 가정값)`}
                </li>
                <li>
                  지원: 숙소 {project.housing_support ? '제공' : '미제공'} · 교통비 {project.commute_support ? '지원' : '미지원'}
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">요구 기술</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>기술</TableHead>
                    <TableHead>최소 숙련도</TableHead>
                    <TableHead>구분</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.skills.map(s => (
                    <TableRow key={s.skill}>
                      <TableCell>{s.skill}</TableCell>
                      <TableCell>{s.min_level} / 5</TableCell>
                      <TableCell>
                        <Badge variant={s.is_required ? 'default' : 'outline'}>{s.is_required ? '필수' : '우대'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">필요 역할</h3>
              {project.roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">역할 정보 없음</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {project.roles.map(r => (
                    <li key={r.role_name}>
                      <strong>{r.role_name}</strong> {r.headcount}명
                      <span className="text-muted-foreground"> · {r.skills.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ProjectsTab({ meta }: { meta: Meta }) {
  const [region, setRegion] = useState('')
  const [category, setCategory] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)

  useEffect(() => {
    let ignore = false
    const query = new URLSearchParams()
    if (region) query.set('region', region)
    if (category) query.set('category', category)
    if (workMode) query.set('work_mode', workMode)
    setLoading(true)
    api<ProjectListItem[]>(`${TEAM}/projects?${query.toString()}`)
      .then(data => { if (!ignore) { setProjects(data); setError('') } })
      .catch((e: unknown) => { if (!ignore) setError(errorMessage(e, '프로젝트를 불러오지 못했습니다.')) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [region, category, workMode])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>광주·나주·광양 기업 프로젝트</CardTitle>
          <CardDescription>
            광주 AI 인재와 매칭되는 프로젝트입니다. 서울 공고는 비교 전용이라 여기에 나오지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="filter-region" label="지역">
              <NativeSelect id="filter-region" value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">전체</option>
                {meta.regions.map(r => <option key={r} value={r}>{r}</option>)}
              </NativeSelect>
            </Field>
            <Field id="filter-category" label="분류">
              <NativeSelect id="filter-category" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">전체</option>
                {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </Field>
            <Field id="filter-mode" label="근무 형태">
              <NativeSelect id="filter-mode" value={workMode} onChange={e => setWorkMode(e.target.value)}>
                <option value="">전체</option>
                {meta.work_modes.map(m => <option key={m} value={m}>{m}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {projects === null ? (
        loading ? <p className="text-sm text-muted-foreground">불러오는 중...</p> : null
      ) : projects.length === 0 ? (
        <EmptyState>조건에 맞는 프로젝트가 없습니다. 필터를 바꿔 보세요.</EmptyState>
      ) : (
        <div className={'grid gap-3 md:grid-cols-2 ' + (loading ? 'opacity-60' : '')}>
          {projects.map(p => (
            <Card key={p.id} size="sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {p.title}
                  {p.status === 'closed' && <Badge variant="destructive">마감</Badge>}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" />{p.company_name}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{p.region} {p.district}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{p.work_mode}</Badge>
                  <Badge variant="outline">{p.category}</Badge>
                  <Badge variant="outline">{p.job_family}</Badge>
                  <Badge variant="outline">{p.org_type}</Badge>
                  <Badge variant="outline">{p.industry}</Badge>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-lg font-bold">
                    월 {won(p.pay_monthly)}<span className="text-sm font-normal text-muted-foreground">만 원</span>
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDetailId(p.id)}>상세 보기</Button>
                </div>
                <p className="text-xs text-muted-foreground">{p.start_date} ~ {p.end_date}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectDetail meta={meta} id={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
