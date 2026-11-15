import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertExists } from '@tabletop/common'
import { reauthentication } from './reauthentication.svelte'

beforeEach(() => reauthentication.cancel())

describe('confirmation ownership', () => {
    it('ignores completion and dismissal from a replaced prompt', async () => {
        const oldRetry = vi.fn()
        const newRetry = vi.fn()
        reauthentication.request({ description: 'old action', retry: oldRetry })
        const old = reauthentication.pending
        assertExists(old, 'The old prompt exists')
        reauthentication.cancel()
        reauthentication.request({ description: 'new action', retry: newRetry })
        const current = reauthentication.pending
        assertExists(current, 'The replacement prompt exists')

        await reauthentication.complete(old)
        reauthentication.cancel(old)
        expect(reauthentication.pending).toBe(current)
        expect(oldRetry).not.toHaveBeenCalled()
        expect(newRetry).not.toHaveBeenCalled()

        await reauthentication.complete(current)
        expect(newRetry).toHaveBeenCalledTimes(1)
    })

    it('cannot resume an unconfirmed or cancelled popup action', async () => {
        const retry = vi.fn()
        reauthentication.request({ description: 'open Discord', retry, requiresUserGesture: true })
        const pending = reauthentication.pending
        assertExists(pending, 'The popup action requested confirmation')
        await reauthentication.resume(pending)
        expect(retry).not.toHaveBeenCalled()
        await reauthentication.complete(pending)
        expect(retry).not.toHaveBeenCalled()
        reauthentication.cancel()
        await reauthentication.resume(pending)
        expect(retry).not.toHaveBeenCalled()
    })
})
