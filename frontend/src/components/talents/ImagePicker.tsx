// 사진 올리기 (최대 3장, 첫 장이 대표 사진). 브라우저에서 줄여 JPEG로 바꾼 뒤 보낸다.

import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { errorMessage } from '@/lib/api'
import { imageFileToDataUrl } from '@/lib/talents'

interface ImagePickerProps {
  images: string[]
  onChange: (next: string[]) => void
  max: number
}

export function ImagePicker({ images, onChange, max }: ImagePickerProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError('')
    try {
      const room = max - images.length
      const converted: string[] = []
      for (const file of Array.from(files).slice(0, room)) converted.push(await imageFileToDataUrl(file))
      onChange([...images, ...converted])
      if (files.length > room) setError(`사진은 ${max}장까지 올릴 수 있습니다.`)
    } catch (e) {
      setError(errorMessage(e, '사진을 올리지 못했습니다.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((src, index) => (
          <figure key={`${index}-${src.length}`} className="relative size-24 overflow-hidden rounded-lg border">
            <img src={src} alt={index === 0 ? '대표 사진' : `사진 ${index + 1}`} className="size-full object-cover" />
            {index === 0 && (
              <figcaption className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">대표</figcaption>
            )}
            <button
              type="button" aria-label={`사진 ${index + 1} 빼기`} onClick={() => onChange(images.filter((_, i) => i !== index))}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
            >
              <X className="size-3" />
            </button>
          </figure>
        ))}
        {images.length < max && (
          <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            사진 추가
            <input
              type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy}
              onChange={e => { void pick(e.target.files); e.target.value = '' }}
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        첫 장이 기업 목록의 대표 사진이 됩니다. 최대 {max}장, 올릴 때 자동으로 줄입니다.
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
