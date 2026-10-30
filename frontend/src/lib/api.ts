// 모든 API 호출은 상대 경로 /api/ 만 쓴다 (R12.6).
// `vite --mode demo`로 띄울 때만 백엔드 대신 src/lib/demo.ts의 데모 응답을 쓴다.
// 운영 빌드에서는 이 분기가 상수로 접혀 데모 코드가 포함되지 않는다.

export class ApiError extends Error {
  status: number
  /** 422일 때 항목 이름(body 바로 아래 필드) → 메시지 */
  fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

function parseDetail(status: number, body: unknown): ApiError {
  let message = `HTTP ${status}`
  const fieldErrors: Record<string, string> = {}
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      for (const item of detail) {
        if (!item || typeof item !== 'object') continue
        const { loc, msg } = item as { loc?: unknown; msg?: unknown }
        if (typeof msg !== 'string') continue
        const path = Array.isArray(loc) ? loc.filter(part => part !== 'body') : []
        const field = path.length > 0 ? String(path[0]) : '_'
        if (!(field in fieldErrors)) fieldErrors[field] = msg
      }
      message = status === 422 ? '입력값을 확인하세요.' : message
    }
  }
  return new ApiError(status, message, fieldErrors)
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  if (import.meta.env.MODE === 'demo') {
    const { demoFetch } = await import('./demo')
    return demoFetch<T>(url, init)
  }

  const response = await fetch(url, init)
  const body: unknown = response.status === 204
    ? null
    : await response.json().catch(() => null)
  if (!response.ok) throw parseDetail(response.status, body)
  return body as T
}

export function postJson<T>(url: string, data?: unknown): Promise<T> {
  return api<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
}

export function putJson<T>(url: string, data: unknown): Promise<T> {
  return api<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const TEAM = '/api/team'
