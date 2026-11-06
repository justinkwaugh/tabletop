import { describe, expect, it } from 'vitest'
import { Spaces, type SpaceId } from '../data/board.js'
import {
    Goods,
    type Good,
    type GuildId,
    type MonsterId,
    type VesselType
} from '../data/components.js'
import { GuildById, type ScrollSpaceId } from '../data/guilds.js'
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
    setRowMarkers,
    setScrolls,
    setPawns,
    setShillings,
    setVesselsForSale,
    tableAtGuild,
    recordedText,
    type GoodAmounts
} from '../testing/guilds.js'
import { canonicalOf } from '../testing/state.js'
import { alchemistTradeOffers } from '../guilds/alchemist.js'
import { farmerTradeOffers } from '../guilds/farmer.js'
import { knightTradeOffer } from '../guilds/knight.js'
import { merchantTradeOffers } from '../guilds/merchant.js'
import { nobleTradeOffer } from '../guilds/noble.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import { ferriesOpen, monsterReaches } from '../model/media.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'

const KnightTrade = { type: ActionType.GuildAction, guildId: 'knight', fn: 'trade' } as const
const NobleTrade = { type: ActionType.GuildAction, guildId: 'noble', fn: 'trade' } as const
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

function setSeatRow(state: HydratedFeudumGameState, seat: string, markers: number): void {
    setRowMarkers(
        state,
        state.guilds.knight.rows.map((row) => (row.playerId === seat ? markers : row.markers))
    )
}

/** The seat's row holds this many markers; the seat's one pawn stands on `spaceId`. */
function knightTrading(
    markers: number,
    spaceId: SpaceId = 'space.desert.3',
    edit?: (state: HydratedFeudumGameState, seat: string, others: readonly string[]) => void
) {
    return tableAtGuild((state, seat, others) => {
        setPawns(state, seat, ['knight'])
        state.getPlayerState(seat).pawns[0].spaceId = spaceId
        state.recomputeRanks(seat)
        setSeatRow(state, seat, markers)
        setShillings(state, seat, 5)
        edit?.(state, seat, others)
    })
}

function spaceReachedOnlyBy(monster: MonsterId): SpaceId {
    const other: MonsterId = monster === 'behemoth' ? 'sea-serpent' : 'behemoth'
    const space = Spaces.find(({ id }) => monsterReaches(monster, id) && !monsterReaches(other, id))
    if (!space) {
        throw new Error(`No space only the ${monster} reaches`)
    }
    return space.id
}

function rowOf(state: HydratedFeudumGameState, playerId: string) {
    const row = state.guilds.knight.rows.find((other) => other.playerId === playerId)
    if (!row) {
        throw new Error(`${playerId} has no row`)
    }
    return row
}

describe('GuildAction: R-4.6.3 the Knight trade', () => {
    it('R-4.6.3 3s buys every marker in the row, however many; no vp and no barrier', () => {
        const { table, playerId } = knightTrading(2)
        const before = table.hydrated()
        const supply = before.getPlayerState(playerId).influenceSupply
        const general = { ...before.supply.influence }
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { ...KnightTrade, params: {} })
        const after = table.hydrated()
        expect(rowOf(after, playerId).markers).toBe(0)
        expect(table.seat(playerId).influenceSupply).toBe(supply + 2)
        // R-4.6.2 The seat is the guild's master, so one of the 3 comes back.
        expect(table.seat(playerId).shillings).toBe(3)
        expect(after.supply.influence).toEqual(general)
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            metadata: {
                details: { kind: 'knight-trade', taken: 2, kept: 2, price: 3 },
                points: 0,
                reeveOffered: false,
                drawnWritIds: []
            }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-4.6.3, R-4.2.4 S44 with 4 markers, tames at once: 2 to the supply, 1 on its icon', () => {
        const { table, playerId } = knightTrading(4)
        const before = table.hydrated()
        const colour = rowOf(before, playerId).colour
        const general = before.supply.influence[colour]
        const supply = before.getPlayerState(playerId).influenceSupply
        const [action] = table.send(playerId, {
            ...KnightTrade,
            params: { monster: 'behemoth', deploySpaceId: 'space.desert.3' }
        })
        const after = table.hydrated()
        expect(rowOf(after, playerId).markers).toBe(0)
        expect(table.seat(playerId).influenceSupply).toBe(supply + 1)
        expect(after.supply.influence[colour]).toBe(general + 2)
        expect(after.guilds.knight.monsterIcons.behemoth).toBe(playerId)
        expect(after.monsters.behemoth).toEqual({ playerId, spaceId: 'space.desert.3' })
        expect(after.monsters['sea-serpent']).toEqual({})
        expect(action).toMatchObject({
            metadata: { details: { kind: 'knight-trade', taken: 4, kept: 1, price: 3 } }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.6.3 a row of exactly 3 tames and keeps none', () => {
        const spaceId = spaceReachedOnlyBy('sea-serpent')
        const { table, playerId } = knightTrading(3, spaceId)
        const supply = table.seat(playerId).influenceSupply
        const [action] = table.send(playerId, {
            ...KnightTrade,
            params: { monster: 'sea-serpent', deploySpaceId: spaceId }
        })
        expect(table.seat(playerId).influenceSupply).toBe(supply)
        expect(action).toMatchObject({ metadata: { details: { taken: 3, kept: 0 } } })
    })

    it('R-4.6.3 a marker on the map is presence too', () => {
        const spaceId = spaceReachedOnlyBy('behemoth')
        const { table, playerId } = knightTrading(3, 'space.desert.3', (state, seat) => {
            placeMarker(state, seat, spaceId)
        })
        table.send(playerId, {
            ...KnightTrade,
            params: { monster: 'behemoth', deploySpaceId: spaceId }
        })
        expect(table.hydrated().monsters.behemoth.spaceId).toBe(spaceId)
    })

    it('R-4.6.3 refuses a tame short of 3 markers', () => {
        const { table, playerId } = knightTrading(2)
        expect(() =>
            table.send(playerId, {
                ...KnightTrade,
                params: { monster: 'behemoth', deploySpaceId: 'space.desert.3' }
            })
        ).toThrow('Taming the behemoth takes 3 markers from your row.')
    })

    it('R-4.2.4 refuses a monster someone holds; the other is still free', () => {
        const spaceId = spaceReachedOnlyBy('sea-serpent')
        const { table, playerId } = knightTrading(3, spaceId, (state, _seat, others) => {
            state.getPlayerState(others[0]).influenceSupply -= 1
            state.guilds.knight.monsterIcons.behemoth = others[0]
            state.monsters.behemoth = { playerId: others[0], spaceId: 'space.desert.2' }
        })
        expect(() =>
            table.send(playerId, {
                ...KnightTrade,
                params: { monster: 'behemoth', deploySpaceId: spaceId }
            })
        ).toThrow('The behemoth is already tamed.')
        expect(knightTradeOffer(table.hydrated(), playerId).monsters.map((m) => m.monster)).toEqual(
            ['sea-serpent']
        )
    })

    it('R-4.6.3 deploys where the seat has a pawn or marker, by a route the monster may use', () => {
        const noPresence = knightTrading(3)
        expect(() =>
            noPresence.table.send(noPresence.playerId, {
                ...KnightTrade,
                params: { monster: 'behemoth', deploySpaceId: 'space.desert.1' }
            })
        ).toThrow('Deploy the behemoth where you have a pawn or marker.')

        const spaceId = spaceReachedOnlyBy('sea-serpent')
        const cannotReach = knightTrading(3, spaceId)
        expect(() =>
            cannotReach.table.send(cannotReach.playerId, {
                ...KnightTrade,
                params: { monster: 'behemoth', deploySpaceId: spaceId }
            })
        ).toThrow('The behemoth has nowhere to deploy.')

        const serpentOnly = spaceReachedOnlyBy('sea-serpent')
        const behemothOnly = spaceReachedOnlyBy('behemoth')
        const twoSpaces = knightTrading(3, behemothOnly, (state, seat) => {
            setPawns(state, seat, ['knight', 'knight'])
            state.getPlayerState(seat).pawns[0].spaceId = behemothOnly
            state.getPlayerState(seat).pawns[1].spaceId = serpentOnly
        })
        expect(() =>
            twoSpaces.table.send(twoSpaces.playerId, {
                ...KnightTrade,
                params: { monster: 'behemoth', deploySpaceId: serpentOnly }
            })
        ).toThrow("The behemoth can't reach that space.")
    })

    it('R-4.6-H10 refuses a monster with no space, and a space with no monster', () => {
        const { table, playerId } = knightTrading(3)
        expect(() =>
            table.send(playerId, { ...KnightTrade, params: { monster: 'behemoth' } })
        ).toThrow('Pick a space to deploy the behemoth.')
        expect(() =>
            table.send(playerId, { ...KnightTrade, params: { deploySpaceId: 'space.desert.3' } })
        ).toThrow('Pick a monster to tame.')
    })

    it('R-4.6.3 is closed with an empty row, or with too few shillings', () => {
        const empty = knightTrading(0)
        expect(() => empty.table.send(empty.playerId, { ...KnightTrade, params: {} })).toThrow(
            'Your Knight row holds no markers.'
        )
        const poor = knightTrading(2, 'space.desert.3', (state, seat) => {
            setShillings(state, seat, 2)
        })
        expect(() => poor.table.send(poor.playerId, { ...KnightTrade, params: {} })).toThrow(
            'Taking your row costs 3 shillings.'
        )
        expect(
            guildActionOffers(poor.table.hydrated(), poor.playerId).find(
                (offer) => offer.guildId === 'knight' && offer.fn === 'trade'
            )
        ).toMatchObject({ reason: 'Taking your row costs 3 shillings.', bestVp: 0 })
    })

    it('R-4.6.2, R-4.6-H3 pays the guild: one each to master, journeyman and charity', () => {
        const { table, playerId } = knightTrading(1, 'space.desert.3', (state, seat, others) => {
            setJourneyman(state, seat, 'knight', others[0])
            setShillings(state, others[0], 0)
            setShillings(state, seat, 5)
        })
        const charity = charityTotal(table.hydrated())
        const [action] = table.send(playerId, { ...KnightTrade, params: {} })
        const master = table.order.find(
            (seat) => table.hydrated().guilds.tracks.knight.master?.playerId === seat
        )
        expect(action).toMatchObject({
            metadata: {
                payment: {
                    members: [
                        { playerId: master, amount: 1 },
                        { playerId, amount: 1 }
                    ],
                    charity: { amount: 1 },
                    generalSupply: 0
                }
            }
        })
        expect(charityTotal(table.hydrated())).toBe(charity + 1)
        expect(table.seat(playerId).shillings).toBe(3)
    })

    it('R-4.5-H3 markers coming home fill a rank the seat was owed', () => {
        const { table, playerId } = knightTrading(0, 'space.desert.3', (state, seat) => {
            setPawns(state, seat, [])
            state.recomputeRanks(seat)
            const player = state.getPlayerState(seat)
            state.supply.influence[player.color] += player.influenceSupply
            player.influenceSupply = 0
            setPawns(state, seat, ['knight', 'knight', 'knight'])
            state.recomputeRanks(seat)
            setSeatRow(state, seat, 2)
        })
        expect(table.hydrated().guilds.tracks.knight.master?.playerId).not.toBe(playerId)
        const [action] = table.send(playerId, { ...KnightTrade, params: {} })
        expect(table.hydrated().guilds.tracks.knight.master?.playerId).toBe(playerId)
        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'knight', playerId, to: 'master' }] }
        })
        expect(table.seat(playerId).influenceSupply).toBe(1)
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })
})

describe('GuildAction: Knight trade offers and preview', () => {
    it('R-4.6.3 offers the row at its price; below 3, no monster', () => {
        const { table, playerId } = knightTrading(2)
        expect(knightTradeOffer(table.hydrated(), playerId)).toEqual({
            price: 3,
            markers: 2,
            monsters: []
        })
    })

    it('R-4.6.3 S44 from 3, each monster with the spaces it may deploy to', () => {
        const spaceId = spaceReachedOnlyBy('behemoth')
        const { table, playerId } = knightTrading(4, spaceId)
        const offer = knightTradeOffer(table.hydrated(), playerId)
        expect(offer.monsters).toEqual([{ monster: 'behemoth', spaces: [spaceId] }])
    })

    it('R-4.6.3 anyone may trade: it is open with no rank', () => {
        const { table, playerId } = knightTrading(1)
        const offer = guildActionOffers(table.hydrated(), playerId).find(
            (row) => row.guildId === 'knight' && row.fn === 'trade'
        )
        expect(offer).toEqual({ guildId: 'knight', fn: 'trade', bestVp: 0 })
    })

    it('R-4.6.3, R-4.6.2 previews the row and split, naming what a staged tame still lacks', () => {
        const { table, playerId } = knightTrading(4)
        const state = table.hydrated()
        const input = { guildId: 'knight', fn: 'trade' } as const
        expect(guildActionPreview(state, playerId, { ...input, params: {} })).toMatchObject({
            details: { kind: 'knight-trade', taken: 4, kept: 4, price: 3 },
            payment: { generalSupply: expect.any(Number) },
            points: 0,
            revealsInfo: false
        })
        expect(
            guildActionPreview(state, playerId, { ...input, params: { monster: 'behemoth' } })
        ).toMatchObject({
            details: { kept: 1 },
            refused: 'Pick a space to deploy the behemoth.'
        })
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: { monster: 'behemoth', deploySpaceId: 'space.desert.1' }
            })
        ).toBeUndefined()
    })
})

function nobleTrading(filled: readonly ScrollSpaceId[], shillings = 6, guild?: GuildId) {
    return tableAtGuild((state, seat) => {
        setScrolls(state, filled)
        setShillings(state, seat, shillings)
        if (guild) {
            setMaster(state, seat, guild)
        }
    })
}

describe('GuildAction: R-4.6-H1 the Noble trade', () => {
    const R1C1 = 'guild.noble.scroll.r1c1'
    const R1C3 = 'guild.noble.scroll.r1c3'
    const R2C2 = 'guild.noble.scroll.r2c2'

    it('R-4.6-H1 one seal from the scrolls for 3s, red side up and named in no record', () => {
        const { table, playerId } = nobleTrading([R1C1, R1C3])
        const before = table.hydrated()
        const sealId = before.requireVault().scrollSeals[R1C1]
        const held = before.getPlayerState(playerId).sealCount
        const pile = before.supply.sealPileCount
        const [action] = table.send(playerId, {
            ...NobleTrade,
            params: { scrollSpaces: [R1C1] }
        })
        const after = table.hydrated()
        expect(after.guilds.noble.scrolls[R1C1]).toBe(false)
        expect(after.guilds.noble.scrolls[R1C3]).toBe(true)
        expect(after.requireVault().scrollSeals[R1C1]).toBeUndefined()
        expect(after.requireVault().heldSeals[playerId]).toContain(sealId)
        expect(table.seat(playerId).sealCount).toBe(held + 1)
        expect(table.seat(playerId).shillings).toBe(3)
        expect(after.supply.sealPileCount).toBe(pile)
        expect(action).toMatchObject({
            metadata: { details: { kind: 'noble-trade', price: 3 }, points: 0 }
        })
        expect(recordedText(action)).not.toContain('seal.')
        expect(action.revealsInfo).toBeFalsy()
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.6-H1 two seals for 6s', () => {
        const { table, playerId } = nobleTrading([R1C1, R1C3])
        const [action] = table.send(playerId, {
            ...NobleTrade,
            params: { scrollSpaces: [R1C1, R1C3] }
        })
        expect(table.seat(playerId).shillings).toBe(0)
        expect(action).toMatchObject({ metadata: { details: { price: 6 } } })
    })

    it('R-4.6-H1 refuses none, more than 2, an empty space and one space twice', () => {
        const { table, playerId } = nobleTrading([R1C1, R1C3, R2C2], 9)
        const send = (scrollSpaces: ScrollSpaceId[]) => () =>
            table.send(playerId, { ...NobleTrade, params: { scrollSpaces } })
        expect(send([])).toThrow('Pick up to 2 seals on the scrolls.')
        expect(send([R1C1, R1C3, R2C2])).toThrow('Buy at most 2 seals.')
        expect(send(['guild.noble.scroll.r3c1'])).toThrow('No seal lies on that scroll space.')
        expect(send([R1C1, R1C1])).toThrow('No seal lies on that scroll space.')
    })

    it('R-4.6.2 refuses seals the seat cannot pay for, at the whole price', () => {
        const { table, playerId } = nobleTrading([R1C1, R1C3], 5)
        expect(() =>
            table.send(playerId, { ...NobleTrade, params: { scrollSpaces: [R1C1, R1C3] } })
        ).toThrow('Those seals cost 6 shillings.')
    })

    it('R-4.6-H1 no seal on the scrolls: nothing to buy, whatever the general supply holds', () => {
        const { table, playerId } = nobleTrading([])
        expect(table.hydrated().supply.sealPileCount).toBeGreaterThan(0)
        expect(() =>
            table.send(playerId, { ...NobleTrade, params: { scrollSpaces: [R1C1] } })
        ).toThrow('No seal lies on the scrolls.')
    })

    it('R-4.6.2 is closed with too few shillings for one', () => {
        const { table, playerId } = nobleTrading([R1C1], 2)
        expect(() =>
            table.send(playerId, { ...NobleTrade, params: { scrollSpaces: [R1C1] } })
        ).toThrow('A seal costs 3 shillings.')
    })

    it('R-4.6.2, R-4.6-H3 the price pays the guild; a master pays themselves', () => {
        const { table, playerId } = nobleTrading([R1C1], 3, 'noble')
        const charity = charityTotal(table.hydrated())
        const [action] = table.send(playerId, {
            ...NobleTrade,
            params: { scrollSpaces: [R1C1] }
        })
        expect(table.seat(playerId).shillings).toBe(1)
        expect(charityTotal(table.hydrated())).toBe(charity + 1)
        expect(action).toMatchObject({
            metadata: {
                payment: { members: [{ playerId, amount: 1 }], charity: { amount: 1 } }
            }
        })
    })

    it('R-4.6-H1 offers each seal on the scrolls and the most one trade buys', () => {
        const { table } = nobleTrading([R1C1])
        expect(nobleTradeOffer(table.hydrated())).toEqual({
            price: 3,
            scrollSpaces: [R1C1],
            most: 1
        })
    })

    it('R-5-H1 previews the price and split without reading the vault', () => {
        const { table, playerId } = nobleTrading([R1C1, R1C3])
        const state = table.hydrated()
        state.vault = undefined
        const input = { guildId: 'noble', fn: 'trade' } as const
        expect(
            guildActionPreview(state, playerId, { ...input, params: { scrollSpaces: [R1C1] } })
        ).toMatchObject({
            details: { kind: 'noble-trade', price: 3 },
            payment: expect.any(Object),
            points: 0,
            revealsInfo: false
        })
        expect(guildActionPreview(state, playerId, { ...input, params: {} })).toMatchObject({
            refused: 'Pick up to 2 seals on the scrolls.'
        })
        expect(
            guildActionPreview(state, playerId, {
                ...input,
                params: { scrollSpaces: [R2C2] }
            })
        ).toBeUndefined()
    })
})
