import { Ban } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Modal, ModalBody, ModalClose, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { notifyError } from '@/lib/feedback'
import { toast } from '@/lib/toast'
import { useVmsStore } from '@/store/useVmsStore'
import type { VisitorRecord } from '@/types/vms'

const QUICK_REASONS = [
  "I'm not expecting this visitor",
  'The meeting has been cancelled',
  'Please reschedule through an invite',
  "I'm not in the office today",
]

interface RejectVisitorModalProps {
  /** The visit to reject; `null` keeps the dialog closed. */
  visitor: VisitorRecord | null
  onClose: () => void
}

/** Asks the host for a reason before denying a request or revoking a pre-approval. */
export function RejectVisitorModal({ visitor, onClose }: RejectVisitorModalProps) {
  // Keep the form on screen while the dialog animates closed.
  const [shown, setShown] = useState(visitor)
  if (visitor && visitor !== shown) setShown(visitor)
  const display = visitor ?? shown

  return (
    <Modal open={visitor !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent size="sm">{display && <RejectForm key={display.id} visitor={display} onDone={onClose} />}</ModalContent>
    </Modal>
  )
}

function RejectForm({ visitor, onDone }: { visitor: VisitorRecord; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const revoking = visitor.status === 'PRE_APPROVED'

  const choose = (text: string) => {
    setReason(text)
    setError(undefined)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = useVmsStore.getState().rejectVisitor(visitor.id, reason)
    if (!result.ok) {
      if (result.error.fields?.reason) setError(result.error.fields.reason)
      else notifyError(result.error)
      return
    }
    toast.success(revoking ? `Pre-approval revoked for ${visitor.fullName}` : `Request from ${visitor.fullName} rejected`, {
      description: 'The front desk has been told not to admit them.',
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <ModalHeader>
        <ModalTitle>{revoking ? 'Revoke this pre-approval?' : 'Reject this visitor request?'}</ModalTitle>
        <ModalDescription>
          {visitor.fullName}
          {visitor.company ? ` (${visitor.company})` : ''} will be turned away at the front desk.
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" aria-label="Common reasons">
          {QUICK_REASONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => choose(text)}
              className="rounded-full border border-border px-2.5 py-1 text-body-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              {text}
            </button>
          ))}
        </div>
        <Field
          id="reject-reason"
          label="Reason"
          required
          error={error}
          hint="Shared with the front desk and kept in the audit log."
          aside={<span className="font-mono text-mono-code text-muted-foreground tabular-nums">{reason.length}/500</span>}
        >
          {(control) => (
            <Textarea {...control} autoFocus value={reason} maxLength={500} onChange={(event) => choose(event.target.value)} />
          )}
        </Field>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="outline">Cancel</Button>
        </ModalClose>
        <Button type="submit" variant="destructive">
          <Ban /> {revoking ? 'Revoke pass' : 'Reject request'}
        </Button>
      </ModalFooter>
    </form>
  )
}
