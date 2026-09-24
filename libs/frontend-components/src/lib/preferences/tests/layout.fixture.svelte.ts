import { flushSync } from 'svelte'
import { DebouncedLayout } from '../debouncedLayout.svelte.js'
let controller: DebouncedLayout | undefined
let cleanup: (() => void) | undefined
let writes: unknown[] = []
let fail = false
let account = $state('alice')
let stored: unknown = $state.raw(null)
export function start() {
    cleanup?.()
    writes = []
    fail = false
    account = 'alice'
    stored = null
    cleanup = $effect.root(() => {
        controller = new DebouncedLayout(() => ({ ready: true, key: `layout-test:${account}`, value: stored }), async value => {
            writes.push(value)
            if (fail) return false
            stored = value
            return true
        })
    })
    flushSync()
}
export function edit(value: unknown) { controller?.change(value); flushSync() }
export function failWrites(value: boolean) { fail = value }
export async function save() { await controller?.save(); flushSync() }
export function switchAccount() { account = 'bob'; flushSync() }
export function snapshot() { flushSync(); return { writes, status: controller?.status, value: controller?.value } }
export function dispose() { cleanup?.() }
