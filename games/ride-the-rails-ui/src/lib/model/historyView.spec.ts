import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    MachineState,
    PhaseName,
    type HexId,
    type HydratedRideTheRailsGameState
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { historyStep } from '$lib/utils/history.js'
import type { RideTheRailsGameSession } from './session.svelte.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'

afterEach(() => {
    disposeSessions()
})

// Red in New York and Blue in Philadelphia, held by p1: some hexes take either railroad.
function redAndBlue(): HydratedRideTheRailsGameState {
    return buildState({
        phase: PhaseName.Build,
        shares: { p1: { 'railroad.red': 1, 'railroad.blue': 1 } },
        track: { [NEW_YORK]: ['railroad.red'], [PHILADELPHIA]: ['railroad.blue'] }
    })
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

function litHex(session: RideTheRailsGameSession, railroads: number, except?: HexId) {
    const hex = session.boardOffer.lit.find(
        (lit) => lit.placements.length === railroads && lit.hexId !== except
    )
    assertExists(hex, `No lit hex with ${railroads} railroads`)
    return hex
}

describe('History View (contract scenario 22)', () => {
    it('hides the popup, scrim and lit hexes, keeps hex detail and spotlight, and shows the live offer again on return', async () => {
        const session = await openSessionOn(redAndBlue())
        const single = litHex(session, 1)
        const shared = litHex(session, 2, single.hexId)
        await session.placeLocomotive(single.placements[0].railroadId, single.hexId)
        await settled(session)
        expect(session.gameState.actionCount).toBe(1)

        await session.pressHex(shared.hexId)
        expect(session.buildHexId).toBe(shared.hexId)

        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.machineState).toBe(MachineState.Building)
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.scrim).toBeUndefined()
        expect(session.buildHexId).toBeUndefined()
        expect(session.journeyDraft).toBeUndefined()

        // The action area's history description reads the displayed state's last step.
        expect(historyStep(session.actions)).toEqual({ action: undefined, consequences: [] })

        session.pressRailroad('railroad.blue')
        expect(session.spotlightRailroadId).toBe('railroad.blue')

        // History's buttons wait out the last step's settling before they act again.
        await vi.waitFor(() => {
            session.history.goToEnd()
            expect(session.history.inHistory).toBe(false)
        })
        await settled(session)
        await vi.waitFor(() => expect(session.isViewingHistory).toBe(false))
        expect(session.boardOffer.lit.length).toBeGreaterThan(0)
        expect(session.buildHexId).toBeUndefined()
        expect(session.spotlightRailroadId).toBe('railroad.blue')
    })
})
