import { Save } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { notifyError } from '@/lib/feedback'
import { toast } from '@/lib/toast'
import type { FieldErrors } from '@/lib/visitorRules'
import { DEFAULT_SETTINGS, useVmsStore } from '@/store/useVmsStore'

/**
 * Editable access policy. The parent keys this card by the current settings, so
 * a save elsewhere or a database reset remounts it with fresh values.
 */
export function PolicySettingsCard({ className }: { className?: string }) {
  const settings = useVmsStore((state) => state.settings)
  const [limit, setLimit] = useState(String(settings.maxPreApprovalsPerEmployeePerDay))
  const [grace, setGrace] = useState(String(settings.autoOverstayThresholdMinutes))
  const [errors, setErrors] = useState<FieldErrors>({})

  const changed =
    Number(limit) !== settings.maxPreApprovalsPerEmployeePerDay || Number(grace) !== settings.autoOverstayThresholdMinutes

  const save = (event: FormEvent) => {
    event.preventDefault()
    const result = useVmsStore.getState().updateSettings({
      maxPreApprovalsPerEmployeePerDay: Number(limit),
      autoOverstayThresholdMinutes: Number(grace),
    })
    if (!result.ok) {
      if (result.error.fields) setErrors(result.error.fields)
      else notifyError(result.error)
      return
    }
    toast.success('Policy updated', {
      description: `Hosts can approve ${result.data.maxPreApprovalsPerEmployeePerDay} visitors a day; overstays are flagged ${result.data.autoOverstayThresholdMinutes} min after the window ends.`,
    })
  }

  const restoreDefaults = () => {
    setLimit(String(DEFAULT_SETTINGS.maxPreApprovalsPerEmployeePerDay))
    setGrace(String(DEFAULT_SETTINGS.autoOverstayThresholdMinutes))
    setErrors({})
  }

  return (
    <Panel title="Access policy" description="Applies to every host and every gate." className={className}>
      <form onSubmit={save} noValidate className="flex flex-col gap-4 p-5">
        <Field
          id="policy-limit"
          label="Max pre-approvals per day per host"
          error={errors.maxPreApprovalsPerEmployeePerDay}
          hint="Walk-ins admitted directly at the desk don't count."
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="font-mono"
            />
          )}
        </Field>
        <Field
          id="policy-grace"
          label="Overstay grace period (mins)"
          error={errors.autoOverstayThresholdMinutes}
          hint="Time after the window ends before a visitor is flagged."
        >
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="numeric"
              min={0}
              max={480}
              step={5}
              value={grace}
              onChange={(event) => setGrace(event.target.value)}
              className="font-mono"
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!changed}>
            <Save /> Save policy
          </Button>
          <Button variant="ghost" onClick={restoreDefaults}>
            Restore defaults
          </Button>
        </div>
      </form>
    </Panel>
  )
}
