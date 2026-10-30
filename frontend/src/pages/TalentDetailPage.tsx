// 기업용: 인재 PR 상세. 만든 브라우저에서만 [고치기]·[지우기]가 보인다.

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'

import { ErrorBanner } from '@/components/common'
import { PhotoTile } from '@/components/talents/TalentCard'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { href, navigate } from '@/lib/router'
import { availableText, careerText, deleteTalent, forgetOwnedPr, ownedPr } from '@/lib/talents'
import { useTalent } from '@/lib/useTalents'

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

  return (
    <>
      <Button asChild variant="outline" size="sm">
        <a href={href.talents}><ArrowLeft /> 인재 목록</a>
      </Button>

      {loading && <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p>}
      {error && (
        <ErrorBanner>
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retry}>다시 시도</Button>
        </ErrorBanner>
      )}

      {data && (
        <article aria-labelledby="talent-title" className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row">
            <PhotoTile talent={data} className="size-32 shrink-0 rounded-xl text-2xl sm:size-40" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-lg font-bold">{data.display_name}</span>
                <span className="rounded-full border px-2 text-xs text-muted-foreground">{data.member_type}</span>
                <span className="rounded-full border px-2 text-xs text-muted-foreground">{data.level}</span>
                {data.is_sample && <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">예시 · 가상 인물</span>}
              </p>
              <h1 id="talent-title" className="mt-2 text-xl font-bold leading-snug">{data.headline}</h1>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{careerText(data.career_years)}</span>
                <span aria-hidden className="mx-2 text-border">|</span>
                <span className="font-semibold text-primary">{data.project_count}개 프로젝트 참여</span>
              </p>
            </div>
          </div>

          {data.intro && (
            <Section title="자기 PR">
              <p className="whitespace-pre-wrap text-sm leading-7">{data.intro}</p>
            </Section>
          )}

          <Section title="기술">
            {data.skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">쓴 기술이 없습니다.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {data.skills.map(skill => (
                  <li key={skill} className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] text-accent-foreground">{skill}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="희망 조건">
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <Item label="근무 형태">{data.work_modes.join(', ')}</Item>
              <Item label="근무 지역">{data.regions.join(', ') || '무관'}</Item>
              <Item label="시작 가능">{availableText(data.available_from)}</Item>
            </dl>
          </Section>

          {/* 대표 사진은 위에 있으므로 2장 이상일 때만 모아 보여 준다 */}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t pt-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
