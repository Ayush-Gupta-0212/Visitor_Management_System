import { Camera, ImageUp, RefreshCw, Sparkles, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { createMonogram, fileToPhotoDataUrl, toPhotoDataUrl } from '@/lib/photo'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable'

interface PhotoCaptureProps {
  value: string | null
  onChange: (photo: string | null) => void
  /** Used for the mock photo's initials and the captured image's alt text. */
  visitorName: string
  error?: string
  /** id for the error message, referenced by the form. */
  messageId: string
}

/**
 * Mandatory desk photo. Tries the webcam first; if permission is denied or there is
 * no camera, upload and mock-photo fallbacks stay available. The stream stops as
 * soon as a frame is captured or the dialog closes, so the camera light goes off.
 */
export function PhotoCapture({ value, onChange, visitorName, error, messageId }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [camera, setCamera] = useState<CameraState>('idle')

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  // Release the camera when the dialog unmounts this component.
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable')
      toast.warning('Camera unavailable: Using Fallback', {
        description: 'This browser or connection cannot open a camera. Upload a photo or use a mock photo.',
      })
      return
    }
    setCamera('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamera('live')
    } catch (cause) {
      stopStream()
      setCamera('unavailable')
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
      toast.warning(denied ? 'Camera Permission Denied: Using Fallback' : 'No camera found: Using Fallback', {
        description: 'Upload a photo or use a mock photo instead.',
      })
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    onChange(toPhotoDataUrl(video, video.videoWidth, video.videoHeight))
    stopStream()
    setCamera('idle')
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      onChange(await fileToPhotoDataUrl(file))
    } catch (cause) {
      toast.error("Couldn't use that image", { description: cause instanceof Error ? cause.message : undefined })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const live = camera === 'live'

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden rounded-lg border bg-muted',
          error ? 'border-danger' : 'border-border',
        )}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className={cn('size-full -scale-x-100 object-cover', live ? 'block' : 'hidden')}
        />
        {!live && value && (
          <img src={value} alt={`Photo of ${visitorName || 'the visitor'}`} className="size-full animate-fade-in object-cover" />
        )}
        {!live && !value && (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
            {camera === 'unavailable' ? (
              <VideoOff className="size-6 text-muted-foreground" aria-hidden />
            ) : (
              <Camera className="size-6 text-muted-foreground" aria-hidden />
            )}
            <p className="text-body-md font-medium text-foreground">
              {camera === 'unavailable' ? 'Camera unavailable' : 'No photo yet'}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {camera === 'unavailable' ? 'Upload a photo or use a mock photo.' : 'A photo is mandatory for every walk-in.'}
            </p>
          </div>
        )}
        {live && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded bg-primary/80 px-2 py-0.5 font-mono text-mono-code text-primary-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-danger-dot" aria-hidden />
            LIVE
          </span>
        )}
        {!live && value && (
          <Badge variant="success" className="absolute top-2 left-2">
            Captured
          </Badge>
        )}
      </div>

      {live ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={capture}>
            <Camera /> Capture photo
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              stopStream()
              setCamera('idle')
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant={value ? 'outline' : 'primary'}
          onClick={() => void startCamera()}
          disabled={camera === 'starting'}
        >
          {value ? <RefreshCw /> : <Camera />}
          {camera === 'starting' ? 'Starting camera…' : value ? 'Retake with camera' : 'Start camera'}
        </Button>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
          <ImageUp /> Upload
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onChange(createMonogram(visitorName || 'Walk-in Visitor'))}>
          <Sparkles /> Use mock photo
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <p id={messageId} className={cn('text-body-sm', error ? 'text-danger-strong' : 'text-muted-foreground')}>
        {error ?? 'Resized to 320 px and stored only in this browser.'}
      </p>
    </div>
  )
}
