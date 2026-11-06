import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { Goods, type Good, type VesselType } from '../data/components.js'
import { GuildById } from '../data/guilds.js'
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
    setJourneyman,
    setMarket,
    setMaster,
    setShillings,
    setVesselsForSale,
    tableAtGuild,
    type GoodAmounts
} from '../testing/guilds.js'
import { alchemistTradeOffers } from '../guilds/alchemist.js'
import { farmerTradeOffers } from '../guilds/farmer.js'
import { merchantTradeOffers } from '../guilds/merchant.js'
import { ferriesOpen } from '../model/media.js'
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

/** R-4.6-H3 The pot each guild's charity names is provisional, so a spec reads both together. */
function charityTotal(state: HydratedFeudumGameState): number {
    return state.guilds.farmer.purse + state.guilds.monk.coffer
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

const MerchantTrade = { type: ActionType.GuildAction, guildId: 'merchant', fn: 'trade' } as const
const AlchemistTrade = { type: ActionType.GuildAction, guildId: 'alchemist', fn: 'trade' } as const

describe('GuildAction: R-4.6.3 the Merchant trade', () => {
    /** A full saltpeter bin but the last space: 2s, 3s and 4s from the right. */
    function buying(shillings: number, edit?: (state: HydratedFeudumGameState) => void) {
        return tableAtGuild((state, seat) => {
            setMarket(state, { saltpeter: 3, iron: 4, food: 1 })
            setShillings(state, seat, shillings)
            edit?.(state)
        })
    }

    it('R-4.6.3 buys up to 3, each the cheapest of its kind, right to left', () => {
        const { table, playerId } = buying(20)
        const before = table.seat(playerId).goods
        const [action] = table.send(playerId, {
            ...MerchantTrade,
            params: { goods: ['saltpeter', 'iron', 'saltpeter'] }
        })
        const state = table.hydrated()
        const { market } = state.guilds.merchant
        expect(market['guild.merchant.space.saltpeter-3']).toBe(false)
        expect(market['guild.merchant.space.saltpeter-2']).toBe(false)
        expect(market['guild.merchant.space.saltpeter-1']).toBe(true)
        expect(market['guild.merchant.space.iron-4']).toBe(false)
        expect(market['guild.merchant.space.iron-3']).toBe(true)
        const seat = table.seat(playerId)
        expect(seat.goods.saltpeter).toBe(before.saltpeter + 2)
        expect(seat.goods.iron).toBe(before.iron + 1)
        expect(seat.shillings).toBeLessThan(20)
        expect(action).toMatchObject({
            metadata: {
                points: 0,
                reeveOffered: false,
                details: {
                    kind: 'merchant-trade',
                    bought: [
                        {
                            good: 'saltpeter',
                            spaceId: 'guild.merchant.space.saltpeter-3',
                            price: 2
                        },
                        { good: 'iron', spaceId: 'guild.merchant.space.iron-4', price: 1 },
                        { good: 'saltpeter', spaceId: 'guild.merchant.space.saltpeter-2', price: 3 }
                    ],
                    price: 6
                }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.6.3 refuses more than 3 goods, none, or more than the bin holds', () => {
        const { table, playerId } = buying(20)
        const send = (goods: Good[]) =>
            table.send(playerId, { ...MerchantTrade, params: { goods } })
        expect(() => send(['iron', 'iron', 'iron', 'iron'])).toThrow('Buy at most 3 goods.')
        expect(() => send([])).toThrow('Pick up to 3 goods to buy.')
        expect(() => send(['food', 'food'])).toThrow('The market holds only 1 food.')
        expect(() => send(['wood'])).toThrow('The market holds only 0 wood.')
    })

    it('R-4.6.2 refuses goods the seat cannot pay for, at the whole price', () => {
        const { table, playerId } = buying(8)
        expect(() =>
            table.send(playerId, {
                ...MerchantTrade,
                params: { goods: ['saltpeter', 'saltpeter', 'saltpeter'] }
            })
        ).toThrow('Those goods cost 9 shillings.')
    })

    it('R-4.6.3 is closed with an empty market, or with too few shillings for the cheapest', () => {
        const empty = tableAtGuild((state, seat) => {
            setMarket(state, {})
            setShillings(state, seat, 9)
        })
        expect(() =>
            empty.table.send(empty.playerId, { ...MerchantTrade, params: { goods: ['food'] } })
        ).toThrow('The market is empty.')

        const broke = buying(0)
        expect(() =>
            broke.table.send(broke.playerId, { ...MerchantTrade, params: { goods: ['food'] } })
        ).toThrow('The cheapest good costs 1 shilling.')
    })

    it('R-4.6.3 offers each good at the price of the next one', () => {
        const { table } = buying(9)
        expect(merchantTradeOffers(table.hydrated())).toEqual(
            expect.arrayContaining([
                {
                    good: 'saltpeter',
                    spaceId: 'guild.merchant.space.saltpeter-3',
                    price: 2,
                    available: 3
                },
                { good: 'iron', spaceId: 'guild.merchant.space.iron-4', price: 1, available: 4 }
            ])
        )
    })

    it('R-4.6.3 previews the price and split, naming what still refuses a staged input', () => {
        const { table, playerId } = buying(2)
        const state = table.hydrated()
        const input = { guildId: 'merchant', fn: 'trade' } as const
        const preview = guildActionPreview(state, playerId, {
            ...input,
            params: { goods: ['saltpeter', 'saltpeter'] }
        })
        expect(preview).toMatchObject({
            details: { kind: 'merchant-trade', price: 5 },
            revealsInfo: false,
            refused: 'Those goods cost 5 shillings.'
        })
        expect(
            guildActionPreview(state, playerId, { ...input, params: { goods: ['wood'] } })
        ).toBeUndefined()
        expect(state.getPlayerState(playerId).goods).toEqual(table.seat(playerId).goods)
    })
})

describe('GuildAction: R-4.6.2, R-4.6-H3 paying a guild', () => {
    it('R-4.6.2 one each to master, journeyman and charity, repeating', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setJourneyman(state, rest[1], 'merchant', rest[0])
            setMarket(state, { saltpeter: 3 })
            setShillings(state, seat, 9)
            setShillings(state, rest[0], 0)
            setShillings(state, rest[1], 0)
        })
        const pots = charityTotal(table.hydrated())
        const [action] = table.send(playerId, {
            ...MerchantTrade,
            params: { goods: ['saltpeter', 'saltpeter', 'saltpeter'] }
        })
        expect(table.seat(playerId).shillings).toBe(0)
        expect(table.seat(others[0]).shillings).toBe(3)
        expect(table.seat(others[1]).shillings).toBe(3)
        expect(charityTotal(table.hydrated())).toBe(pots + 3)
        expect(action).toMatchObject({
            metadata: {
                payment: {
                    members: [
                        { playerId: others[0], amount: 3 },
                        { playerId: others[1], amount: 3 }
                    ],
                    charity: { id: GuildById.merchant.charity, amount: 3 },
                    generalSupply: 0
                }
            }
        })
    })

    it("R-4.6.2 an absent member's shilling goes to the general supply", () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setMaster(state, rest[0], 'alchemist')
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 3)
            setShillings(state, rest[0], 0)
        })
        const supply = table.hydrated().supply.shillings
        const [action] = table.send(playerId, {
            ...AlchemistTrade,
            params: { vesselType: 'ship' }
        })
        expect(table.seat(others[0]).shillings).toBe(1)
        expect(table.hydrated().supply.shillings).toBe(supply + 1)
        expect(action).toMatchObject({
            metadata: {
                payment: {
                    members: [{ playerId: others[0], amount: 1 }],
                    charity: { id: GuildById.alchemist.charity, amount: 1 },
                    generalSupply: 1
                }
            }
        })
    })

    it('R-4.6.2 a member pays themselves but must hold the full price', () => {
        const short = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'alchemist')
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 2)
        })
        expect(() =>
            short.table.send(short.playerId, {
                ...AlchemistTrade,
                params: { vesselType: 'ship' }
            })
        ).toThrow('A vessel costs 3 shillings.')

        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'alchemist')
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 3)
        })
        table.send(playerId, { ...AlchemistTrade, params: { vesselType: 'ship' } })
        expect(table.seat(playerId).shillings).toBe(1)
    })
})

describe('GuildAction: R-4.6.3 the Alchemist trade', () => {
    function selling(vessels: readonly VesselType[], shillings = 3) {
        return tableAtGuild((state, seat) => {
            setVesselsForSale(state, vessels)
            setShillings(state, seat, shillings)
        })
    }

    it("R-4.6.3 a vessel for sale goes to the buyer's supply for 3s", () => {
        const { table, playerId } = selling(['ship', 'submersible'])
        const [action] = table.send(playerId, {
            ...AlchemistTrade,
            params: { vesselType: 'submersible' }
        })
        const state = table.hydrated()
        expect(state.guilds.alchemist.vesselsForSale).toEqual(['ship'])
        expect(table.seat(playerId).vessels.submersible).toBe(1)
        expect(table.seat(playerId).shillings).toBe(0)
        expect(action).toMatchObject({
            metadata: { points: 0, details: { kind: 'alchemist-trade', price: 3 } }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-4.2.3 the last vessel sold reopens the ferries', () => {
        const { table, playerId } = selling(['ship'])
        expect(ferriesOpen(table.hydrated())).toBe(false)
        table.send(playerId, { ...AlchemistTrade, params: { vesselType: 'ship' } })
        expect(ferriesOpen(table.hydrated())).toBe(true)
    })

    it('R-4.6.3 refuses no vessel named, one not for sale, and is closed with none for sale', () => {
        const { table, playerId } = selling(['ship'])
        expect(() => table.send(playerId, { ...AlchemistTrade, params: {} })).toThrow(
            'Pick a vessel for sale.'
        )
        expect(() =>
            table.send(playerId, { ...AlchemistTrade, params: { vesselType: 'flying-machine' } })
        ).toThrow('No flying machine is for sale.')

        const none = selling([])
        expect(() =>
            none.table.send(none.playerId, { ...AlchemistTrade, params: { vesselType: 'ship' } })
        ).toThrow('No vessel is for sale.')
    })

    it('R-4.6.3 offers each kind for sale, and previews the split before one is picked', () => {
        const { table, playerId } = selling(['ship', 'ship', 'submersible'])
        const state = table.hydrated()
        expect(alchemistTradeOffers(state)).toEqual([
            { vessel: 'ship', price: 3 },
            { vessel: 'submersible', price: 3 }
        ])
        const input = { guildId: 'alchemist', fn: 'trade' } as const
        expect(guildActionPreview(state, playerId, { ...input, params: {} })).toMatchObject({
            details: { kind: 'alchemist-trade', price: 3 },
            revealsInfo: false,
            refused: 'Pick a vessel for sale.'
        })
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: { vesselType: 'flying-machine' }
            })
        ).toBeUndefined()
    })
})
