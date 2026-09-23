import { SOURCE_LABELS } from '@/lib/visitorRules'
import type { VisitorRecord } from '@/types/vms'

/** How the visit reached the site, in words, e.g. "Walk-in · host approved". */
export function describeSource(visitor: VisitorRecord): string {
  if (visitor.source !== 'WALK_IN') return SOURCE_LABELS[visitor.source]
  if (visitor.approvedAt) return 'Walk-in · host approved'
  if (visitor.actualCheckInTime) return 'Walk-in · admitted at desk'
  return 'Walk-in · sent to host'
}
