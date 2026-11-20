import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { drawWrits, writDeckCount } from '../model/writDeck.js'
import {
    alternativeOf,
    AnyTime,
    Charter,
    FarmerMandate,
    giveTile,
    KnightMandate,
    ShillingMandate,
    tableInWindow,
    VesselMandate,
    Weapon
} from '../testing/atWill.js'
import { holdWrit } from '../testing/combat.js'
import { setPawns, setSealPile } from '../testing/guilds.js'
import { giveGood, giveSeal } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { discardWritOffers, reasonDiscardWritRefused } from './discardWrit.js'
import { keepWritsOffer, reasonKeepWritsRefused } from './keepWrits.js'
import { playMandateOffers, reasonPlayMandateRefused } from './playMandate.js'
import { cardTurnSeat } from '../model/turns.js'

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
        expect(cardTurnSeat(state)).not.toBe(playerId)
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
        expect(cardTurnSeat(state)).toBe(playerId)
        expect(state.flow.turn).toMatchObject({ secondCard: true, followUps: [] })
    })

    it('R-3.7.5 a voyage draw is kept the same way, with no Shovels & Swords', () => {
        const table = tableAtPlayingCards(() => ({ cards: HAND }))
        const playerId = table.asked
        table.moveTo((state) => {
            state.voyageTrack[playerId] = 'track.voyage.1'
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
    it('R-4.4-H5 is offered to every seat holding a writ, on its turn or not', () => {
        const { table, playerId, held } = holding(2)
        const other = table.order[1]
        expect(table.offered(playerId)).toContain(ActionType.DiscardWrit)
        expect(table.offered(other)).not.toContain(ActionType.DiscardWrit)
        expect(discardWritOffers(table.hydrated(), playerId)).toEqual(held)
        expect(discardWritOffers(table.hydrated(), other)).toEqual([])
        table.moveTo((state) => {
            holdWrit(state, other, Weapon)
            return MachineState.PlayingCards
        })
        expect(table.offered(other)).toEqual([ActionType.DiscardWrit])
        expect(discardWritOffers(table.hydrated(), other)).toEqual([Weapon])
        const empty = holding(0)
        expect(empty.table.offered(empty.playerId)).not.toContain(ActionType.DiscardWrit)
    })

    it('R-4.4-H5 a seat off its turn discards at any time, and the turn stays where it was', () => {
        const { table, playerId } = holding(1)
        const other = table.order[1]
        table.moveTo((state) => {
            holdWrit(state, other, Weapon)
            return MachineState.PlayingCards
        })
        const slot = table.hydrated().writDeck.nextBottom

        table.send(other, { type: ActionType.DiscardWrit, writId: Weapon, ...AnyTime })

        const state = table.hydrated()
        expect(state.getPlayerState(other).writs).toEqual([])
        expect(state.getPlayerState(other).writCount).toBe(0)
        expect(state.getPlayerState(other).deckKnowledge).toEqual([{ slot, writId: Weapon }])
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(state.activePlayerIds).toEqual([playerId])
        expect(cardTurnSeat(state)).toBe(playerId)
    })

    it('R-4.4-H5 a discard is taken while play waits on another seat, which is still asked', () => {
        const { table, playerId } = afterDraw()
        const other = table.order.find((seat) => seat !== playerId) ?? ''
        table.moveTo((state) => {
            holdWrit(state, other, Weapon)
            return MachineState.KeepingWrits
        })

        table.send(other, { type: ActionType.DiscardWrit, writId: Weapon, ...AnyTime })

        const state = table.hydrated()
        expect(state.getPlayerState(other).writs).toEqual([])
        expect(state.machineState).toBe(MachineState.KeepingWrits)
        expect(state.activePlayerIds).toEqual([playerId])
        expect(table.offered(playerId)).toContain(ActionType.KeepWrits)
    })

    it('R-4.4-H5 a discard is sent as one taken at any time, and refused otherwise', () => {
        const { table, playerId, held } = holding(1)
        expect(() =>
            table.send(playerId, { type: ActionType.DiscardWrit, writId: held[0] })
        ).toThrow()
        expect(table.seat(playerId).writs).toEqual(held)
    })

    it('R-4.4-H5 the validity check refuses a discard the seat is not offered', () => {
        const { table, playerId, held } = holding(1)
        const other = table.order[1]
        const discard = { type: ActionType.DiscardWrit, writId: held[0], ...AnyTime }
        expect(table.accepts(playerId, discard)).toBe(true)
        expect(table.accepts(other, discard)).toBe(false)
        table.state = { ...table.state, machineState: MachineState.EndOfGame }
        expect(table.accepts(playerId, discard)).toBe(false)
    })

    it('R-4.4-H5 is refused once the game has ended', () => {
        const { table, playerId, held } = holding(1)
        const state = table.hydrated()
        state.machineState = MachineState.EndOfGame
        expect(reasonDiscardWritRefused(state, playerId, held[0])).toBe('The game is over.')
        expect(discardWritOffers(state, playerId)).toEqual([])
    })

    it('R-4.4.4 is refused for a writ not held', () => {
        const { table, playerId } = holding(1)
        const inDeck = table.hydrated().requireVault().writDeck[0].writId
        expect(reasonDiscardWritRefused(table.hydrated(), playerId, inDeck)).toBe(NOT_HELD)
        expect(() =>
            table.send(playerId, { type: ActionType.DiscardWrit, writId: inDeck, ...AnyTime })
        ).toThrow('not valid')
    })

    it('R-4.4.4, R-4.4-H8 puts the writ under the deck face down, costing no turn and no barrier', () => {
        const { table, playerId, held } = holding(2)
        const deck = writDeckCount(table.hydrated())
        const slot = table.hydrated().writDeck.nextBottom

        const [action] = table.send(playerId, {
            type: ActionType.DiscardWrit,
            writId: held[0],
            ...AnyTime
        })

        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(action.revealsInfo).toBeFalsy()
        expect(player.writs).toEqual([held[1]])
        expect(player.writCount).toBe(1)
        expect(writDeckCount(state)).toBe(deck + 1)
        expect(state.requireVault().writDeck.at(-1)).toEqual({ slot, writId: held[0] })
        // R-4.4.4 Face down: the table never sees it go under; the discarder knows its slot.
        expect(state.publicDeckWrits).toEqual([])
        expect(player.deckKnowledge).toEqual([{ slot, writId: held[0] }])
        expect(action).toMatchObject({ writId: held[0], metadata: { slot } })
        // R-3.2-H2 The turn is still this seat's, with no card played.
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(cardTurnSeat(state)).toBe(playerId)
        expect(player.handCount).toBe(HAND.length)
    })

    it('R-4.4.4, R-5.1 a discard is face down: the writ is the discarder’s, the slot public', () => {
        const { table, playerId, held } = holding(1)
        const [action] = table.send(playerId, {
            type: ActionType.DiscardWrit,
            writId: held[0],
            ...AnyTime
        })
        const other = table.order.find((seat) => seat !== playerId) ?? ''
        for (const perspective of [spectator, { kind: 'player', playerId: other } as const]) {
            const projected = actionProjector.project(action, perspective, { config: {} })
            expect(projected).not.toHaveProperty('writId')
            expect(projected).toMatchObject({ metadata: { slot: expect.any(Number) } })
        }
        expect(
            actionProjector.project(action, { kind: 'player', playerId }, { config: {} })
        ).toMatchObject({ writId: held[0] })
    })
})

describe('PlayMandate', () => {
    const holdingMandate = (
        writId: WritId,
        edit: (state: HydratedFeudumGameState, seat: string) => void = () => {}
    ) =>
        tableInWindow('before a card', (state, seat) => {
            holdWrit(state, seat, writId)
            edit(state, seat)
        })

    const setGoods = (
        state: HydratedFeudumGameState,
        seat: string,
        good: 'food' | 'wood',
        n: number
    ) => {
        const { goods } = state.getPlayerState(seat)
        state.supply.haversack[good] += goods[good] - n
        goods[good] = n
    }

    it('R-4.4.2 turns in, goes under in view, pays the reward; no barrier', () => {
        const { table, playerId } = holdingMandate(ShillingMandate, (state, seat) =>
            setGoods(state, seat, 'food', 1)
        )
        const before = table.hydrated()
        const { shillings } = before.getPlayerState(playerId)
        const supply = before.supply.shillings
        const haversack = before.supply.haversack.food
        const slot = before.writDeck.nextBottom

        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: alternativeOf(ShillingMandate, 1)
        })

        const state = table.hydrated()
        const seat = state.getPlayerState(playerId)
        expect(seat.requireWrits()).toEqual([])
        expect(seat.writCount).toBe(0)
        expect(seat.goods.food).toBe(0)
        expect(state.supply.haversack.food).toBe(haversack + 1)
        expect(seat.shillings).toBe(shillings + 3)
        expect(state.supply.shillings).toBe(supply - 3)
        expect(state.publicDeckWrits).toContainEqual({ slot, writId: ShillingMandate })
        expect(action).toMatchObject({
            writId: ShillingMandate,
            metadata: { slot, received: { kind: 'shillings', amount: 3 } }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })

    it('R-4.4.2 chooses among the alternatives by index', () => {
        const { table, playerId } = holdingMandate(ShillingMandate, (state, seat) => {
            setGoods(state, seat, 'food', 1)
            setGoods(state, seat, 'wood', 1)
        })
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: alternativeOf(ShillingMandate, 2)
        })
        expect(action).toMatchObject({ metadata: { received: { kind: 'shillings', amount: 7 } } })
        expect(table.seat(playerId).goods).toMatchObject({ food: 0, wood: 0 })
    })

    it('R-4.4-H1 refuses a seat out of its window, a writ not held, an unknown alternative', () => {
        const { table, playerId } = holdingMandate(ShillingMandate)
        const state = table.hydrated()
        const other = table.order.find((seat) => seat !== playerId) ?? ''
        const input = { writId: ShillingMandate, alternative: alternativeOf(ShillingMandate, 1) }
        expect(reasonPlayMandateRefused(state, other, input)).toBe("It isn't your turn.")
        expect(
            reasonPlayMandateRefused(state, playerId, {
                writId: VesselMandate,
                alternative: alternativeOf(VesselMandate, 1)
            })
        ).toBe(NOT_HELD)
        const another = alternativeOf(VesselMandate, 1)
        expect(reasonPlayMandateRefused(state, playerId, { ...input, alternative: another })).toBe(
            `${ShillingMandate} has no such alternative: ${another}`
        )
        expect(() =>
            table.send(playerId, { type: ActionType.PlayMandate, ...input, alternative: another })
        ).toThrow(`${ShillingMandate} has no such alternative: ${another}`)
    })

    it('R-4.4.2 refuses what the goods and named tiles do not cover', () => {
        const { table, playerId } = holdingMandate(ShillingMandate, (state, seat) =>
            setGoods(state, seat, 'food', 0)
        )
        const input = { writId: ShillingMandate, alternative: alternativeOf(ShillingMandate, 1) }
        expect(reasonPlayMandateRefused(table.hydrated(), playerId, input)).toBe(
            "You can't turn in food."
        )
        expect(
            reasonPlayMandateRefused(table.hydrated(), playerId, {
                ...input,
                wildTiles: [{ tileId: 'tile.sea.i', good: 'food' }]
            })
        ).toBe("You can't spend those region tiles.")
    })

    it('R-4.4-H1, R-4.3.3 a tile named pays the goods, spent first', () => {
        const { table, playerId } = holdingMandate(ShillingMandate, (state, seat) => {
            setGoods(state, seat, 'food', 0)
            giveTile(state, seat)
        })
        const [tileId] = table.seat(playerId).regionTiles
        const [offer] = playMandateOffers(table.hydrated(), playerId)
        expect(offer).toMatchObject({ wildTileNeeded: true, revealsInfo: false })
        expect(offer.refused).toBeUndefined()

        table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: alternativeOf(ShillingMandate, 1),
            wildTiles: [{ tileId, good: 'food' }]
        })
        const state = table.hydrated()
        expect(state.tilesOutOfGame).toContain(tileId)
        expect(state.getPlayerState(playerId).goods.food).toBe(0)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })

    it('R-4.4.2 a guild reward needs 3 stars in that guild', () => {
        const { table, playerId } = holdingMandate(FarmerMandate, (state, seat) => {
            setPawns(state, seat, ['merchant', 'merchant'])
        })
        const state = table.hydrated()
        expect(
            reasonPlayMandateRefused(state, playerId, {
                writId: FarmerMandate,
                rewardGuild: 'merchant'
            })
        ).toBe('You need 3 status stars in that guild.')
        expect(
            playMandateOffers(state, playerId).map(({ rewardGuild, vessel, refused }) => [
                rewardGuild,
                vessel,
                refused
            ])
        ).toEqual([
            ['farmer', undefined, 'You need 3 status stars in that guild.'],
            ['merchant', undefined, 'You need 3 status stars in that guild.'],
            ['alchemist', 'ship', 'You need 3 status stars in that guild.'],
            ['alchemist', 'submersible', 'You need 3 status stars in that guild.'],
            ['alchemist', 'flying-machine', 'You need 3 status stars in that guild.']
        ])
        expect(table.offered(playerId)).not.toContain(ActionType.PlayMandate)
    })

    it('R-4.4.2 a reward for a guild with 3 stars; a barrier when it draws goods', () => {
        const { table, playerId } = holdingMandate(FarmerMandate, (state, seat) => {
            setPawns(state, seat, ['farmer', 'farmer', 'farmer'])
        })
        expect(table.offered(playerId)).toContain(ActionType.PlayMandate)
        const before = table.seat(playerId).goods
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: FarmerMandate,
            rewardGuild: 'farmer'
        })
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({
            metadata: { received: { kind: 'goods', goods: expect.any(Array) } }
        })
        const after = table.seat(playerId).goods
        const gained =
            Object.values(after).reduce((sum, n) => sum + n, 0) -
            Object.values(before).reduce((sum, n) => sum + n, 0)
        expect(gained).toBe(3)
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-X.2 with an empty haversack it draws nothing, so it is no barrier', () => {
        const { table, playerId } = holdingMandate(FarmerMandate, (state, seat) => {
            setPawns(state, seat, ['farmer', 'farmer', 'farmer'])
            for (const good of ['food', 'wood', 'iron', 'sulfur', 'saltpeter'] as const) {
                giveGood(state, seat, good, state.supply.haversack[good])
            }
        })
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: FarmerMandate,
            rewardGuild: 'farmer'
        })
        expect(action).toMatchObject({ metadata: { received: { kind: 'goods', goods: [] } } })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-4.4.2 a merchant reward pays shillings, no barrier; R-1.1-H1 short pays what remains', () => {
        const { table, playerId } = holdingMandate(FarmerMandate, (state, seat) => {
            setPawns(state, seat, ['merchant', 'merchant', 'merchant'])
            state.getPlayerState(seat).shillings += state.supply.shillings - 2
            state.supply.shillings = 2
        })
        const { shillings } = table.seat(playerId)
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: FarmerMandate,
            rewardGuild: 'merchant'
        })
        expect(action).toMatchObject({ metadata: { received: { kind: 'shillings', amount: 2 } } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.seat(playerId).shillings).toBe(shillings + 2)
    })

    it('R-4.4-H7 a vessel reward needs one in the general supply', () => {
        const { table, playerId } = holdingMandate(VesselMandate, (state, seat) => {
            setGoods(state, seat, 'wood', 1)
            state.getPlayerState(seat).vessels.ship += state.supply.vessels.ship
            state.supply.vessels.ship = 0
        })
        const input = { writId: VesselMandate, alternative: alternativeOf(VesselMandate, 2) }
        expect(reasonPlayMandateRefused(table.hydrated(), playerId, input)).toBe(
            'The general supply has no ship.'
        )
        table.moveTo((state) => {
            state.getPlayerState(playerId).vessels.ship -= 1
            state.supply.vessels.ship = 1
            return MachineState.PlayingCards
        })
        const { ship } = table.seat(playerId).vessels
        const [action] = table.send(playerId, { type: ActionType.PlayMandate, ...input })
        expect(action).toMatchObject({ metadata: { received: { kind: 'vessel', vessel: 'ship' } } })
        expect(table.seat(playerId).vessels.ship).toBe(ship + 1)
        expect(table.hydrated().supply.vessels.ship).toBe(0)
    })

    it('R-4.4.2 influence comes to the seat from the general supply, ranks recomputed', () => {
        const { table, playerId } = holdingMandate(KnightMandate, (state, seat) => {
            setPawns(state, seat, ['knight', 'knight', 'knight'])
        })
        const { influenceSupply } = table.seat(playerId)
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: KnightMandate,
            rewardGuild: 'knight'
        })
        expect(action).toMatchObject({
            metadata: {
                received: { kind: 'influence', amount: 3 },
                rankChanges: expect.any(Array)
            }
        })
        expect(table.seat(playerId).influenceSupply).toBeGreaterThanOrEqual(influenceSupply)
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.4.2 a noble seal comes unseen; no barrier', () => {
        const { table, playerId } = holdingMandate(KnightMandate, (state, seat) => {
            setPawns(state, seat, ['noble', 'noble', 'noble'])
        })
        const { sealCount } = table.seat(playerId)
        const pile = table.hydrated().supply.sealPileCount
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: KnightMandate,
            rewardGuild: 'noble'
        })
        expect(table.seat(playerId).sealCount).toBe(sealCount + 1)
        expect(table.hydrated().supply.sealPileCount).toBe(pile - 1)
        expect(action).toMatchObject({ metadata: { received: { kind: 'seal', amount: 1 } } })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-X.2 a monk bead flips a seal: a barrier, only when the pile has one', () => {
        const flipped = holdingMandate(KnightMandate, (state, seat) => {
            setPawns(state, seat, ['monk', 'monk', 'monk'])
        })
        const [flip] = flipped.table.send(flipped.playerId, {
            type: ActionType.PlayMandate,
            writId: KnightMandate,
            rewardGuild: 'monk'
        })
        expect(flip.revealsInfo).toBe(true)
        expect(flip).toMatchObject({
            metadata: { received: { kind: 'bead', sealIds: [expect.any(String)] } }
        })
        expect(flipped.table.seat(flipped.playerId).beads).toHaveLength(1)

        const empty = holdingMandate(KnightMandate, (state, seat) => {
            setPawns(state, seat, ['monk', 'monk', 'monk'])
            setSealPile(state, seat, 0)
        })
        const [none] = empty.table.send(empty.playerId, {
            type: ActionType.PlayMandate,
            writId: KnightMandate,
            rewardGuild: 'monk'
        })
        expect(none).toMatchObject({ metadata: { received: { kind: 'bead', sealIds: [] } } })
        expect(none.revealsInfo).toBeFalsy()
    })

    it('R-4.4-H1 a weapon has no at-will alternative to offer', () => {
        const { table, playerId } = holdingMandate(Weapon)
        expect(playMandateOffers(table.hydrated(), playerId)).toEqual([])
    })

    it('R-X.2 offers say which alternatives stage, read from the registry', () => {
        const { table, playerId } = holdingMandate(KnightMandate, (state, seat) => {
            setPawns(state, seat, ['monk', 'monk', 'monk'])
        })
        expect(
            playMandateOffers(table.hydrated(), playerId).map(({ rewardGuild, revealsInfo }) => [
                rewardGuild,
                revealsInfo
            ])
        ).toEqual([
            ['knight', false],
            ['noble', false],
            ['monk', true]
        ])
    })

    it('R-4.4.2 the whole action is public', () => {
        const { table, playerId } = holdingMandate(ShillingMandate, (state, seat) =>
            setGoods(state, seat, 'food', 1)
        )
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: alternativeOf(ShillingMandate, 1)
        })
        expect(actionProjector.project(action, spectator, { config: {} })).toMatchObject({
            writId: ShillingMandate
        })
    })
})

describe('R-4.4.3 charters are sealed at game end only', () => {
    it('R-4.4.3 a seat holding a charter and a seal is offered no sealing, and one sent is refused', () => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            holdWrit(state, seat, Charter)
            giveSeal(state, seat)
        })
        const { sealCount, writCount } = table.seat(playerId)

        expect(table.offered(playerId)).not.toContain('SealCharter')
        expect(() =>
            table.send(playerId, { type: 'SealCharter' as ActionType, writId: Charter })
        ).toThrow()

        const seat = table.hydrated().getPlayerState(playerId)
        expect(seat.requireWrits()).toEqual([Charter])
        expect(seat.requireSealedCharters()).toEqual([])
        expect(seat.sealCount).toBe(sealCount)
        expect(seat.writCount).toBe(writCount)
    })
})
