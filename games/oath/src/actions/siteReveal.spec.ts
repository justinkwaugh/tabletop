import { RunMode, vaultOf, engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { assert, assertExists } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { SetupChoice } from './setupChoice.js'
import { Travel, isTravel } from './travel.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { SetupVariant } from '../data/worldDeck.js'
import { testGame } from '../testing/game.js'

/** R-5.6.2, R-2.8.2 — dealt for real, because `testState` makes every slot faceup. */
const MASTER_SEED = '0123456789abcdef0123456789abcdef'

function ready() {
    // Pinned to Curated because the seeded deal depends on the deck variant.
    const game = testGame(['p1', 'p2'], { seed: 3, config: { setupVariant: SetupVariant.Curated } })
    const { initialState } = engine.startGame(game, { masterSeed: MASTER_SEED })
    let current = initialState

    for (const playerId of current.turnManager.turnOrder) {
        const hydrated = new HydratedOathGameState(current)
        const hand = hydrated.getPlayerState(playerId).knownHand()
        current = engine.runNext(buildAction(SetupChoice, {
            playerId,
            siteId:
                playerId === current.chancellorPlayerId
                    ? TOP_CRADLE_SLOT
                    : hydrated.faceupSiteIds()[1],
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        }), current, game).updatedState
    }

    // R-4.1 — this deal leaves the Wake nothing to decide, so it resolves itself.
    expect(current.machineState).toBe(MachineState.ActPhase)

    return { game, vault: vaultOf(current), state: current }
}

function facedownDestination(state: OathProjectedState): string {
    const hydrated = new HydratedOathGameState(state)
    const slot = hydrated.allSiteIds().find((id) => !hydrated.isSiteFaceup(id))
    expect(slot, 'the fixture must leave at least one facedown site').toBeDefined()
    assertExists(slot, 'the fixture must leave at least one facedown site')
    return slot
}

describe('R-5.6.2 — travelling onto a facedown site reveals it', () => {
    it('R-10.20 — flips the site faceup and takes it out of the vault', () => {
        const { game, vault, state } = ready()
        const playerId = state.turnManager.turnOrder[0]
        const destination = facedownDestination(state)
        expect(vault.siteFacedown[destination]).toBeDefined()

        const { updatedState, processedActions } = engine.runNext(buildAction(Travel, { playerId, siteId: destination }), state, game)

        const after = new HydratedOathGameState(updatedState)
        expect(after.isSiteFaceup(destination)).toBe(true)
        expect(after.getPlayerState(playerId).siteId).toBe(destination)
        expect(vaultOf(updatedState).siteFacedown[destination]).toBeUndefined()
        // R-X.3 — the reveal crosses the vault, so the Travel is not undoable.
        expect(processedActions[0].revealsInfo).toBe(true)
    })

    it('draws its "R" icons facedown, publishing slots and not fronts', () => {
        const { game, vault, state } = ready()
        const playerId = state.turnManager.turnOrder[0]
        const destination = facedownDestination(state)
        const siteCardId = vault.siteFacedown[destination]
        assertExists(siteCardId, 'the destination is facedown, so the vault holds its card')
        const expected = siteRevealPrompt(siteCardId)?.relics ?? 0

        const { updatedState, processedActions } = engine.runNext(buildAction(Travel, { playerId, siteId: destination }), state, game)

        const after = new HydratedOathGameState(updatedState)
        const slots = after.relicSlotsAt(destination)
        expect(slots).toHaveLength(expected)
        for (const slot of slots) {
            expect(slot).toEqual({ slotId: slot.slotId })
            expect(vaultOf(updatedState).relicFacedown[slot.slotId]).toBeDefined()
        }

        const travel = processedActions[0]
        assert(isTravel(travel), 'the Travel is the first action processed')
        const reveal = travel.metadata
        expect(reveal?.revealedSiteCardId).toBe(siteCardId)
        expect(reveal?.relicsRevealed).toBe(expected)

        // The processed action is broadcast, so it must not name any drawn relic.
        const drawn = slots.map((slot) => vaultOf(updatedState).relicFacedown[slot.slotId])
        const serialized = JSON.stringify(processedActions[0])
        for (const cardId of drawn) {
            expect(serialized, `${cardId} leaked onto the action`).not.toContain(cardId)
        }
    })

    // Transcribed from the cards: reading them back off `siteRevealPrompt` would assert nothing.
    const PROMPTING_SITES: Record<string, { favor: number; secrets: number }> = {
        'site.drowned-city': { favor: 0, secrets: 3 },
        'site.mine': { favor: 3, secrets: 0 },
        'site.salt-flats': { favor: 2, secrets: 1 }
    }

    it('R-2.8.2, R-1.4 — places the site’s favor and secrets, favor from the bank', () => {
        const { game, vault, state } = ready()
        const playerId = state.turnManager.turnOrder[0]
        const hydrated = new HydratedOathGameState(state)
        const destination = facedownDestination(state)

        // Taken from the cards not dealt faceup, so the board never holds the same site twice.
        const faceup = new Set(hydrated.faceupSiteIds().map((id) => hydrated.siteCardAt(id)))
        const cardId = Object.keys(PROMPTING_SITES).find((id) => !faceup.has(id))
        expect(cardId, 'all three prompting sites were dealt faceup').toBeDefined()
        assertExists(cardId, 'all three prompting sites were dealt faceup')
        vault.siteFacedown[destination] = cardId

        const expected = PROMPTING_SITES[cardId]
        const bankBefore = state.favorSupply

        const { updatedState } = engine.runNext(buildAction(Travel, { playerId, siteId: destination }), state, game)

        const after = new HydratedOathGameState(updatedState)
        expect(after.tokensOn(cardId)).toEqual(expected)
        expect(after.favorSupply).toBe(bankBefore - expected.favor)
    })

    it('reads nothing and stays undoable when the destination is already faceup', () => {
        const { game, state } = ready()
        const playerId = state.turnManager.turnOrder[0]
        const hydrated = new HydratedOathGameState(state)
        const faceup = hydrated
            .faceupSiteIds()
            .find((id) => id !== hydrated.getPlayerState(playerId).siteId)
        assertExists(faceup, 'the deal leaves a faceup site the pawn is not on')

        const { processedActions } = engine.runNext(buildAction(Travel, { playerId, siteId: faceup }), state, game)
        expect(processedActions[0].revealsInfo).toBe(false)
    })

    it('replays from its recorded form and reveals identically', () => {
        const { game, state } = ready()
        const playerId = state.turnManager.turnOrder[0]
        const destination = facedownDestination(state)

        const before = structuredClone(state)
        const { updatedState, processedActions } = engine.runNext(buildAction(Travel, { playerId, siteId: destination }), state, game)

        const replayed = engine.run(
            structuredClone(processedActions[0]),
            before,
            game,
            RunMode.Single
        )
        expect(replayed.updatedState).toEqual(updatedState)
    })
})
