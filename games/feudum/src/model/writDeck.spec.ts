import { describe, expect, it } from 'vitest'
import { RoyalWrits, type WritId } from '../data/writs.js'
import { initialState } from '../testing/state.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { drawWrits, putWritsUnderInView, putWritsUnderUnseen, writDeckCount } from './writDeck.js'

const writIds = RoyalWrits.map((writ) => writ.id)

/** A deck in a known order, top first. */
function stateWithDeck(deck: readonly WritId[]): HydratedFeudumGameState {
    const state = initialState()
    state.requireVault().writDeck = deck.map((writId, slot) => ({ slot, writId }))
    state.writDeck = { top: 0, nextBottom: deck.length }
    return state
}

describe('the writ deck as a slot queue', () => {
    it('R-5.1 a draw takes slot top and increments it', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first, second, third])

        expect(drawWrits(state, 1)).toEqual([first])
        expect(state.writDeck.top).toBe(1)
        expect(state.requireVault().writDeck).toEqual([
            { slot: 1, writId: second },
            { slot: 2, writId: third }
        ])
    })

    it('R-5.1 a writ going under takes nextBottom and increments it', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first, second])

        putWritsUnderInView(state, [third])

        expect(state.writDeck.nextBottom).toBe(3)
        expect(state.requireVault().writDeck.at(-1)).toEqual({ slot: 2, writId: third })
    })

    it('R-5.1 the count is nextBottom less top', () => {
        const [first, second, third, fourth] = writIds
        const state = stateWithDeck([first, second, third])
        expect(writDeckCount(state)).toBe(3)

        drawWrits(state, 2)
        expect(writDeckCount(state)).toBe(1)

        putWritsUnderInView(state, [fourth])
        expect(writDeckCount(state)).toBe(2)
        expect(state.requireVault().writDeck).toHaveLength(writDeckCount(state))
    })

    it('R-5.1 a writ that goes under comes back after the rest of the deck', () => {
        const [first, second] = writIds
        const state = stateWithDeck([first, second])

        const [drawn] = drawWrits(state, 1)
        putWritsUnderInView(state, [drawn])

        expect(drawWrits(state, 2)).toEqual([second, first])
    })
})

describe('writs going under', () => {
    it('R-4.4.2, R-4.4.4 in view enters publicDeckWrits with its slot', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first])

        putWritsUnderInView(state, [second, third])

        expect(state.publicDeckWrits).toEqual([
            { slot: 1, writId: second },
            { slot: 2, writId: third }
        ])
        for (const player of state.players) {
            expect(player.deckKnowledge).toEqual([])
        }
    })

    it('R-4.4-H3, R-4.4.1 unkept writs enter the drawer deckKnowledge in the order drawn', () => {
        const [first, second, third, fourth] = writIds
        const state = stateWithDeck([first, second])

        putWritsUnderUnseen(state, 'p2', [fourth, third])

        expect(state.getPlayerState('p2').deckKnowledge).toEqual([
            { slot: 2, writId: fourth },
            { slot: 3, writId: third }
        ])
        expect(state.requireVault().writDeck.slice(2)).toEqual([
            { slot: 2, writId: fourth },
            { slot: 3, writId: third }
        ])
        expect(state.getPlayerState('p1').deckKnowledge).toEqual([])
        expect(state.publicDeckWrits).toEqual([])
    })

    it('R-5-H1 keeps the public and owner-known rows apart from the vault row', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first])

        putWritsUnderInView(state, [second])
        putWritsUnderUnseen(state, 'p1', [third])
        state.publicDeckWrits[0].slot = 99
        state.getPlayerState('p1').requireDeckKnowledge()[0].slot = 99

        expect(state.requireVault().writDeck.map(({ slot }) => slot)).toEqual([0, 1, 2])
    })
})

describe('known positions when their writ is drawn', () => {
    it('R-4.4.2 a public entry drops when its writ is drawn, and not before', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first])
        putWritsUnderInView(state, [second, third])

        drawWrits(state, 1)
        expect(state.publicDeckWrits).toHaveLength(2)

        drawWrits(state, 1)
        expect(state.publicDeckWrits).toEqual([{ slot: 2, writId: third }])

        drawWrits(state, 1)
        expect(state.publicDeckWrits).toEqual([])
    })

    it('R-4.4.1 a deckKnowledge entry drops when its writ is drawn by anyone', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first])
        putWritsUnderUnseen(state, 'p1', [second])
        putWritsUnderUnseen(state, 'p2', [third])

        drawWrits(state, 1)
        expect(state.getPlayerState('p1').deckKnowledge).toEqual([{ slot: 1, writId: second }])

        drawWrits(state, 1)
        expect(state.getPlayerState('p1').deckKnowledge).toEqual([])
        expect(state.getPlayerState('p2').deckKnowledge).toEqual([{ slot: 2, writId: third }])
    })

    it('R-4.4.1 a known slot needs no rewriting while others draw ahead of it', () => {
        const [first, second, third] = writIds
        const state = stateWithDeck([first, second])
        putWritsUnderUnseen(state, 'p3', [third])

        drawWrits(state, 2)

        expect(state.getPlayerState('p3').deckKnowledge).toEqual([{ slot: 2, writId: third }])
        expect(state.writDeck.top).toBe(2)
    })
})

describe('a short deck', () => {
    it('R-4.4-H2 a draw larger than the deck draws what is there', () => {
        const [first, second] = writIds
        const state = stateWithDeck([first, second])

        expect(drawWrits(state, 3)).toEqual([first, second])
        expect(writDeckCount(state)).toBe(0)
        expect(state.requireVault().writDeck).toEqual([])
        expect(state.writDeck).toEqual({ top: 2, nextBottom: 2 })
    })

    it('R-4.4-H2 an empty deck draws nothing', () => {
        const state = stateWithDeck([])

        expect(drawWrits(state, 2)).toEqual([])
        expect(state.writDeck).toEqual({ top: 0, nextBottom: 0 })
    })

    it('R-4.4-H2 a deck drawn empty fills again from the bottom', () => {
        const [first, second] = writIds
        const state = stateWithDeck([first])
        drawWrits(state, 1)

        putWritsUnderInView(state, [second])

        expect(state.writDeck).toEqual({ top: 1, nextBottom: 2 })
        expect(drawWrits(state, 1)).toEqual([second])
    })
})
