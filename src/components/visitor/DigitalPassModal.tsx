import { ChevronDown, Copy, Download, ExternalLink, KeyRound, Link2, Mail, MessageCircle, Printer, Share2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { formatDay, formatWindow } from '@/lib/format'
import { downloadPass, passFileName, printPass } from '@/lib/passExport'
import { createPassLink } from '@/lib/passLink'
import { toast } from '@/lib/toast'
import { STATUS_LABELS } from '@/lib/visitorRules'
import { useVisitor } from '@/store/hooks'
import { useUiStore } from '@/store/useUiStore'
import type { VisitorRecord } from '@/types/vms'
import { PassCard } from './PassCard'

/** The pass for `passVisitorId` in the UI store; opened from the drawer, host lists and toasts. */
export function DigitalPassModal() {
  const passVisitorId = useUiStore((state) => state.passVisitorId)
  const closePass = useUiStore((state) => state.closePass)
  const visitor = useVisitor(passVisitorId)
  // Keep rendering the last pass while the dialog animates closed.
  const [shown, setShown] = useState(visitor)
  if (visitor && visitor !== shown) setShown(visitor)
  const display = visitor ?? shown

  return (
    <Modal open={Boolean(visitor)} onOpenChange={(open) => !open && closePass()}>
      <ModalContent size="sm">{display && <PassView visitor={display} />}</ModalContent>
    </Modal>
  )
}

function PassView({ visitor }: { visitor: VisitorRecord }) {
  const cardRef = useRef<SVGSVGElement>(null)
  const fileName = passFileName(visitor.fullName)

  const download = () => {
    if (!cardRef.current) return
    downloadPass(cardRef.current, fileName)
    toast.success('Pass downloaded', { description: `${fileName}.svg` })
  }

  const print = () => {
    if (cardRef.current && !printPass(cardRef.current)) {
      toast.error('Pop-up blocked', { description: 'Allow pop-ups for this site to print the pass, or download it instead.' })
    }
  }

  return (
    <>
      <ModalHeader>
        <ModalTitle>Digital visitor pass</ModalTitle>
        <ModalDescription>
          {visitor.fullName} · {STATUS_LABELS[visitor.status]}
        </ModalDescription>
      </ModalHeader>
      {/* items-start: a stretched SVG would shrink its drawing to fit a short dialog instead of scrolling. */}
      <ModalBody className="flex items-start justify-center pt-1">
        <PassCard ref={cardRef} pass={visitor} className="h-auto w-full max-w-80 animate-rise-in drop-shadow-sm" />
      </ModalBody>
      <ModalFooter className="justify-between">
        {visitor.status === 'PRE_APPROVED' ? <ShareMenu visitor={visitor} /> : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={download} aria-label="Download pass">
            <Download /> <span className="hidden sm:inline">Download</span>
          </Button>
          <Button onClick={print}>
            <Printer /> Print
          </Button>
        </div>
      </ModalFooter>
    </>
  )
}

/** International number for wa.me: digits only, assuming India (+91) for a bare 10-digit number. */
function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  return digits.length >= 11 ? digits : null
}

async function copy(text: string, success: string, description: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(success, { description })
  } catch {
    toast.error("Couldn't copy automatically", { description: 'Your browser blocked clipboard access. Use "Open pass page" and copy the address instead.' })
  }
}

/** Sends the e-pass to the visitor: a link that opens the pass on their phone, by email, WhatsApp or copy-paste. */
function ShareMenu({ visitor }: { visitor: VisitorRecord }) {
  const link = createPassLink(visitor)
  const firstName = visitor.fullName.split(' ')[0]
  const when = `${formatDay(visitor.expectedDate)}, ${formatWindow(visitor.timeWindowStart, visitor.timeWindowEnd)}`
  const message =
    `Hi ${firstName}, your visit to ${visitor.office} is confirmed for ${when}. ` +
    `Your host is ${visitor.hostEmployeeName}. Show the QR code on your e-pass at the lobby kiosk or front desk: ${link}`
  const mailto = `mailto:${visitor.email}?subject=${encodeURIComponent(`Your visitor pass for ${formatDay(visitor.expectedDate)}`)}&body=${encodeURIComponent(message)}`
  const whatsapp = whatsappNumber(visitor.phone)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Share2 /> Share <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="eyebrow py-1">Send the e-pass to {firstName}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void copy(link, 'Pass link copied', `Send it to ${firstName}: it opens the e-pass on any phone.`)}>
          <Link2 /> Copy pass link
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!visitor.email} asChild={Boolean(visitor.email)}>
          {visitor.email ? (
            <a href={mailto}>
              <Mail /> <span className="truncate">Email to {visitor.email}</span>
            </a>
          ) : (
            <span>
              <Mail /> Email (no address on file)
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!whatsapp} asChild={Boolean(whatsapp)}>
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> <span className="truncate">WhatsApp to {visitor.phone}</span>
            </a>
          ) : (
            <span>
              <MessageCircle /> WhatsApp (no mobile on file)
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={link} target="_blank" rel="noreferrer">
            <ExternalLink /> Open pass page
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void copy(visitor.qrCodePlaceholder, 'Pass code copied', 'Type or paste it at the kiosk or into "Scan pass" at the desk.')}
        >
          <KeyRound /> Copy pass code
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy(message, 'Invitation text copied', 'Paste it into any chat or SMS.')}>
          <Copy /> Copy invitation text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
