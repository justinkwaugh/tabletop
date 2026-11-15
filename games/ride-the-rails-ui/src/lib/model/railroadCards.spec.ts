import { afterEach, describe, expect, it } from 'vitest'
import { PhaseName, type RailroadId } from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import type { RailroadCard } from '$lib/utils/marginTracks.js'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import {
    railroadCardLabel,
    shareButtonLabel,
    shareButtons,
    shownRailroadCards
} from './railroadCards.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

const ORANGE: RailroadCard = {
    railroadId: 'railroad.orange',
    supply: 27,
    shareholders: [
        { playerId: 'p1', shares: 1 },
        { playerId: 'p2', shares: 2 }
    ]
}

afterEach(() => {
    disposeSessions()
})

describe('a railroad’s accessible name', () => {
    it('on a desktop card or a build pile says its supply, not its track or its holders', () => {
        expect(railroadCardLabel(ORANGE)).toBe('Orange: 27 left')
    })
})

describe('a share button’s accessible name (R-3.1), its pile drawn without words', () => {
    it('names the whole choice: the railroad, its supply and the viewer’s shares', () => {
        expect(shareButtonLabel({ ...ORANGE, railroadId: RED, supply: 16 }, 1)).toBe(
            'Take a Red share, 16 left, you hold 1'
        )
        expect(shareButtonLabel({ ...ORANGE, railroadId: BLUE, supply: 27 }, 0)).toBe(
            'Take a Blue share, 27 left'
        )
        expect(shareButtonLabel(ORANGE, 0)).toBe('Take an Orange share, 27 left')
    })

    it('says an empty supply offers no share, and still counts the viewer’s shares', () => {
        expect(shareButtonLabel({ ...ORANGE, railroadId: RED, supply: 0 }, 0)).toBe(
            'Red: none left'
        )
        expect(shareButtonLabel({ ...ORANGE, railroadId: RED, supply: 0 }, 2)).toBe(
            'Red: none left, you hold 2'
        )
    })
})

describe('the share buttons (R-3.1, R-1.4, R-1.1)', () => {
    it('are the railroads available this round: round 1 shows Red and Blue alone', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 4, round: 1, phase: PhaseName.TakeShare })
        )
        const buttons = shareButtons(shownRailroadCards(session), session)
        expect(buttons.map((button) => button.railroadId)).toEqual([RED, BLUE])
        expect(buttons.map((button) => button.enabled)).toEqual([true, true])
        expect(buttons.map((button) => button.shareLabel)).toEqual([
            'Take a Red share, 27 left',
            'Take a Blue share, 27 left'
        ])
    })

    it('disable an empty pile, keeping the viewer’s shares on it', async () => {
        const session = await openSessionOn(
            buildState({
                playerCount: 4,
                round: 2,
                phase: PhaseName.TakeShare,
                shares: { p4: { [RED]: 1, [BLUE]: 2 }, p1: { [RED]: 26 } }
            })
        )
        expect(session.myPlayerId).toBe('p4')
        const [red, blue, orange] = shareButtons(shownRailroadCards(session), session)
        expect([red?.railroadId, red?.supply, red?.held, red?.enabled]).toEqual([RED, 0, 1, false])
        expect(red?.shareLabel).toBe('Red: none left, you hold 1')
        expect([blue?.held, blue?.enabled]).toEqual([2, true])
        expect(blue?.shareLabel).toBe('Take a Blue share, 25 left, you hold 2')
        expect(orange?.enabled).toBe(true)
    })

    it('are all disabled for a seat that is not taking a share', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 4, round: 1, phase: PhaseName.Build })
        )
        const buttons = shareButtons(shownRailroadCards(session), session)
        expect(buttons.map((button) => button.enabled)).toEqual([false, false])
    })
})
