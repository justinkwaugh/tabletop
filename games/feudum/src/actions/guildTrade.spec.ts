import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { Goods, type Good } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { setUp, spaceOfKind } from '../testing/improving.js'
import {
    ruleFarm,
    setBarn,
    setBeads,
    setCarts,
    setMarket,
    tableAtGuild,
    type GoodAmounts
} from '../testing/guilds.js'
import { farmerTradeOffers } from '../guilds/farmer.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'

const FarmerTrade = { type: ActionType.GuildAction, guildId: 'farmer', fn: 'trade' } as const

function trading(goods: GoodAmounts, edit?: (state: HydratedFeudumGameState) => void) {
    let farmSpaceId: SpaceId = 'space.desert.3'
    const guildTable = tableAtGuild((state, seat) => {
        setBeads(state, { rosary: [2, 3], chickens: [] })
        farmSpaceId = ruleFarm(state, seat, goods)
        state.recomputeRanks(seat)
        edit?.(state)
    })
    return { ...guildTable, farmSpaceId }
}

function total(counts: Readonly<Record<Good, number>>): number {
    return Goods.reduce((sum, good) => sum + counts[good], 0)
}

describe('GuildAction: R-4.6.3 the Farmer trade', () => {
    it('R-4.6.3 all of a ruled farm goes to the barn, for 1 food or 1 shilling per 2 sent', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 3, iron: 2 }, (state) =>
            setBarn(state, { food: 1 })
        )
        const seat = table.seat(playerId)
        const food = seat.goods.food
        const shillings = seat.shillings
        const [action] = table.send(playerId, {
            ...FarmerTrade,
            params: { farmSpaceId, takeFood: 1 }
        })
        const state = table.hydrated()
        expect(state.spaces[farmSpaceId].goods.wood).toBe(0)
        expect(state.guilds.farmer.barn).toMatchObject({ wood: 3, iron: 2, food: 1 })
        expect(table.seat(playerId).goods.food).toBe(food + 1)
        expect(table.seat(playerId).shillings).toBe(shillings + 1)
        expect(action).toMatchObject({
            metadata: {
                points: 0,
                reevePoints: 0,
                reeveOffered: false,
                details: {
                    kind: 'farmer-trade',
                    sent: { wood: 3, iron: 2 },
                    food: 1,
                    shillings: 1,
                    toBarn: { wood: 3, iron: 2 }
                }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.6.3 a lone good earns nothing but may still be sent', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 1 }, (state) => setBarn(state, {}))
        const shillings = table.seat(playerId).shillings
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        expect(table.seat(playerId).shillings).toBe(shillings)
        expect(action).toMatchObject({ metadata: { details: { food: 0, shillings: 0 } } })
    })

    it('R-4.6.3 refuses more food than the goods earn', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 3 }, (state) => setBarn(state, {}))
        expect(() =>
            table.send(playerId, { ...FarmerTrade, params: { farmSpaceId, takeFood: 2 } })
        ).toThrow('3 goods earn at most 1 food.')
    })

    it('R-4.6.3 refuses a farm not ruled, and a ruled farm with no goods', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 2 })
        const state = table.hydrated()
        const other = spaceOfKind(state, 'farm', [farmSpaceId])
        expect(state.spaces[other].ruler?.playerId).not.toBe(playerId)
        expect(() =>
            table.send(playerId, { ...FarmerTrade, params: { farmSpaceId: other } })
        ).toThrow('You rule no farm there.')

        setUp(table, (edited) => {
            placeMarker(edited, playerId, other)
        })
        expect(() =>
            table.send(playerId, { ...FarmerTrade, params: { farmSpaceId: other } })
        ).toThrow('That farm has no goods.')
    })

    it('R-4.6.3 is closed with no ruled farm holding goods', () => {
        const none = tableAtGuild()
        expect(() => none.table.send(none.playerId, { ...FarmerTrade, params: {} })).toThrow(
            'You rule no farm with goods.'
        )

        const empty = trading({})
        expect(() =>
            empty.table.send(empty.playerId, {
                ...FarmerTrade,
                params: { farmSpaceId: empty.farmSpaceId }
            })
        ).toThrow('You rule no farm with goods.')
    })

    it('R-4.6.3 names a farm when the seat rules one with goods but picks none', () => {
        const { table, playerId } = trading({ wood: 2 })
        expect(() => table.send(playerId, { ...FarmerTrade, params: {} })).toThrow(
            'Pick a farm you rule.'
        )
    })

    it('R-4.6.3 beyond the limit, with no bead on a chicken, the rest go to the haversack', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 3, iron: 2 }, (state) =>
            setBarn(state, { food: 8 })
        )
        const haversack = table.hydrated().supply.haversack
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        const state = table.hydrated()
        expect(total(state.guilds.farmer.barn)).toBe(10)
        // R-4.6-H6 The barn fills in bin order, so iron before wood.
        expect(state.guilds.farmer.barn).toMatchObject({ iron: 2, wood: 0, food: 8 })
        expect(state.supply.haversack.wood).toBe(haversack.wood + 3)
        expect(action).toMatchObject({
            metadata: { details: { toBarn: { iron: 2 }, toHaversack: { wood: 3 } } }
        })
        expect(action.revealsInfo).toBeFalsy()
    })
})

describe('GuildAction: R-4.6.3 the spill', () => {
    it("R-4.6.3 the beads' sum spills at random, then the rest go to the barn and haversack", () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 2, iron: 3 }, (state) => {
            setBarn(state, { food: 9 })
            setBeads(state, { rosary: [2, 3], chickens: [3] })
            setMarket(state, {})
            setCarts(state, {})
        })
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        expect(action.revealsInfo).toBe(true)
        const { barn } = table.hydrated().guilds.farmer
        expect(total(barn)).toBe(10)
        expect(action).toMatchObject({ metadata: { details: { kind: 'farmer-trade' } } })
        const market = table.hydrated().guilds.merchant.market
        const spilt = Object.values(market).filter(Boolean).length
        // Surplus 4, beads 3: three spill to the empty market, the fourth to the haversack.
        expect(spilt).toBe(3)
    })

    it('R-4.6.3 the spill is capped by the surplus', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 3 }, (state) => {
            setBarn(state, { food: 9 })
            setBeads(state, { rosary: [2, 3], chickens: [5] })
            setMarket(state, {})
        })
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        expect(action.revealsInfo).toBe(true)
        expect(action).toMatchObject({
            metadata: {
                details: { toMarket: { wood: 2 }, toBarn: { wood: 1 }, toHaversack: { wood: 0 } }
            }
        })
    })

    it('R-4.6.3 spilt goods fill the market first, then the carts, then the haversack', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 4 }, (state) => {
            setBarn(state, { food: 10 })
            setBeads(state, { rosary: [2, 3], chickens: [4] })
            setMarket(state, { wood: 3 })
            setCarts(state, { wood: 2 })
        })
        const haversack = table.hydrated().supply.haversack.wood
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        const state = table.hydrated()
        expect(state.guilds.merchant.market['guild.merchant.space.wood-4']).toBe(true)
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.wood-3']).toBe(true)
        expect(state.supply.haversack.wood).toBe(haversack + 2)
        expect(action).toMatchObject({
            metadata: {
                details: {
                    toMarket: { wood: 1 },
                    toCarts: { wood: 1 },
                    toHaversack: { wood: 2 },
                    toBarn: { wood: 0 }
                }
            }
        })
        expect(action.revealsInfo).toBe(true)
    })

    it('R-4.6.3 no surplus means no spill and no barrier, beads or not', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 2 }, (state) => {
            setBarn(state, { food: 2 })
            setBeads(state, { rosary: [2, 3], chickens: [5] })
        })
        const [action] = table.send(playerId, { ...FarmerTrade, params: { farmSpaceId } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.hydrated().guilds.farmer.barn.wood).toBe(2)
    })
})

describe('GuildAction: Farmer trade offers and preview', () => {
    it('R-4.6.3 offers each ruled farm with goods, with what it earns', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 3, iron: 2 })
        expect(farmerTradeOffers(table.hydrated(), playerId)).toEqual([
            { spaceId: farmSpaceId, sent: 5, rewards: 2 }
        ])
    })

    it('R-4.6.3 anyone may trade: it is open with no rank', () => {
        const { table, playerId } = trading({ wood: 2 })
        const trade = guildActionOffers(table.hydrated(), playerId).find(({ fn }) => fn === 'trade')
        expect(trade?.reason).toBeUndefined()
    })

    it('R-4.6.3 the preview gives the reward, no points, and no barrier below the limit', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 4 }, (state) =>
            setBarn(state, { food: 2 })
        )
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'trade',
                params: { farmSpaceId, takeFood: 1 }
            })
        ).toMatchObject({
            points: 0,
            reevePoints: 0,
            revealsInfo: false,
            trade: { sent: 4, food: 1, shillings: 1, surplus: 0, spill: 0, toBarn: 4 }
        })
    })

    it('R-4.6.3 the preview says when the send will spill at random', () => {
        const { table, playerId, farmSpaceId } = trading({ wood: 4 }, (state) => {
            setBarn(state, { food: 8 })
            setBeads(state, { rosary: [2, 3], chickens: [2] })
        })
        expect(
            guildActionPreview(table.hydrated(), playerId, {
                guildId: 'farmer',
                fn: 'trade',
                params: { farmSpaceId }
            })
        ).toMatchObject({
            revealsInfo: true,
            trade: { sent: 4, surplus: 2, spill: 2, toBarn: 2, food: 0, shillings: 2 }
        })
    })
})
