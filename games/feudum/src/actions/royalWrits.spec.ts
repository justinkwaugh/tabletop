import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { drawWrits, writDeckCount } from '../model/writDeck.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { discardWritOffers, reasonDiscardWritRefused } from './discardWrit.js'
import { keepWritsOffer, reasonKeepWritsRefused } from './keepWrits.js'

const OUTPOST: SpaceId = 'space.forest.1'
const FEUDUM: SpaceId = 'space.forest.3'
const HAND: ActionCardKind[] = ['explore', 'migrate', 'guild']

const NOT_ASKED = 'No writ draw waits on you.'
const NOT_DRAWN = 'Keep only writs you drew.'
const NOT_HELD = "You don't hold that writ."

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const spectator = { kind: 'spectator' } as const

/** The turn player rules enough to draw `count` with Explore, and has drawn them. */
function afterDraw(
    count = 2,
    edit?: (state: HydratedFeudumGameState, playerId: string) => void
): { table: Table; playerId: string; drawn: WritId[] } {
    const table = tableAtPlayingCards(() => ({ cards: HAND }))
    const playerId = table.asked
    table.moveTo((state) => {
        const player = state.getPlayerState(playerId)
        state.spaces[OUTPOST].location.kind = 'outpost'
        state.spaces[OUTPOST].ruler = { playerId, subject: false }
        player.influenceSupply -= 1
        if (count > 2) {
            state.spaces[FEUDUM].location.kind = 'feudum'
            state.spaces[FEUDUM].ruler = { playerId, subject: false }
            player.influenceSupply -= 1
        }
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    table.send(playerId, { type: ActionType.Explore, revealsInfo: true })
    const drawn = table.hydrated().flow.writDraw?.drawn ?? []
    expect(drawn.length).toBeGreaterThan(0)
    return { table, playerId, drawn }
}

/** The turn player holds these many writs, off the top of the deck. */
function holding(count: number): { table: Table; playerId: string; held: WritId[] } {
    const table = tableAtPlayingCards(() => ({ cards: HAND }))
    const playerId = table.asked
    let held: WritId[] = []
    table.moveTo((state) => {
        held = drawWrits(state, count)
        const player = state.getPlayerState(playerId)
        player.requireWrits().push(...held)
        player.writCount = held.length
        return MachineState.PlayingCards
    })
    return { table, playerId, held }
}

function shortenDeckTo(state: HydratedFeudumGameState, count: number) {
    const vault = state.requireVault()
    const removed = vault.writDeck.length - count
    vault.writDeck.splice(0, removed)
    state.writDeck.top += removed
}

describe('KeepWrits', () => {
    it('R-4.4.1 is refused for a seat with no draw waiting', () => {
        const { table, drawn } = afterDraw()
        const other = table.order[1]
        expect(reasonKeepWritsRefused(table.hydrated(), other, { keep: [drawn[0]] })).toBe(
            NOT_ASKED
        )
        expect(() => table.send(other, { type: ActionType.KeepWrits, keep: [drawn[0]] })).toThrow()
        expect(keepWritsOffer(table.hydrated(), other)).toBeUndefined()
    })

    it('R-4.4.1 is refused for any number but the stated one', () => {
        const { table, playerId, drawn } = afterDraw()
        expect(reasonKeepWritsRefused(table.hydrated(), playerId, { keep: [] })).toBe(
            'Keep 1 writ, not 0.'
        )
        expect(reasonKeepWritsRefused(table.hydrated(), playerId, { keep: drawn })).toBe(
            'Keep 1 writ, not 2.'
        )
        expect(() => table.send(playerId, { type: ActionType.KeepWrits, keep: drawn })).toThrow(
            'Keep 1 writ, not 2.'
        )
    })

    it('R-4.4.1 is refused for a writ not drawn', () => {
        const { table, playerId, drawn } = afterDraw()
        const inDeck = table.hydrated().requireVault().writDeck[0].writId
        expect(reasonKeepWritsRefused(table.hydrated(), playerId, { keep: [inDeck] })).toBe(
            NOT_DRAWN
        )
        expect(() => table.send(playerId, { type: ActionType.KeepWrits, keep: [inDeck] })).toThrow(
            NOT_DRAWN
        )
        expect(drawn).not.toContain(inDeck)
    })

    it('R-4.4.1 is refused for the same writ twice', () => {
        const { table, playerId, drawn } = afterDraw(3)
        table.moveTo((state) => {
            if (state.flow.writDraw) {
                state.flow.writDraw.keep = 2
            }
            return MachineState.KeepingWrits
        })
        expect(
            reasonKeepWritsRefused(table.hydrated(), playerId, { keep: [drawn[0], drawn[0]] })
        ).toBe(NOT_DRAWN)
    })

    it('R-4.4.1 keeps the writ, clears the draw and passes the turn; no barrier', () => {
        const { table, playerId, drawn } = afterDraw()
        const deck = writDeckCount(table.hydrated())
        const slot = table.hydrated().writDeck.nextBottom

        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[1]] })

        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(action.revealsInfo).toBeFalsy()
        expect(player.writs).toEqual([drawn[1]])
        expect(player.writCount).toBe(1)
        expect(state.flow.writDraw).toBeUndefined()
        expect(state.flow.turn?.playerId).not.toBe(playerId)
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(writDeckCount(state)).toBe(deck + 1)
        expect(player.deckKnowledge).toEqual([{ slot, writId: drawn[0] }])
        expect(state.publicDeckWrits).toEqual([])
        expect(action).toMatchObject({
            keep: [drawn[1]],
            metadata: {
                keptCount: 1,
                returnedCount: 1,
                returned: [{ slot, writId: drawn[0] }]
            }
        })
        expect(action).not.toHaveProperty('metadata.drawnWritIds')
    })

    it('R-4.4-H3 the rest go under in the order drawn, each with its slot', () => {
        const { table, playerId, drawn } = afterDraw(3)
        expect(drawn).toHaveLength(3)
        const slot = table.hydrated().writDeck.nextBottom

        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[1]] })

        const returned = [
            { slot, writId: drawn[0] },
            { slot: slot + 1, writId: drawn[2] }
        ]
        expect(table.seat(playerId).deckKnowledge).toEqual(returned)
        expect(action).toMatchObject({ metadata: { keptCount: 1, returnedCount: 2, returned } })
        const vault = table.hydrated().requireVault()
        expect(vault.writDeck.slice(-2)).toEqual(returned)
    })

    it('R-4.4-H2 fewer drawn than stated: keeps all drawn, none going under', () => {
        const { table, playerId, drawn } = afterDraw(2, (state) => {
            shortenDeckTo(state, 1)
        })
        expect(drawn).toHaveLength(1)
        expect(table.hydrated().flow.writDraw).toMatchObject({ drawnCount: 1, keep: 1 })

        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: drawn })

        expect(action).toMatchObject({
            metadata: { keptCount: 1, returnedCount: 0, returned: [] }
        })
        expect(table.seat(playerId).writs).toEqual(drawn)
        expect(table.seat(playerId).deckKnowledge).toEqual([])
    })

    it('R-3.2 the card’s other follow-ups run after the keep', () => {
        const { table, playerId, drawn } = afterDraw()
        table.moveTo((state) => {
            queueFollowUp(state, { kind: 'voyage', playerId })
            return MachineState.KeepingWrits
        })

        table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[0]] })

        expect(table.hydrated().machineState).toBe(MachineState.PlacingDisc)
        expect(table.hydrated().flow.turn?.followUps).toEqual([{ kind: 'voyage', playerId }])
        expect(table.asked).toBe(playerId)
    })

    it('R-3.3-H1 a declared second card is still owed after the keep', () => {
        const table = tableAtPlayingCards(() => ({ cards: HAND, pouchGood: 'sulfur' }))
        const playerId = table.asked
        table.moveTo((state) => {
            state.spaces[OUTPOST].location.kind = 'outpost'
            state.spaces[OUTPOST].ruler = { playerId, subject: false }
            state.getPlayerState(playerId).influenceSupply -= 1
            state.recomputeRanks()
            return MachineState.PlayingCards
        })
        table.send(playerId, { type: ActionType.Explore, revealsInfo: true, secondCard: true })
        const drawn = table.hydrated().flow.writDraw?.drawn ?? []

        table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[0]] })

        const state = table.hydrated()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(state.flow.turn).toMatchObject({ playerId, secondCard: true, followUps: [] })
    })

    it('R-3.7.5 a voyage draw is kept the same way, with no Shovels & Swords', () => {
        const table = tableAtPlayingCards(() => ({ cards: HAND }))
        const playerId = table.asked
        table.moveTo((state) => {
            state.voyageTrack[playerId] = 1
            queueFollowUp(state, { kind: 'voyage', playerId })
            return MachineState.PlacingDisc
        })
        table.send(playerId, { type: ActionType.PlaceDisc, place: true })
        const drawn = table.hydrated().flow.writDraw?.drawn ?? []
        expect(table.hydrated().flow.writDraw).toMatchObject({ source: 'voyage', keep: 1 })
        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toBeUndefined()

        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[0]] })

        expect(action.revealsInfo).toBeFalsy()
        expect(table.seat(playerId).writs).toEqual([drawn[0]])
    })

    it('R-5.1 what was kept and returned is the actor’s; the counts are public', () => {
        const { table, playerId, drawn } = afterDraw()
        const [action] = table.send(playerId, { type: ActionType.KeepWrits, keep: [drawn[0]] })

        expect(
            actionProjector.project(action, { kind: 'player', playerId }, { config: {} })
        ).toMatchObject({ keep: [drawn[0]], metadata: { returned: [{ writId: drawn[1] }] } })
        for (const perspective of [
            { kind: 'player', playerId: table.order[1] } as const,
            spectator
        ]) {
            const projected = actionProjector.project(action, perspective, { config: {} })
            expect(projected).toMatchObject({ metadata: { keptCount: 1, returnedCount: 1 } })
            expect(projected).not.toHaveProperty('keep')
            expect(projected).not.toHaveProperty('metadata.returned')
            expect(JSON.stringify(projected)).not.toContain(drawn[0])
            expect(JSON.stringify(projected)).not.toContain(drawn[1])
        }
    })
})

describe('DiscardWrit', () => {
    it('R-4.4.4 is offered to the turn player holding a writ, and not otherwise', () => {
        const { table, playerId, held } = holding(2)
        expect(table.offered(playerId)).toContain(ActionType.DiscardWrit)
        expect(table.offered(table.order[1])).not.toContain(ActionType.DiscardWrit)
        expect(discardWritOffers(table.hydrated(), playerId)).toEqual(held)
        expect(discardWritOffers(table.hydrated(), table.order[1])).toEqual([])
        const empty = holding(0)
        expect(empty.table.offered(empty.playerId)).not.toContain(ActionType.DiscardWrit)
    })

    it('R-4.4.4 is refused out of turn', () => {
        const { table, held } = holding(1)
        const other = table.order[1]
        table.moveTo((state) => {
            state.getPlayerState(other).requireWrits().push(held[0])
            state.getPlayerState(other).writCount = 1
            return MachineState.PlayingCards
        })
        expect(reasonDiscardWritRefused(table.hydrated(), other, held[0])).toBe(
            "It isn't your turn."
        )
        expect(() => table.send(other, { type: ActionType.DiscardWrit, writId: held[0] })).toThrow()
    })

    it('R-4.4.4 is refused for a writ not held', () => {
        const { table, playerId } = holding(1)
        const inDeck = table.hydrated().requireVault().writDeck[0].writId
        expect(reasonDiscardWritRefused(table.hydrated(), playerId, inDeck)).toBe(NOT_HELD)
        expect(() =>
            table.send(playerId, { type: ActionType.DiscardWrit, writId: inDeck })
        ).toThrow(NOT_HELD)
    })

    it('R-4.4-H5 is refused for a sealed charter: only an unsealed writ is discarded', () => {
        const { table, playerId, held } = holding(1)
        table.moveTo((state) => {
            const player = state.getPlayerState(playerId)
            player.requireWrits().length = 0
            player.writCount = 0
            player.requireSealedCharters().push(held[0])
            player.sealedCharterCount = 1
            return MachineState.PlayingCards
        })
        expect(reasonDiscardWritRefused(table.hydrated(), playerId, held[0])).toBe(NOT_HELD)
    })

    it('R-4.4.4 puts the writ under the deck in view, costing no turn and no barrier', () => {
        const { table, playerId, held } = holding(2)
        const deck = writDeckCount(table.hydrated())
        const slot = table.hydrated().writDeck.nextBottom

        const [action] = table.send(playerId, { type: ActionType.DiscardWrit, writId: held[0] })

        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(action.revealsInfo).toBeFalsy()
        expect(player.writs).toEqual([held[1]])
        expect(player.writCount).toBe(1)
        expect(writDeckCount(state)).toBe(deck + 1)
        expect(state.requireVault().writDeck.at(-1)).toEqual({ slot, writId: held[0] })
        expect(state.publicDeckWrits).toEqual([{ slot, writId: held[0] }])
        expect(player.deckKnowledge).toEqual([])
        expect(action).toMatchObject({ writId: held[0], metadata: { slot } })
        // R-3.2-H2 The turn is still this seat's, with no card played.
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(state.flow.turn?.playerId).toBe(playerId)
        expect(player.handCount).toBe(HAND.length)
    })

    it('R-4.4.4, R-5.1 a discard is shown: every field is public', () => {
        const { table, playerId, held } = holding(1)
        const [action] = table.send(playerId, { type: ActionType.DiscardWrit, writId: held[0] })
        expect(actionProjector.project(action, spectator, { config: {} })).toMatchObject({
            writId: held[0],
            metadata: { slot: expect.any(Number) }
        })
    })
})
