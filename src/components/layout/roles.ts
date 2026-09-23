import { type LucideIcon, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import type { Role } from '@/types/vms'

/** One icon per role, used wherever a role is named: the profile menu, sign-in page and team list. */
export const ROLE_ICONS: Record<Role, LucideIcon> = {
  GATEKEEPER: ShieldCheck,
  HOST_EMPLOYEE: UserRound,
  ADMIN: Settings2,
}

/** What each role's workspace is called. */
export const WORKSPACE_LABELS: Record<Role, string> = {
  GATEKEEPER: 'Gatekeeper console',
  HOST_EMPLOYEE: 'Host workspace',
  ADMIN: 'Governance hub',
}
