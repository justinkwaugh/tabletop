import { afterEach, describe, expect, it } from 'vitest'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { spotlightHandlers } from './railroadSpotlight.js'

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
