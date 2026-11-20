import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { shareButtonHandlers, spotlightHandlers } from './railroadSpotlight.js'

afterEach(() => {
    disposeSessions()
})

const keyPress = (key: string) => ({ key, preventDefault: () => undefined })

// Contract, Look: railroad spotlight: a share row or a railroad strip entry spotlights its railroad.
describe('a railroad spotlight control', () => {
    it('spotlights its railroad on a press, and a second press ends it', async () => {
        const session = await openSessionOn(buildState())
        const red = spotlightHandlers(session, 'railroad.red')
        red.onclick()
        expect(session.spotlightRailroadId).toBe('railroad.red')
        red.onclick()
        expect(session.spotlightRailroadId).toBeUndefined()
    })

    it('presses with Enter or Space, and pressing another railroad moves the spotlight', async () => {
        const session = await openSessionOn(buildState())
        spotlightHandlers(session, 'railroad.red').onkeydown(keyPress('Enter'))
        expect(session.spotlightRailroadId).toBe('railroad.red')
        spotlightHandlers(session, 'railroad.blue').onkeydown(keyPress(' '))
        expect(session.spotlightRailroadId).toBe('railroad.blue')
        spotlightHandlers(session, 'railroad.blue').onkeydown(keyPress('Tab'))
        expect(session.spotlightRailroadId).toBe('railroad.blue')
    })

    it('follows a mouse pointer, but not a touch, which presses instead', async () => {
        const session = await openSessionOn(buildState())
        const blue = spotlightHandlers(session, 'railroad.blue')
        blue.onpointerenter({ pointerType: 'mouse' })
        expect(session.spotlightRailroadId).toBe('railroad.blue')
        blue.onpointerleave({ pointerType: 'mouse' })
        expect(session.spotlightRailroadId).toBeUndefined()

        blue.onpointerenter({ pointerType: 'touch' })
        expect(session.spotlightRailroadId).toBeUndefined()
    })
})

/** A session that only records the calls a share button makes. */
function recordingSession() {
    return {
        takeShare: vi.fn(async () => undefined),
        pressRailroad: vi.fn(),
        hoverRailroad: vi.fn(),
        leaveRailroad: vi.fn()
    }
}

// Contract, Take a share: an enabled share button spotlights its railroad while a mouse is over it.
describe('a share button', () => {
    it('spotlights its railroad on a mouse enter and ends it on leave', () => {
        const session = recordingSession()
        const blue = shareButtonHandlers(session, 'railroad.blue', true)
        blue.onpointerenter({ pointerType: 'mouse' })
        expect(session.hoverRailroad).toHaveBeenCalledExactlyOnceWith('railroad.blue')
        blue.onpointerleave({ pointerType: 'mouse' })
        expect(session.leaveRailroad).toHaveBeenCalledOnce()
    })

    it('spotlights nothing for a touch', () => {
        const session = recordingSession()
        const blue = shareButtonHandlers(session, 'railroad.blue', true)
        blue.onpointerenter({ pointerType: 'touch' })
        blue.onpointerleave({ pointerType: 'touch' })
        blue.release()
        expect(session.hoverRailroad).not.toHaveBeenCalled()
        expect(session.leaveRailroad).not.toHaveBeenCalled()
    })

    it('spotlights nothing when disabled, as an empty supply is', () => {
        const session = recordingSession()
        const red = shareButtonHandlers(session, 'railroad.red', false)
        red.onpointerenter({ pointerType: 'mouse' })
        red.onpointerleave({ pointerType: 'mouse' })
        red.release()
        expect(session.hoverRailroad).not.toHaveBeenCalled()
        expect(session.leaveRailroad).not.toHaveBeenCalled()
    })

    it('takes the share on a press, and never holds the spotlight', () => {
        const session = recordingSession()
        shareButtonHandlers(session, 'railroad.blue', true).onclick()
        expect(session.takeShare).toHaveBeenCalledExactlyOnceWith('railroad.blue')
        expect(session.pressRailroad).not.toHaveBeenCalled()
        expect(session.hoverRailroad).not.toHaveBeenCalled()
    })

    it('ends its own hover when released (disabled, or gone from under the mouse), and nothing else', () => {
        const session = recordingSession()
        const blue = shareButtonHandlers(session, 'railroad.blue', true)
        blue.release()
        expect(session.leaveRailroad).not.toHaveBeenCalled()
        blue.onpointerenter({ pointerType: 'mouse' })
        blue.release()
        expect(session.leaveRailroad).toHaveBeenCalledOnce()
        // The mouse's later leave, or a second release, ends nothing more.
        blue.onpointerleave({ pointerType: 'mouse' })
        blue.release()
        expect(session.leaveRailroad).toHaveBeenCalledOnce()
    })

    it('ends its hover on the session, and leaves a held spotlight from before the turn held', async () => {
        const session = await openSessionOn(buildState())
        const blue = shareButtonHandlers(session, 'railroad.blue', true)
        blue.onpointerenter({ pointerType: 'mouse' })
        expect(session.spotlightRailroadId).toBe('railroad.blue')
        expect(session.heldRailroadId).toBeUndefined()
        blue.release()
        expect(session.spotlightRailroadId).toBeUndefined()

        session.pressRailroad('railroad.red')
        blue.onpointerenter({ pointerType: 'mouse' })
        blue.release()
        expect(session.heldRailroadId).toBe('railroad.red')
    })
})
