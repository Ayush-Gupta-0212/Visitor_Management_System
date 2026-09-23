import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { switchPerspective } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import { ROLE_OPTIONS } from './roles'

/** `[ Gatekeeper | Host Employee | Super Admin ]`: switches the whole app's perspective. */
export function RoleSwitcher({ className }: { className?: string }) {
  const role = useVmsStore((state) => state.currentUser.role)

  return (
    <SegmentedControl
      label="Viewing as"
      value={role}
      onValueChange={switchPerspective}
      className={className}
      options={ROLE_OPTIONS.map(({ value, label, icon: Icon }) => ({
        value,
        label: (
          <>
            <Icon aria-hidden />
            {label}
          </>
        ),
      }))}
    />
  )
}
