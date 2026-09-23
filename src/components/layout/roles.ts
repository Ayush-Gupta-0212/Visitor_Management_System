import { type LucideIcon, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@/types/vms'

/** The three perspectives, in switcher order. */
export const ROLE_OPTIONS: readonly { value: Role; label: string; icon: LucideIcon }[] = [
  { value: 'GATEKEEPER', label: ROLE_LABELS.GATEKEEPER, icon: ShieldCheck },
  { value: 'HOST_EMPLOYEE', label: ROLE_LABELS.HOST_EMPLOYEE, icon: UserRound },
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN, icon: Settings2 },
]
