import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/Modal'
import { toast } from '@/lib/toast'
import { useUiStore } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'

/** "Reset Mock Database": restores the seeded state after a confirmation, for reviewers re-running a scenario. */
export function ResetDatabaseButton() {
  const [open, setOpen] = useState(false)

  const reset = () => {
    useUiStore.getState().closeAll()
    useVmsStore.getState().resetDemoData()
    setOpen(false)
    toast.success('Mock database reset', { description: 'The 20 seeded visits, default policy and audit trail are restored.' })
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Reset mock database">
          <RotateCcw />
          <span className="hidden sm:inline">Reset mock database</span>
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Reset the mock database?</ModalTitle>
          <ModalDescription>
            This restores the 20 seeded visits, the default policy and the seeded audit trail, generated fresh for today.
            Anything you created in this browser is discarded.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="outline">Cancel</Button>
          </ModalClose>
          <Button variant="destructive" onClick={reset}>
            <RotateCcw /> Reset database
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
