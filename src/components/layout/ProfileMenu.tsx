import { ChevronDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { ROLE_LABELS } from '@/lib/rbac'
import { switchPerspective } from '@/store/useUiStore'
import { useVmsStore } from '@/store/useVmsStore'
import { ROLE_OPTIONS } from './roles'

/** Active user badge; its menu shows the session and doubles as a role switcher on small screens. */
export function ProfileMenu() {
  const user = useVmsStore((state) => state.currentUser)

  const onRoleChange = (value: string) => {
    const option = ROLE_OPTIONS.find((role) => role.value === value)
    if (option) switchPerspective(option.value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Signed in as ${user.name}, ${ROLE_LABELS[user.role]}`}
          className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden lg:pr-2"
        >
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <span className="hidden text-left lg:block">
            <span className="block text-label-md text-foreground">{user.name}</span>
            <span className="block text-body-sm text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block text-body-md font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-body-sm text-muted-foreground">{user.email}</span>
          <span className="mt-1 block text-body-sm text-muted-foreground">{user.department}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="eyebrow py-1">View as</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={user.role} onValueChange={onRoleChange}>
          {ROLE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
