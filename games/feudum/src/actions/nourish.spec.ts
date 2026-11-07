import { describe, expect, it } from 'vitest'
import type { GuildId } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { giveTile, tableInWindow } from '../testing/atWill.js'
import { setMaster, setPawns, StandingSpace } from '../testing/guilds.js'
import { nourishHasChoice, nourishOffer, nourishPreview } from './nourish.js'

/** R-1.4.4 Moves the seat's food to or from the haversack, keeping totals. */
function setFood(state: HydratedFeudumGameState, playerId: string, food: number): void {
    const seat = state.getPlayerState(playerId)
    state.supply.haversack.food += seat.goods.food - food
    seat.goods.food = food
}

function setBarrel(state: HydratedFeudumGameState, playerId: string, barrel: number): void {
    const seat = state.getPlayerState(playerId)
    state.supply.haversack.sulfur += seat.barrel - barrel
    seat.barrel = barrel
}

interface Larder {
    readonly pawns?: readonly GuildId[]
    readonly food?: number
    readonly barrel?: number
    readonly edit?: (state: HydratedFeudumGameState, playerId: string) => void
}

/** R-4.10 The asked seat, with these pawns on the board and this to feed them. */
function asking({ pawns = ['farmer', 'monk', 'knight'], food = 0, barrel = 0, edit }: Larder) {
    return tableInWindow('nourishing', (state, playerId) => {
        setPawns(state, playerId, pawns)
        setFood(state, playerId, food)
        setBarrel(state, playerId, barrel)
        state.recomputeRanks()
        edit?.(state, playerId)
    })
}

const Nourish = { type: ActionType.Nourish, wineFed: [], unfed: [] } as const

describe('R-4.10.1 Nourish', () => {
    it('R-4.3.3 reads the offer after the tiles a seat has named, while food and wine fall short', () => {
        const { table, playerId } = asking({
            food: 1,
            edit: (state, seat) => {
                giveTile(state, seat)
                giveTile(state, seat)
            }
        })
        const state = table.hydrated()
        const [first, second] = state.getPlayerState(playerId).regionTiles
        expect(nourishOffer(state, playerId)).toMatchObject({
            food: 1,
            preselected: { wineFed: [], unfed: [2, 3] },
            wildTileNeeded: true
        })
        expect(nourishOffer(state, playerId, [{ tileId: first, good: 'food' }])).toMatchObject({
            food: 2,
            preselected: { unfed: [3] },
            wildTileNeeded: true
        })
        expect(
            nourishOffer(state, playerId, [
                { tileId: first, good: 'food' },
                { tileId: second, good: 'sulfur', sulfurToBarrel: true }
            ])
        ).toMatchObject({
            food: 2,
            barrel: 1,
            preselected: { wineFed: [3], unfed: [] },
            wildTileNeeded: false
        })
    })

    it('S53 feeds food, food, wine: the food to the haversack, the sulfur on the wine-fed pawn', () => {
        const { table, playerId } = asking({ food: 2, barrel: 1 })
        const { food } = table.hydrated().supply.haversack
        const { sulfur } = table.hydrated().supply.haversack

        const [action] = table.send(playerId, { ...Nourish, wineFed: [3] })

        const seat = table.seat(playerId)
        expect(seat.goods.food).toBe(0)
        expect(seat.barrel).toBe(0)
        expect(seat.pawns.map((pawn) => pawn.wine)).toEqual([undefined, undefined, 'fed'])
        expect(seat.pawns.every((pawn) => pawn.spaceId === StandingSpace)).toBe(true)
        expect(table.hydrated().supply.haversack.food).toBe(food + 2)
        expect(table.hydrated().supply.haversack.sulfur).toBe(sulfur)
        expect(action).toMatchObject({ metadata: { foodFed: [1, 2], returned: [] } })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('S53 an unfed pawn flies home, and R-4.10.1 only the short ones can', () => {
        const { table, playerId } = asking({ food: 1, barrel: 1 })

        const [action] = table.send(playerId, { ...Nourish, wineFed: [1], unfed: [2] })

        const seat = table.seat(playerId)
        expect(seat.pawns.map((pawn) => pawn.spaceId)).toEqual([
            StandingSpace,
            undefined,
            StandingSpace
        ])
        expect(seat.pawns[1].character).toBeUndefined()
        expect(action).toMatchObject({
            metadata: {
                foodFed: [3],
                returned: [{ n: 2, left: { spaceId: StandingSpace, character: 'monk' } }]
            }
        })
    })

    it('R-4.2.2 an unfed pawn leaves its vessel on the space', () => {
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                state.supply.vessels.ship -= 1
                state.getPlayerState(seat).pawns[0].vessel = 'ship'
            }
        })
        const before = table.hydrated().spaces[StandingSpace].vessels.ship

        const [action] = table.send(playerId, { ...Nourish, unfed: [1] })

        expect(table.seat(playerId).pawns[0].vessel).toBeUndefined()
        expect(table.hydrated().spaces[StandingSpace].vessels.ship).toBe(before + 1)
        expect(action).toMatchObject({ metadata: { returned: [{ left: { vessel: 'ship' } }] } })
    })

    it('R-4.5.2 status recomputes as the unfed pawns leave', () => {
        const { table, playerId } = asking({
            edit: (state, seat) => setMaster(state, seat, 'monk')
        })

        const [action] = table.send(playerId, { ...Nourish, unfed: [1, 2, 3] })

        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'monk', playerId }] }
        })
        expect(table.hydrated().guilds.tracks.monk.master?.playerId).not.toBe(playerId)
    })

    it('R-4.10-H3 may feed wine while food remains: food or wine as the seat likes', () => {
        const { table, playerId } = asking({ pawns: ['farmer'], food: 1, barrel: 1 })

        table.send(playerId, { ...Nourish, wineFed: [1] })

        expect(table.seat(playerId).goods.food).toBe(1)
        expect(table.seat(playerId).barrel).toBe(0)
    })

    it('R-4.10-H3 must feed every pawn its food and wine can: S53 with no pawn to spare', () => {
        const { table, playerId } = asking({ food: 2, barrel: 1 })

        expect(() => table.send(playerId, { ...Nourish, unfed: [3] })).toThrow(
            'You must feed every pawn you have food or wine for.'
        )
    })

    it('R-4.10-H3 wine held counts too', () => {
        const { table, playerId } = asking({ pawns: ['farmer'], barrel: 1 })

        expect(() => table.send(playerId, { ...Nourish, unfed: [1] })).toThrow(
            'You must feed every pawn you have food or wine for.'
        )
    })

    it('R-4.10.1 needs the food for every pawn not named', () => {
        const { table, playerId } = asking({ food: 2 })

        expect(() => table.send(playerId, Nourish)).toThrow('That takes 3 food; you have 2.')
    })

    it('R-4.10.2 needs a barrel sulfur for each wine', () => {
        const { table, playerId } = asking({ food: 2, barrel: 1 })

        expect(() => table.send(playerId, { ...Nourish, wineFed: [1, 2] })).toThrow(
            'Your barrel holds 1 sulfur.'
        )
    })

    it('R-4.10-H3 names each pawn once, and only a pawn needing food', () => {
        const { table, playerId } = asking({ pawns: ['farmer', 'monk'], barrel: 1 })

        expect(() => table.send(playerId, { ...Nourish, wineFed: [1], unfed: [1] })).toThrow(
            'Name each pawn once.'
        )
        expect(() => table.send(playerId, { ...Nourish, wineFed: [3] })).toThrow(
            'That pawn needs no feeding.'
        )
    })

    it('R-4.10.2 a drunk pawn is fed by its sulfur: no food, and it stays', () => {
        const { table, playerId } = asking({
            pawns: ['farmer', 'monk'],
            food: 1,
            edit: (state, seat) => {
                state.supply.haversack.sulfur -= 1
                state.getPlayerState(seat).pawns[0].wine = 'drunk'
            }
        })
        expect(() => table.send(playerId, { ...Nourish, unfed: [1] })).toThrow(
            'That pawn needs no feeding.'
        )

        const [action] = table.send(playerId, Nourish)

        expect(table.seat(playerId).pawns[0].wine).toBe('drunk')
        expect(table.seat(playerId).goods.food).toBe(0)
        expect(action).toMatchObject({ metadata: { foodFed: [2], returned: [] } })
    })
})

describe('R-4.3.3 Nourish with wild tiles', () => {
    it('S53 a tile brings the food first, and leaves the game', () => {
        let tileId = ''
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                tileId = giveTile(state, seat)
            }
        })

        table.send(playerId, { ...Nourish, wildTiles: [{ tileId, good: 'food' }] })

        expect(table.seat(playerId).goods.food).toBe(0)
        expect(table.seat(playerId).regionTiles).toEqual([])
        expect(table.hydrated().tilesOutOfGame).toContain(tileId)
    })

    it('R-4.10-H1 a tile brings a sulfur into the barrel to feed as wine', () => {
        let tileId = ''
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                tileId = giveTile(state, seat)
            }
        })

        table.send(playerId, {
            ...Nourish,
            wineFed: [1],
            wildTiles: [{ tileId, good: 'sulfur', sulfurToBarrel: true }]
        })

        expect(table.seat(playerId).pawns[0].wine).toBe('fed')
        expect(table.seat(playerId).barrel).toBe(0)
    })

    it('R-4.10-H3 a tile is optional: the pawn may go unfed instead', () => {
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                giveTile(state, seat)
            }
        })

        table.send(playerId, { ...Nourish, unfed: [1] })

        expect(table.seat(playerId).pawns[0].spaceId).toBeUndefined()
        expect(table.seat(playerId).regionTiles).toHaveLength(1)
    })

    it('R-4.3.3 refuses a tile the seat does not hold', () => {
        const { table, playerId } = asking({ pawns: ['farmer'] })

        expect(() =>
            table.send(playerId, {
                ...Nourish,
                wildTiles: [{ tileId: 'tile.sea.i', good: 'food' }]
            })
        ).toThrow("You can't spend those region tiles.")
    })

    it('R-4.4-H1 the window stays open: a tile may be spent at will first', () => {
        let tileId = ''
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                tileId = giveTile(state, seat)
            }
        })
        table.send(playerId, { type: ActionType.SpendRegionTile, tileId, good: 'food' })
        expect(table.asked).toBe(playerId)

        table.send(playerId, Nourish)

        expect(table.seat(playerId).goods.food).toBe(0)
    })
})

describe('R-4.10, D11 who is asked', () => {
    it('D11 asks in turn order, one seat at a time, and offers only the asked seat', () => {
        const { table, playerId } = asking({ pawns: ['farmer'], food: 1 })
        const next = table.order.find((seat) => seat !== playerId) ?? ''

        expect(table.offered(playerId)).toContain(ActionType.Nourish)
        expect(table.offered(next)).not.toContain(ActionType.Nourish)
        expect(() => table.send(next, Nourish)).toThrow()

        table.send(playerId, Nourish)

        expect(table.asked).not.toBe(playerId)
        expect(table.asked).toBe(table.hydrated().flow.nourish?.pending[0])
        expect(table.offered(playerId)).not.toContain(ActionType.Nourish)
    })

    it('R-4.10, R-4.11.1 once everyone has answered the die comes next', () => {
        const { table, playerId } = asking({ pawns: ['farmer'], food: 1 })
        let processed = table.send(playerId, Nourish)
        for (const seat of [...(table.hydrated().flow.nourish?.pending ?? [])]) {
            const { goods, pawns } = table.seat(seat)
            const onBoard = pawns.filter((pawn) => pawn.spaceId).map((pawn) => pawn.n)
            expect(table.asked).toBe(seat)
            processed = table.send(seat, { ...Nourish, unfed: onBoard.slice(goods.food) })
        }

        expect(processed[1].type).toBe(ActionType.RollProgressDie)
        expect(table.hydrated().flow.nourish).toBeUndefined()
    })

    it.each([
        { what: 'no pawns', larder: { pawns: [] }, choice: false },
        { what: 'food for all', larder: { pawns: ['farmer'], food: 2 }, choice: false },
        { what: 'nothing and no tile', larder: { pawns: ['farmer'] }, choice: false },
        {
            what: 'barrel for all, no food',
            larder: { pawns: ['farmer'], barrel: 1 },
            choice: false
        },
        { what: 'food or wine', larder: { pawns: ['farmer'], food: 1, barrel: 1 }, choice: true },
        { what: 'which goes unfed', larder: { pawns: ['farmer', 'monk'], food: 1 }, choice: true }
    ] satisfies { what: string; larder: Larder; choice: boolean }[])(
        'D11 $what: real choice is $choice',
        ({ larder, choice }) => {
            const { table, playerId } = asking(larder)
            expect(nourishHasChoice(table.hydrated(), playerId)).toBe(choice)
        }
    )

    it('D11 a wild tile is a choice only while short', () => {
        const edit = (state: HydratedFeudumGameState, seat: string) => {
            giveTile(state, seat)
        }
        const short = asking({ pawns: ['farmer'], edit })
        expect(nourishHasChoice(short.table.hydrated(), short.playerId)).toBe(true)
        const fed = asking({ pawns: ['farmer'], food: 1, edit })
        expect(nourishHasChoice(fed.table.hydrated(), fed.playerId)).toBe(false)
    })
})

describe('S53 Nourish offers and previews', () => {
    it('S53 preselects food, then wine, then unfed', () => {
        const { table, playerId } = asking({ food: 1, barrel: 1 })

        expect(nourishOffer(table.hydrated(), playerId)).toMatchObject({
            pawns: [{ n: 1 }, { n: 2 }, { n: 3 }],
            food: 1,
            barrel: 1,
            preselected: { wineFed: [2], unfed: [3] },
            wildTileNeeded: false,
            sulfurToBarrel: true
        })
        expect(nourishOffer(table.hydrated(), table.order[1])).toBeUndefined()
    })

    it('S53 the preselection is itself legal', () => {
        const { table, playerId } = asking({ food: 1, barrel: 1 })
        const offer = nourishOffer(table.hydrated(), playerId)

        table.send(playerId, { ...Nourish, ...offer?.preselected })

        expect(table.seat(playerId).pawns.filter((pawn) => pawn.spaceId)).toHaveLength(2)
    })

    it('R-4.3.3 offers a tile while the seat is short', () => {
        const { table, playerId } = asking({
            pawns: ['farmer'],
            edit: (state, seat) => {
                giveTile(state, seat)
            }
        })
        expect(nourishOffer(table.hydrated(), playerId)?.wildTileNeeded).toBe(true)
    })

    it('S53 previews on a copy, and names what refuses a staged choice', () => {
        const { table, playerId } = asking({ food: 2, barrel: 1 })
        const state = table.hydrated()
        const before = JSON.stringify(state.dehydrate())

        expect(nourishPreview(state, playerId, { wineFed: [3], unfed: [] })).toMatchObject({
            food: 2,
            wine: 1,
            unfed: 0
        })
        expect(nourishPreview(state, playerId, { wineFed: [], unfed: [3] })).toMatchObject({
            refused: 'You must feed every pawn you have food or wine for.'
        })
        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })
})
