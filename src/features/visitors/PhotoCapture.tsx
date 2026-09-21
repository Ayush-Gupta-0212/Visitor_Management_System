/**
 * Mandatory photo capture at registration.
 *
 * The spec makes the photograph a required part of registration, so this
 * component has to work even when the camera does not. Cameras fail constantly
 * at a real reception desk: permission denied, no device, the browser blocking
 * getUserMedia because the page is not on HTTPS, or another tab already holding
 * the stream. Every one of those paths ends at the file-upload fallback rather
 * than at a dead end, because a visitor standing at the desk cannot be told to
 * come back later.
 *
 * The captured frame is downscaled to 320px and encoded as a JPEG data URL:
 * a full-resolution PNG would be several megabytes per visitor and there is no
 * server to send it to.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/primitives';

const CAPTURE_WIDTH = 320;
const JPEG_QUALITY = 0.8;

interface PhotoCaptureProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  error?: string | null;
}

type CameraState = 'idle' | 'starting' | 'live' | 'unavailable';

export function PhotoCapture({ value, onChange, error }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<CameraState>('idle');
  const [reason, setReason] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the camera when the component goes away - otherwise the browser
  // leaves the recording indicator on.
  useEffect(() => stop, [stop]);

  const start = async () => {
    setCamera('starting');
    setReason(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser cannot access the camera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera('live');
    } catch (cause) {
      setCamera('unavailable');
      setReason(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Camera permission was denied. Upload a photo instead.'
          : 'No camera is available on this device. Upload a photo instead.',
      );
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const scale = CAPTURE_WIDTH / video.videoWidth;
    const canvas = document.createElement('canvas');
    canvas.width = CAPTURE_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    stop();
    setCamera('idle');
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ink">
        Visitor photo <span className="text-danger">*</span>
      </p>

      <div className="flex items-start gap-4">
        <div className="grid size-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
          {value ? (
            <img src={value} alt="Captured visitor photo" className="size-full object-cover" />
          ) : camera === 'live' ? (
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted">No photo yet</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {value ? (
            <Button variant="secondary" onClick={() => onChange(undefined)}>
              Retake photo
            </Button>
          ) : camera === 'live' ? (
            <Button variant="primary" onClick={capture}>
              Capture
            </Button>
          ) : (
            <Button variant="secondary" loading={camera === 'starting'} onClick={() => void start()}>
              Use camera
            </Button>
          )}

          <label className="cursor-pointer text-xs font-semibold text-brand underline underline-offset-2">
            Upload a photo instead
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
          </label>

          {reason && <p className="max-w-56 text-xs text-muted">{reason}</p>}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
