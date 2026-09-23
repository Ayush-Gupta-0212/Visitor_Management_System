import { Camera, ImageUp, Keyboard, LoaderCircle, ScanLine, VideoOff } from 'lucide-react'
import { type DragEvent, type FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { tokenFromText } from '@/lib/passLink'
import { decodeQr } from '@/lib/qr'
import { cn } from '@/lib/utils'

type Mode = 'camera' | 'image' | 'code'

interface PassScannerProps {
  /** Called once with the pass token read from a QR code, an image or typed text. */
  onToken: (token: string) => void
  /** 'user' for a kiosk's front camera (visitors hold up their phone), 'environment' for a handheld scanner. */
  facingMode?: 'user' | 'environment'
  /** Open the camera straight away rather than waiting for a tap. */
  autoStart?: boolean
  className?: string
}

const NOT_A_PASS = "That QR code isn't a visitor pass."

/**
 * Reads an e-pass three ways: the camera (frames decoded four times a second), an
 * image of the pass such as a screenshot, or the pass code typed in. Every path ends
 * in a pass token; the caller looks it up in its own records.
 */
export function PassScanner({ onToken, facingMode = 'environment', autoStart = false, className }: PassScannerProps) {
  const [mode, setMode] = useState<Mode>('camera')

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SegmentedControl
        label="How to read the pass"
        value={mode}
        onValueChange={setMode}
        className="w-full"
        options={[
          { value: 'camera', label: <><Camera aria-hidden /> Camera</> },
          { value: 'image', label: <><ImageUp aria-hidden /> Image</> },
          { value: 'code', label: <><Keyboard aria-hidden /> Code</> },
        ]}
      />
      {mode === 'camera' && <CameraReader onToken={onToken} facingMode={facingMode} autoStart={autoStart} />}
      {mode === 'image' && <ImageReader onToken={onToken} />}
      {mode === 'code' && <CodeReader onToken={onToken} />}
    </div>
  )
}

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable'

function CameraReader({ onToken, facingMode, autoStart }: Required<Omit<PassScannerProps, 'className'>>) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onTokenRef = useRef(onToken)
  const [state, setState] = useState<CameraState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    onTokenRef.current = onToken
  })

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable')
      setMessage('This browser or connection cannot open a camera. Use an image of the pass or type its code.')
      return
    }
    setState('starting')
    setMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return stopStream()
      video.srcObject = stream
      await video.play()
      setState('live')
    } catch (cause) {
      stopStream()
      setState('unavailable')
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
      setMessage(
        denied
          ? 'Camera permission was denied. Use an image of the pass or type its code instead.'
          : 'No camera was found. Use an image of the pass or type its code instead.',
      )
    }
  }

  // Start on mount when asked; always release the camera on unmount so its light goes off.
  const startRef = useRef(start)
  useEffect(() => {
    if (autoStart) void startRef.current()
    return stopStream
  }, [autoStart])

  // While live, decode a downscaled frame every 250 ms. `busy` stops frames piling up on slow devices.
  useEffect(() => {
    if (state !== 'live') return
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    let busy = false
    let cancelled = false

    const timer = window.setInterval(() => {
      const video = videoRef.current
      if (busy || !context || !video || video.readyState < 2 || video.videoWidth === 0) return
      busy = true
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      void decodeQr(context.getImageData(0, 0, canvas.width, canvas.height))
        .then((text) => {
          if (cancelled || !text) return
          const token = tokenFromText(text)
          if (!token) return setMessage(NOT_A_PASS)
          cancelled = true
          stopStream()
          setState('idle')
          onTokenRef.current(token)
        })
        .finally(() => {
          busy = false
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state])

  const live = state === 'live'

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className={cn('size-full object-cover', facingMode === 'user' && '-scale-x-100', live ? 'block' : 'hidden')}
        />
        {live ? (
          <div aria-hidden className="pointer-events-none absolute inset-[12%]">
            <span className="absolute top-0 left-0 size-8 rounded-tl-lg border-t-4 border-l-4 border-white/90" />
            <span className="absolute top-0 right-0 size-8 rounded-tr-lg border-t-4 border-r-4 border-white/90" />
            <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-4 border-l-4 border-white/90" />
            <span className="absolute right-0 bottom-0 size-8 rounded-br-lg border-r-4 border-b-4 border-white/90" />
            <span className="absolute inset-x-2 h-0.5 animate-scan rounded-full bg-success-dot shadow-[0_0_12px_2px] shadow-success-dot/60" />
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'unavailable' ? (
              <VideoOff className="size-7 text-muted-foreground" aria-hidden />
            ) : state === 'starting' ? (
              <LoaderCircle className="size-7 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <ScanLine className="size-7 text-muted-foreground" aria-hidden />
            )}
            <p className="max-w-64 text-body-md text-muted-foreground">
              {state === 'starting' ? 'Opening the camera…' : state === 'unavailable' ? 'Camera unavailable' : 'Hold the QR code on the pass up to the camera.'}
            </p>
            {state !== 'starting' && (
              <Button onClick={() => void start()}>
                <Camera /> {state === 'unavailable' ? 'Try the camera again' : 'Start camera'}
              </Button>
            )}
          </div>
        )}
      </div>
      <p role="status" className={cn('min-h-4.5 text-body-sm', message ? 'text-warning-strong' : 'text-muted-foreground')}>
        {message ?? (live ? 'Scanning… hold the code steady inside the frame.' : '')}
      </p>
      {live && (
        <Button
          variant="outline"
          onClick={() => {
            stopStream()
            setState('idle')
          }}
        >
          Stop camera
        </Button>
      )}
    </div>
  )
}

/** Draws an image file onto a canvas, at least 2x for small images such as the 320 px pass SVG, and decodes it. */
async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const width = image.naturalWidth || 320
    const height = image.naturalHeight || 520
    const scale = Math.min(2, 1600 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await decodeQr(context.getImageData(0, 0, canvas.width, canvas.height))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function ImageReader({ onToken }: { onToken: (token: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const read = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose an image file: a screenshot, photo or the downloaded pass.')
    setBusy(true)
    setError(null)
    try {
      const text = await decodeImageFile(file)
      const token = text ? tokenFromText(text) : null
      if (token) onToken(token)
      else setError(text ? NOT_A_PASS : 'No QR code found in that image. Try a sharper screenshot of the pass.')
    } catch {
      setError("Couldn't open that image. Try a PNG, JPG or the downloaded SVG pass.")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void read(event.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={busy}
        className={cn(
          'flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
          dragging ? 'border-success bg-success-subtle' : 'border-border bg-muted hover:border-border-strong',
        )}
      >
        {busy ? <LoaderCircle className="size-7 animate-spin text-muted-foreground" aria-hidden /> : <ImageUp className="size-7 text-muted-foreground" aria-hidden />}
        <span className="text-body-md font-medium text-foreground">{busy ? 'Reading the pass…' : 'Choose or drop an image of the pass'}</span>
        <span className="max-w-64 text-body-sm text-muted-foreground">A screenshot from the visitor's phone or the downloaded pass file works.</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => void read(event.target.files?.[0])}
      />
      <p role="status" className="min-h-4.5 text-body-sm text-danger-strong">
        {error}
      </p>
    </div>
  )
}

function CodeReader({ onToken }: { onToken: (token: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const token = tokenFromText(value)
    if (!token) return setError('Enter the full pass code (36 characters) or paste the pass link.')
    setValue('')
    onToken(token)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="pass-code" className="text-label-md text-foreground">
        Pass code or link
      </label>
      <Input
        id="pass-code"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        placeholder="e.g. 3f9a21c0-5b7e-4c1d-9a2f-…"
        aria-invalid={error ? true : undefined}
        aria-describedby="pass-code-message"
        className="font-mono text-mono-code"
      />
      <p id="pass-code-message" className={cn('text-body-sm', error ? 'text-danger-strong' : 'text-muted-foreground')}>
        {error ?? 'Use "Copy pass code" or "Copy pass link" on the pass, then paste it here.'}
      </p>
      <Button type="submit" disabled={!value.trim()}>
        Find pass
      </Button>
    </form>
  )
}
