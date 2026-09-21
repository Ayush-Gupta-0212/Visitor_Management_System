# TypeScript used in this repo

A short guide to every TypeScript construct this project uses, so that each one
can be explained in an interview. Nothing here is exotic — that is deliberate.
The repo avoids conditional types, mapped-type gymnastics and schema inference,
because clever types are a liability in code you have to defend out loud.

Read this alongside [`src/domain/types.ts`](../src/domain/types.ts), which is
where most of it appears.

---

## 1. `interface` — the shape of an object

```ts
export interface Office {
  id: string;
  name: string;
  city: string;
}
```

Describes an object's fields. It disappears at build time; there is no runtime
cost and no runtime checking. If an API returned this, TypeScript would *trust*
you — which is why validation in `domain/validators.ts` is real code, not types.

## 2. String-literal unions — the workhorse

```ts
export type VisitStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | ...;
```

A value must be one of these exact strings. Three reasons this is used instead
of an `enum`:

- it compiles to plain strings, so `visit.status === 'APPROVED'` works in the
  debugger and in JSON;
- the editor autocompletes the options;
- `switch` over it is checked for **exhaustiveness** — add a new status and
  every `switch` that does not handle it fails to compile.

> **If asked "why not an enum?"** — enums emit a runtime object and behave
> oddly with `const` and with string values. Unions are the modern default.

## 3. `?` — optional fields

```ts
checkInAt?: number;
```

The field may be absent. TypeScript then forces you to deal with that before
using it, which is what stops `undefined` reaching `formatTime`.

## 4. `??` and `?.` — nullish coalescing and optional chaining

```ts
visit.checkInAt ?? visit.scheduledStart     // use the fallback if null/undefined
visitIndex.employees.get(id)?.name          // undefined instead of a crash
```

`??` differs from `||`: `0 ?? 5` is `0`, but `0 || 5` is `5`. That matters here
because timestamps and counts can legitimately be zero.

## 5. `Record<K, V>` — an object with exactly these keys

```ts
const TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = { ... };
```

This is the most valuable type in the project. Because the key type is the
`VisitStatus` union, **adding a new status breaks the build until the transition
table handles it.** The compiler is doing code review: it is impossible to add a
lifecycle state and forget to say what it can become.

The same trick appears in `permissions.ts` (`Record<Role, Action[]>`) and in the
badge and label maps.

## 6. `Partial<T>` — every field optional

```ts
update(id: string, patch: Partial<Visit>): Visit
```

Used for patches: "some fields of a Visit". `Partial` is a *utility type* —
TypeScript ships several (`Pick`, `Omit`, `Required`); this repo uses `Partial`
and `Omit`.

## 7. `Omit<T, K>` — a type minus some fields

```ts
pushToast: (toast: Omit<Toast, 'id'>) => void;
```

"A Toast, but you do not supply the id — the store generates it."

## 8. Type guards — narrowing `unknown`

```ts
export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
```

A `catch` block gives you `unknown`, because anything can be thrown. The
`e is DomainError` return type tells the compiler that a `true` result means it
is safe to read `.code` and `.message`. This is how `toUserMessage()` can handle
anything thrown without using `any`.

## 9. `readonly` — cannot be reassigned

```ts
readonly visits = new Map<string, Visit>();
readonly code: string;
```

The binding cannot be replaced. Note that `readonly` on a `Map` prevents
reassigning the property, **not** mutating the map — that is a common interview
follow-up.

## 10. `satisfies` — check without widening

```ts
channel?.postMessage({ sender: TAB_ID, message } satisfies Envelope);
```

Checks the object matches `Envelope` while keeping its precise literal type.
`as Envelope` would *assert* (and could lie); `satisfies` *verifies*.

## 11. `as` — a type assertion, used sparingly

```ts
const next = event.target.value as Role;
```

"Trust me, this is a `Role`." It is an escape hatch with no runtime check, used
only where the DOM gives back a `string` that we know came from our own
`<option>` list. Every `as` in this repo is at a DOM boundary.

## 12. Generics — one implementation, many types

```ts
export class MinHeap<T> { push(at: number, value: T): void }
function Combobox<T>({ results, getKey, onPick }: ComboboxProps<T>)
```

`T` is a placeholder filled in at the call site: `MinHeap<string>` holds strings.
The combobox is the one component that is generic, so the host picker and the
guest picker share an implementation while each keeps its own item type.

There are exactly two generics in this codebase. That is on purpose.

## 13. `import type`

```ts
import type { Visit } from '@/domain/types';
```

Imports only the type, which is erased at build time. With
`verbatimModuleSyntax` on (see `tsconfig.json`) this is required for type-only
imports, and it stops the bundler pulling in modules that are only needed for
their types.

## 14. `strict` mode

`tsconfig.json` sets `"strict": true`. The parts that bite most often:

- `strictNullChecks` — `undefined` is not silently assignable, so optional
  fields must be handled;
- `noImplicitAny` — a parameter without a type is an error;
- `noUnusedLocals` / `noUnusedParameters` — dead code fails the build.

---

## Things you will be asked, with answers

**"Why TypeScript for a frontend case study?"**
The visit lifecycle has seven states and a dozen rules about which transitions
are legal. The `Record<VisitStatus, ...>` transition table makes it impossible to
add a state and forget to handle it. That is a real defect class removed at
compile time, not a style preference.

**"What does TypeScript *not* give you?"**
Anything at runtime. Types are erased. That is precisely why
`domain/validators.ts` and `domain/rules.ts` exist as executable code — the data
from a form or a mock API is `unknown` until something actually checks it.

**"Where did the types earn their keep here?"**
Two places. The transition table, above. And `Partial<Visit>` patches: the
optimistic-update-and-rollback code passes partial records around constantly,
and the compiler catches a field name typo that would otherwise silently write
an ignored property.

**"What would you do differently?"**
Validate at the API boundary with a schema library so that parsed data is typed
*and* checked in one step, instead of trusting the shape. Worth it once there is
a real server.
