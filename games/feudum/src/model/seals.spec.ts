import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ChickenSpaces, type ChickenSpaceId } from '../data/guilds.js'
import type { SealId } from '../data/seals.js'
import { canonicalOf, initialState } from '../testing/state.js'
import { conservationBreaks } from './conservation.js'
import type { HydratedFeudumGameState } from './gameState.js'
import {
    beadToSeal,
    flipSeal,
    immunityKey,
    moveConcealedSeal,
    type BeadPlace,
    type ConcealedSealSource
} from './seals.js'

/** R-1.4.5 Scroll spaces setup leaves empty. */
const SCROLL = 'guild.noble.scroll.r1c2'
const OTHER_SCROLL = 'guild.noble.scroll.r2c1'
const SPACE = 'space.sea.1'

/** R-5-H1 The canonical validator agrees on every seal and every public count of one. */
function expectConsistent(state: HydratedFeudumGameState) {
    const breaks = conservationBreaks(canonicalOf(state))
    expect(breaks.filter((broken) => broken.component === 'seals')).toEqual([])
}

function emptyChicken(state: HydratedFeudumGameState): ChickenSpaceId {
    const space = ChickenSpaces.find(({ id }) => state.guilds.farmer.chickens[id] === null)
    assertExists(space, 'A chicken is empty')
    return space.id
}

/** The first seal of the pile, before it moves. */
function pileTop(state: HydratedFeudumGameState): SealId {
    return state.requireVault().sealPile[0]
}

/** A game whose protected stream is live, as the engine starts one. */
function stateWithProtectedStream(): HydratedFeudumGameState {
    const state = initialState()
    state.systemVersion = 3
    state.protectedPrng = { seed: 7, invocations: 0 }
    return state
}

describe('concealed seals by place', () => {
    it('R-5-H1 a pile draw takes the top onto a scroll: identity in the vault, occupancy public', () => {
        const state = initialState()
        const top = pileTop(state)
        const count = state.supply.sealPileCount

        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })

        expect(state.requireVault().sealPile).not.toContain(top)
        expect(state.supply.sealPileCount).toBe(count - 1)
        expect(state.requireVault().scrollSeals[SCROLL]).toBe(top)
        expect(state.guilds.noble.scrolls[SCROLL]).toBe(true)
        expectConsistent(state)
    })

    it('R-5-H1 a scroll seal goes to a player: the scroll empties, the count rises', () => {
        const state = initialState()
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })
        const seal = state.requireVault().scrollSeals[SCROLL]

        moveConcealedSeal(
            state,
            { kind: 'scroll', spaceId: SCROLL },
            { kind: 'held', playerId: 'p1' }
        )

        expect(Object.hasOwn(state.requireVault().scrollSeals, SCROLL)).toBe(false)
        expect(state.guilds.noble.scrolls[SCROLL]).toBe(false)
        expect(state.requireVault().heldSeals.p1).toEqual([seal])
        expect(state.getPlayerState('p1').sealCount).toBe(1)
        expectConsistent(state)
    })

    it('R-4.4.3 a held seal goes on a charter: the sealed-charter count rises', () => {
        const state = initialState()
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId: 'p1' })
        const seal = state.requireVault().heldSeals.p1[0]

        moveConcealedSeal(
            state,
            { kind: 'held', playerId: 'p1' },
            { kind: 'charter', playerId: 'p1' }
        )

        const player = state.getPlayerState('p1')
        expect(state.requireVault().heldSeals.p1).toEqual([])
        expect(player.sealCount).toBe(0)
        expect(state.requireVault().charterSeals.p1).toEqual([seal])
        expect(player.sealedCharterCount).toBe(1)
        expectConsistent(state)
    })

    it('R-3.14.2 a pile seal goes under a serf and comes back to its owner', () => {
        const state = initialState()
        state.spaces[SPACE].serf = { playerId: 'p2' }
        const top = pileTop(state)
        const place: ConcealedSealSource = { kind: 'immunity', spaceId: SPACE, role: 'serf' }

        moveConcealedSeal(state, { kind: 'pile' }, place)

        expect(state.requireVault().immunitySeals[immunityKey(SPACE, 'serf')]).toBe(top)
        expect(state.spaces[SPACE].serf?.immune).toBe(true)
        expectConsistent(state)

        moveConcealedSeal(state, place, { kind: 'held', playerId: 'p2' })

        expect(state.requireVault().immunitySeals).toEqual({})
        expect(state.spaces[SPACE].serf).toEqual({ playerId: 'p2' })
        expect(state.requireVault().heldSeals.p2).toEqual([top])
        expectConsistent(state)
    })

    it('R-3.14.2 a pile seal goes under a subject and comes back to its owner', () => {
        const state = initialState()
        state.spaces[SPACE].ruler = { playerId: 'p2', subject: true }
        const place: ConcealedSealSource = { kind: 'immunity', spaceId: SPACE, role: 'subject' }

        moveConcealedSeal(state, { kind: 'pile' }, place)
        expect(state.spaces[SPACE].ruler?.subjectImmune).toBe(true)

        moveConcealedSeal(state, place, { kind: 'held', playerId: 'p2' })
        expect(state.spaces[SPACE].ruler).toEqual({ playerId: 'p2', subject: true })
    })

    it('R-3.14.2 a seal needs a marker to lie under', () => {
        const state = initialState()
        expect(() =>
            moveConcealedSeal(
                state,
                { kind: 'pile' },
                { kind: 'immunity', spaceId: SPACE, role: 'serf' }
            )
        ).toThrow()
    })

    it('R-5-H1 a place with no seal gives none, and a full scroll takes none', () => {
        const state = initialState()
        expect(() =>
            moveConcealedSeal(
                state,
                { kind: 'scroll', spaceId: SCROLL },
                { kind: 'held', playerId: 'p1' }
            )
        ).toThrow()
        expect(() =>
            moveConcealedSeal(
                state,
                { kind: 'held', playerId: 'p1' },
                { kind: 'scroll', spaceId: SCROLL }
            )
        ).toThrow()

        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })
        expect(() =>
            moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })
        ).toThrow()

        state.requireVault().sealPile = []
        state.supply.sealPileCount = 0
        expect(() =>
            moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: OTHER_SCROLL })
        ).toThrow()
    })

    it('R-5-H1 public state names no concealed seal', () => {
        const state = initialState()
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId: 'p1' })
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId: 'p1' })
        moveConcealedSeal(
            state,
            { kind: 'held', playerId: 'p1' },
            { kind: 'charter', playerId: 'p1' }
        )

        const { vault, ...publicState } = canonicalOf(state)
        const named = JSON.stringify(publicState)
        const concealed = [
            ...vault.sealPile,
            ...Object.values(vault.scrollSeals),
            ...Object.values(vault.heldSeals).flat(),
            ...Object.values(vault.charterSeals).flat(),
            ...Object.values(vault.immunitySeals)
        ]
        expect(concealed).toContain(state.requireVault().heldSeals.p1[0])
        expect(concealed).toContain(state.requireVault().charterSeals.p1[0])
        for (const sealId of concealed) {
            expect(named).not.toContain(`"${sealId}"`)
        }
    })
})

describe('a flip', () => {
    it('R-4.6.5 moves a scroll seal identity onto the rosary, public', () => {
        const state = initialState()
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: SCROLL })
        const seal = state.requireVault().scrollSeals[SCROLL]

        expect(flipSeal(state, { kind: 'scroll', spaceId: SCROLL }, { kind: 'rosary' })).toBe(seal)

        expect(state.guilds.monk.rosary).toContain(seal)
        expect(Object.hasOwn(state.requireVault().scrollSeals, SCROLL)).toBe(false)
        expect(state.guilds.noble.scrolls[SCROLL]).toBe(false)
        expectConsistent(state)
    })

    it('R-4.4.2 moves the pile top to a player as a bead', () => {
        const state = initialState()
        const top = pileTop(state)
        const count = state.supply.sealPileCount

        expect(flipSeal(state, { kind: 'pile' }, { kind: 'player', playerId: 'p1' })).toBe(top)

        expect(state.getPlayerState('p1').beads).toEqual([top])
        expect(state.requireVault().sealPile).not.toContain(top)
        expect(state.supply.sealPileCount).toBe(count - 1)
        expectConsistent(state)
    })

    it('R-1.4.5 moves the pile top onto an empty chicken, and no other', () => {
        const state = initialState()
        const top = pileTop(state)
        const space = emptyChicken(state)

        expect(flipSeal(state, { kind: 'pile' }, { kind: 'chicken', space })).toBe(top)

        expect(state.guilds.farmer.chickens[space]).toBe(top)
        expectConsistent(state)
        expect(() => flipSeal(state, { kind: 'pile' }, { kind: 'chicken', space })).toThrow()
    })
})

describe('a bead going back', () => {
    it('R-3.11.2 a held bead flips back to a held seal, its identity in the vault', () => {
        const state = initialState()
        const place: BeadPlace = { kind: 'player', playerId: 'p1' }
        const bead = flipSeal(state, { kind: 'pile' }, place)

        beadToSeal(state, bead, place, { kind: 'held', playerId: 'p1' })

        const player = state.getPlayerState('p1')
        expect(player.beads).toEqual([])
        expect(player.sealCount).toBe(1)
        expect(state.requireVault().heldSeals.p1).toEqual([bead])
        expectConsistent(state)
    })

    it('R-5-H1 a bead that is not there cannot go back', () => {
        const state = initialState()
        const concealed = pileTop(state)
        expect(() =>
            beadToSeal(state, concealed, { kind: 'rosary' }, { kind: 'held', playerId: 'p1' })
        ).toThrow()
        expect(() =>
            beadToSeal(
                state,
                concealed,
                { kind: 'chicken', space: emptyChicken(state) },
                { kind: 'pile' }
            )
        ).toThrow()
    })

    it('R-3.13.2 a chicken bead returns to the pile and empties the chicken', () => {
        const state = stateWithProtectedStream()
        const count = state.supply.sealPileCount
        const space = emptyChicken(state)
        const bead = flipSeal(state, { kind: 'pile' }, { kind: 'chicken', space })

        beadToSeal(state, bead, { kind: 'chicken', space }, { kind: 'pile' })

        expect(state.guilds.farmer.chickens[space]).toBeNull()
        expect(state.requireVault().sealPile).toContain(bead)
        expect(state.supply.sealPileCount).toBe(count)
        expectConsistent(state)
    })
})

describe('a return to the pile', () => {
    it('R-5-H1 reshuffles it from the protected stream, leaving the public stream alone', () => {
        const state = stateWithProtectedStream()
        const bead = flipSeal(state, { kind: 'pile' }, { kind: 'rosary' })
        const before = [...state.requireVault().sealPile, bead]
        const publicCursor = state.prng.invocations
        const protectedCursor = state.protectedPrng?.invocations ?? 0

        beadToSeal(state, bead, { kind: 'rosary' }, { kind: 'pile' })

        const after = state.requireVault().sealPile
        expect(after).not.toEqual(before)
        expect([...after].sort()).toEqual([...before].sort())
        expect(state.prng.invocations).toBe(publicCursor)
        expect(state.protectedPrng?.invocations ?? 0).toBeGreaterThan(protectedCursor)
    })

    it('R-3.9.1 a held seal returning reshuffles too', () => {
        const state = stateWithProtectedStream()
        const count = state.supply.sealPileCount
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId: 'p1' })
        const protectedCursor = state.protectedPrng?.invocations ?? 0

        moveConcealedSeal(state, { kind: 'held', playerId: 'p1' }, { kind: 'pile' })

        expect(state.protectedPrng?.invocations ?? 0).toBeGreaterThan(protectedCursor)
        expect(state.getPlayerState('p1').sealCount).toBe(0)
        expect(state.supply.sealPileCount).toBe(count)
        expectConsistent(state)
    })

    it('R-5-H1 reshuffles the same way from the same seed', () => {
        function reshuffled(): SealId[] {
            const state = stateWithProtectedStream()
            const bead = flipSeal(state, { kind: 'pile' }, { kind: 'rosary' })
            beadToSeal(state, bead, { kind: 'rosary' }, { kind: 'pile' })
            return state.requireVault().sealPile
        }
        expect(reshuffled()).toEqual(reshuffled())
    })
})
