/**
 * The visitor's digital entry pass.
 *
 * The spec asks for "a visitor badge (physical or digital QR code)" issued on
 * approval, and for pre-approved guests to "receive a QR code/e-pass via email
 * or SMS, which they can scan upon arrival". The QR is generated in the browser
 * from the visit's single-use pass code.
 *
 * The code is also printed underneath in plain text, which is not decoration:
 * webcam scanning fails often enough at a busy reception (glare, cracked phone
 * screens, a guest who screenshotted the email at low resolution) that the
 * front desk needs a way to key it in. `ScanPass` accepts either.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function PassQr({ code, size = 148 }: { code: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(code, { width: size * 2, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code, size]);

  return (
    <figure className="flex flex-col items-center gap-2 rounded-xl border border-line bg-canvas p-4">
      {dataUrl && !failed ? (
        <img src={dataUrl} width={size} height={size} alt={`QR code for entry pass ${code}`} />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="grid place-items-center rounded-lg bg-surface text-xs text-muted"
        >
          {failed ? 'QR unavailable' : 'Generating…'}
        </div>
      )}
      <figcaption className="text-center">
        <p className="font-mono text-sm font-bold tracking-widest text-ink">{code}</p>
        <p className="text-[11px] text-muted">Show this at reception. Valid for one entry.</p>
      </figcaption>
    </figure>
  );
}
