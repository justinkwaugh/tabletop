import { describe, expect, it } from 'vitest'
import { ExplorationHistory, GameStatus, GameStorage, assert, deriveGameSeeds } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { OathRuntime } from './runtime.js'
import { OathGameStateValidator, type OathGameState } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import { testGame } from '../testing/game.js'

// R-9.4
const history = new ExplorationHistory(engine)
const MASTER_SEED = '0123456789abcdef0123456789abcdef'

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

function source(): OathGameState {
    const game = testGame(['p1', 'p2', 'p3'], { status: GameStatus.WaitingToStart, hotseat: true, createdAt: new Date(0), storage: GameStorage.Local })
    const state = canonical(engine.startGame(game, { masterSeed: MASTER_SEED }).initialState)
    state.vault.discardPiles[Region.Cradle] = ['denizen.beast.wolves', 'denizen.hearth.wayside-inn', 'vision.faith']
    state.vault.dispossessed = ['denizen.nomad.tents', 'denizen.order.scouts', 'denizen.arcane.tutor']
    return state
}

/** The protected seed is pinned so each run is repeatable. */
function explore(state: OathGameState, branchSeed = 'fedcba9876543210fedcba9876543210'): OathGameState {
    const prepared = history.prepareState(state)
    prepared.protectedPrng = { algorithm: 'chacha20-v1', seed: deriveGameSeeds(branchSeed).protectedSeed, invocations: 0 }
    return canonical(OathRuntime.exploration.createFromCanonicalState(prepared))
}

const BRANCH_SEEDS = ['00000000000000000000000000000001', '00000000000000000000000000000002', '00000000000000000000000000000003', '00000000000000000000000000000004']

const sorted = (ids: readonly string[]) => [...ids].sort()

describe('Exploration from canonical state (R-9.4)', () => {
    it('is registered on the runtime, and leaves the source untouched', () => {
        const state = source()
        const before = structuredClone(state)
        explore(state)
        expect(state).toEqual(before)
    })

    it('holds the same cards in every hidden list, in an order the source cannot foretell', () => {
        const state = source()
        const branch = explore(state)
        expect(sorted(branch.vault.worldDeck)).toEqual(sorted(state.vault.worldDeck))
        expect(branch.vault.worldDeck).not.toEqual(state.vault.worldDeck)
        expect(sorted(branch.vault.discardPiles[Region.Cradle])).toEqual(sorted(state.vault.discardPiles[Region.Cradle]))
        expect(sorted(branch.vault.dispossessed)).toEqual(sorted(state.vault.dispossessed))
        expect(sorted([...Object.values(branch.vault.relicFacedown), ...branch.vault.relicDeck])).toEqual(sorted([...Object.values(state.vault.relicFacedown), ...state.vault.relicDeck]))
        expect(sorted([...Object.values(branch.vault.siteFacedown), ...branch.vault.siteDeck])).toEqual(sorted([...Object.values(state.vault.siteFacedown), ...state.vault.siteDeck]))
    })

    it('re-deals the facedown sites and relics rather than keeping the real ones', () => {
        const state = source()
        const branch = explore(state)
        expect(Object.keys(branch.vault.siteFacedown)).toEqual(Object.keys(state.vault.siteFacedown))
        expect(Object.keys(branch.vault.relicFacedown)).toEqual(Object.keys(state.vault.relicFacedown))
        expect(branch.vault.siteFacedown).not.toEqual(state.vault.siteFacedown)
        expect(branch.vault.relicFacedown).not.toEqual(state.vault.relicFacedown)
    })

    it('keeps the public top backs, and every Vision above the Vision-free tail (R-8.8)', () => {
        const state = source()
        for (const seed of BRANCH_SEEDS) {
            const branch = explore(state, seed)
            expect(kindOf(branch.vault.worldDeck[0])).toBe(kindOf(state.vault.worldDeck[0]))
            expect(kindOf(branch.vault.discardPiles[Region.Cradle][0])).toBe(CardKind.Denizen)
            const reach = state.vault.worldDeck.findLastIndex((id) => kindOf(id) === CardKind.Vision)
            expect(branch.vault.worldDeck.findLastIndex((id) => kindOf(id) === CardKind.Vision)).toBeLessThanOrEqual(reach)
        }
    })

    it('a relic someone has peeked at stays the relic they saw', () => {
        const state = source()
        const [slotId] = Object.keys(state.vault.relicFacedown)
        state.players[1].peekedRelicSlotIds = [slotId]
        state.players[1].peekedRelics = { [slotId]: state.vault.relicFacedown[slotId] }
        for (const seed of BRANCH_SEEDS) {
            expect(explore(state, seed).vault.relicFacedown[slotId]).toBe(state.vault.relicFacedown[slotId])
        }
    })

    it('changes nothing a player can see: hands, advisers and the public board', () => {
        const state = source()
        const branch = explore(state)
        expect(branch.players).toEqual(state.players)
        expect(branch.siteCards).toEqual(state.siteCards)
        expect(branch.relicsBySite).toEqual(state.relicsBySite)
        expect(branch.topCardBackType).toEqual(state.topCardBackType)
        expect(branch.discardPileCounts).toEqual(state.discardPileCounts)
    })
})
