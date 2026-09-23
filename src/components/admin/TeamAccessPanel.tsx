import { Check, Minus } from 'lucide-react'
import { useMemo } from 'react'
import { Panel } from '@/components/shared/Panel'
import { Avatar } from '@/components/ui/Avatar'
import { ROLE_ICONS } from '@/components/layout/roles'
import { ACCOUNTS } from '@/data/mockData'
import { useNow } from '@/hooks/useNow'
import { formatRelative } from '@/lib/format'
import { type Permission, PERMISSION_LABELS, ROLE_LABELS, can } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { useVmsStore } from '@/store/useVmsStore'
import type { Role } from '@/types/vms'

const ROLES: readonly Role[] = ['GATEKEEPER', 'HOST_EMPLOYEE', 'ADMIN']
const PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[]

/** Scope notes for permissions that don't apply to every visitor. */
const SCOPES: Partial<Record<Permission, string>> = {
  'visitor:approve': 'own visitors',
  'visitor:reject': 'own visitors',
  'visitor:check-in': 'own site',
  'visitor:check-out': 'own site',
  'visitor:extend': 'own site',
}

/** Everyone who can sign in, when they last did, and what each role is allowed to do. */
export function TeamAccessPanel({ className }: { className?: string }) {
  const auditLog = useVmsStore((state) => state.auditLog)
  const now = useNow()

  // The log is newest first, so the first sign-in found per person is their latest. O(N).
  const lastSeen = useMemo(() => {
    const seen = new Map<string, string>()
    for (const entry of auditLog) {
      if (entry.action === 'SIGNED_IN' && !seen.has(entry.actorName)) seen.set(entry.actorName, entry.at)
    }
    return seen
  }, [auditLog])

  return (
    <Panel
      title="Team & access"
      description={`${ACCOUNTS.length} accounts · every action is checked against these permissions`}
      className={className}
      bodyClassName="grid lg:grid-cols-2"
    >
      <ul className="divide-y divide-muted border-b border-border lg:border-r lg:border-b-0">
        {ACCOUNTS.map(({ user }, index) => {
          const Icon = ROLE_ICONS[user.role]
          const at = lastSeen.get(user.name)
          return (
            <li key={user.id} className="flex animate-row-in items-center gap-3 px-5 py-2.5" style={{ animationDelay: `${index * 25}ms` }}>
              <Avatar name={user.name} src={user.avatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-medium text-foreground">{user.name}</p>
                <p className="truncate text-body-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="inline-flex items-center gap-1 text-label-md text-foreground">
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden /> {ROLE_LABELS[user.role]}
                </p>
                <p className="text-body-sm text-muted-foreground">{at ? `Signed in ${formatRelative(at, now)}` : 'Not signed in yet'}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left">
          <caption className="sr-only">Permissions by role</caption>
          <thead className="bg-background">
            <tr className="border-b border-border">
              <th scope="col" className="eyebrow h-9 px-5 font-medium">
                Permission
              </th>
              {ROLES.map((role) => (
                <th key={role} scope="col" className="eyebrow h-9 px-3 text-center font-medium">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-b border-muted last:border-b-0">
                <th scope="row" className="px-5 py-2 text-body-sm font-normal text-foreground first-letter:uppercase">
                  {PERMISSION_LABELS[permission]}
                </th>
                {ROLES.map((role) => {
                  const allowed = can(role, permission)
                  return (
                    <td key={role} className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-body-sm',
                          allowed ? 'text-success-strong' : 'text-placeholder',
                        )}
                      >
                        {allowed ? <Check className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                        <span className="sr-only">{allowed ? 'Allowed' : 'Not allowed'}</span>
                        {allowed && SCOPES[permission] && <span className="hidden text-muted-foreground sm:inline">{SCOPES[permission]}</span>}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
