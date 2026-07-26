// Sidecar declaration for tasks.json (resolved via `allowArbitraryExtensions`).
//
// Typing the import here rather than turning on `resolveJsonModule` keeps tsc from
// inferring a 646-element literal type for every field of every row -- which is
// both very slow and less useful than the domain type we actually want.
import type { TaskRow } from '@/lib/types'

declare const tasks: TaskRow[]
export default tasks
