import { ScanLine } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { toast } from '@/lib/toast'
import { findVisitorByPassToken } from '@/lib/visitorIndex'
import { STATUS_LABELS } from '@/lib/visitorRules'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'

/**
 * Resolves an e-pass token to its visit: an O(1) index lookup, then the visitor's
 * drawer. A camera QR scanner would feed decoded tokens into this same lookup
 * (see QRCodePlaceholder for the integration notes).
 */
export function VerifyPassPopover() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')

  const verify = (event: FormEvent) => {
    event.preventDefault()
    const visitor = findVisitorByPassToken(useVmsStore.getState().visitors, token)
    if (!visitor) {
      toast.error('No pass matches that token', { description: 'Check the token, or register the visitor as a walk-in.' })
      return
    }
    toast.info(`Pass matched: ${visitor.fullName}`, {
      description: `${STATUS_LABELS[visitor.status]} · host ${visitor.hostEmployeeName}`,
    })
    setOpen(false)
    setToken('')
    useUiStore.getState().openDetails(visitor.id)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <ScanLine /> Verify pass
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <form onSubmit={verify} className="flex flex-col gap-3">
          <Field id="pass-token" label="Pass token" hint="Paste the token from a visitor's e-pass (Copy token on the pass).">
            {(control) => (
              <Input
                {...control}
                autoFocus
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="e.g. 3f9a21c0-…"
                className="font-mono text-mono-code"
              />
            )}
          </Field>
          <Button type="submit" disabled={!token.trim()}>
            Verify pass
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
