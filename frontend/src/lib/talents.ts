// 인재 PR API(backend/app/team/talent_pr_routes.py)와 사진 처리.
// 로그인이 없으므로, PR을 만든 브라우저가 편집 토큰을 보관해 두었다가 고치거나 지울 때 보낸다.

import type { PrSort, TalentPR, TalentPRCreated, TalentPRInput, TalentPRList } from '@/types'
import { api, postJson, TEAM } from './api'

const PR = `${TEAM}/pr`
const TOKEN_KEY = 'kiroro.prTokens'

export const MEMBER_TYPES = ['개인', '팀'] as const
export const PR_WORK_MODES = ['상주', '재택'] as const
export const PR_LEVELS = ['초급', '중급', '고급'] as const
export const PR_REGIONS = ['광주', '나주', '광양', '전남 기타'] as const
export const MAX_PR_IMAGES = 3
export const MAX_PR_SKILLS = 12
export const SORT_LABELS: Record<PrSort, string> = {
  career: '경력 순', projects: '프로젝트 참여 순', recent: '최신 등록 순',
}

export function careerText(years: number): string {
  return years === 0 ? '신입' : `${years}년 경력`
}

/** "2026-11-16" → "11월 16일부터" (시간대 변환 없이 글자로만 나눈다) */
export function availableText(date: string | null): string {
  if (!date) return '시작일 협의'
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일부터`
}

export interface TalentFilters {
  q: string
  member_type: string
  work_mode: string
  level: string
  region: string
  sort: PrSort
}

export const EMPTY_FILTERS: TalentFilters = {
  q: '', member_type: '', work_mode: '', level: '', region: '', sort: 'career',
}

export function listTalents(filters: TalentFilters): Promise<TalentPRList> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) params.set(key, value.trim())
  }
  return api<TalentPRList>(`${PR}?${params.toString()}`)
}

export function getTalent(id: number): Promise<TalentPR> {
  return api<TalentPR>(`${PR}/${id}`)
}

export function createTalent(input: TalentPRInput): Promise<TalentPRCreated> {
  return postJson<TalentPRCreated>(PR, input)
}

export function updateTalent(id: number, token: string, input: TalentPRInput): Promise<TalentPR> {
  return api<TalentPR>(`${PR}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Edit-Token': token },
    body: JSON.stringify(input),
  })
}

export function deleteTalent(id: number, token: string): Promise<null> {
  return api<null>(`${PR}/${id}`, { method: 'DELETE', headers: { 'X-Edit-Token': token } })
}

// ---- 내가 만든 PR: 편집 토큰과 실제 이름(서버는 가린 이름만 돌려준다)을 이 브라우저에 둔다.
// 탭을 닫아도 남도록 localStorage. 서버를 다시 켜면 PR과 함께 의미가 없어진다 ----

export interface OwnedPr {
  token: string
  name: string
}

function readOwned(): Record<string, OwnedPr> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, OwnedPr>) : {}
  } catch {
    return {}
  }
}

export function ownedPr(id: number): OwnedPr | null {
  const owned = readOwned()[String(id)]
  return owned && typeof owned.token === 'string' && typeof owned.name === 'string' ? owned : null
}

export function saveOwnedPr(id: number, owned: OwnedPr): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...readOwned(), [String(id)]: owned }))
  } catch {
    // 저장하지 못하면 이 PR은 나중에 고칠 수 없다. 만들기 자체는 성공했으므로 막지 않는다
  }
}

export function forgetOwnedPr(id: number): void {
  try {
    const rest = Object.fromEntries(Object.entries(readOwned()).filter(([key]) => key !== String(id)))
    localStorage.setItem(TOKEN_KEY, JSON.stringify(rest))
  } catch {
    // 지우지 못해도 서버에서 이미 삭제됐으므로 문제없다
  }
}

// ---- 사진: 브라우저에서 줄여 JPEG data URL로 만든다 (서버 한도 장당 300KB) ----

const MAX_IMAGE_CHARS = 380_000 // base64 길이. 디코딩하면 약 285KB
const SIDES = [1280, 960, 720, 540]

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 사진은 열 수 없습니다. JPG나 PNG로 올려 주세요.')) }
    image.src = url
  })
}

function draw(image: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이 브라우저에서는 사진을 줄일 수 없습니다.')
  context.fillStyle = '#FFFFFF' // 투명 PNG도 JPEG로 바꿀 때 검게 나오지 않게
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** 사진 파일 → 서버 한도 안의 JPEG data URL. 크기를 단계적으로 줄인다 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있습니다.')
  const image = await loadImage(file)
  for (const side of SIDES) {
    const dataUrl = draw(image, side, 0.82)
    if (dataUrl.length <= MAX_IMAGE_CHARS) return dataUrl
  }
  throw new Error('사진이 너무 큽니다. 다른 사진을 골라 주세요.')
}

/** 이미 올린 사진(URL)을 다시 보낼 수 있게 data URL로 바꾼다 (PUT은 사진 목록 전체를 바꾼다) */
export async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('기존 사진을 불러오지 못했습니다.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('기존 사진을 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}
