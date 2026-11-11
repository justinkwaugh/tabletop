import { describe, expect, it } from 'vitest'
import type { Good } from '../data/components.js'
import { MarketSpaces } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    setBarn,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setShillings,
    tableAtGuild,
    type GoodAmounts
} from '../testing/guilds.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'

const Trade = { type: ActionType.GuildAction, guildId: 'merchant', fn: 'trade' } as const
const Pull = { type: ActionType.GuildAction, guildId: 'merchant', fn: 'pull' } as const
const Push = { type: ActionType.GuildAction, guildId: 'merchant', fn: 'push' } as const

/** The market's printed prices, each bin from its first space to its last (R-1.3). */
const PrintedPrices: readonly { good: Good; prices: readonly number[] }[] = [
    { good: 'saltpeter', prices: [4, 3, 2, 2] },
    { good: 'sulfur', prices: [3, 3, 2, 1] },
    { good: 'iron', prices: [3, 2, 1, 1] },
    { good: 'wood', prices: [2, 2, 1, 1] },
    { good: 'food', prices: [2, 1, 1, 1] }
]

const PrintedSpaces = PrintedPrices.flatMap(({ good, prices }) =>
    prices.map((price, index) => ({ good, space: index + 1, price }))
)

describe('R-1.3, R-4.6.3 the printed market prices', () => {
    it('R-1.3 the data holds all 20, and the 18 filled at setup are all but each last space', () => {
        expect(MarketSpaces.map(({ good, space, price }) => ({ good, space, price }))).toEqual(
            PrintedSpaces
        )
        expect(MarketSpaces.filter((space) => space.filledAtSetup)).toHaveLength(18)
    })

    it.each(PrintedSpaces)(
        'R-4.6.3 a trade pays $price for $good at space $space',
        ({ good, space, price }) => {
            const { table, playerId } = tableAtGuild((state, seat) => {
                setMarket(state, { [good]: space })
                setShillings(state, seat, price)
            })
            const [action] = table.send(playerId, { ...Trade, params: { goods: [good] } })
            expect(table.seat(playerId).shillings).toBe(0)
            expect(action).toMatchObject({
                metadata: {
                    details: {
                        kind: 'merchant-trade',
                        bought: [{ good, spaceId: `guild.merchant.space.${good}-${space}`, price }],
                        price
                    }
                }
            })
        }
    )
})

function journeymanTable(edit: (state: HydratedFeudumGameState) => void) {
    return tableAtGuild((state, seat, rest) => {
        setJourneyman(state, seat, 'merchant', rest[0])
        edit(state)
    })
}

/** Space 4 open in iron and wood, nothing else moves. */
function nearlyFull(state: HydratedFeudumGameState, barn: GoodAmounts): void {
    setMarket(state, { saltpeter: 4, sulfur: 4, iron: 3, wood: 3, food: 4 })
    setBarn(state, barn)
}

describe('GuildAction: R-4.6.4 the Merchant pull', () => {
    it('R-4.6.4, R-4.7-H1 moves barn goods into their bins, left to right; below the threshold, no points and a reeve offered', () => {
        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, { iron: 1 })
            setBarn(state, { iron: 2, wood: 1 })
        })
        const score = table.seat(playerId).score
        const haversack = table.hydrated().supply.haversack
        const [action] = table.send(playerId, {
            ...Pull,
            params: { goods: ['iron', 'wood', 'iron'] }
        })
        const state = table.hydrated()
        expect(state.guilds.merchant.market['guild.merchant.space.iron-2']).toBe(true)
        expect(state.guilds.merchant.market['guild.merchant.space.iron-3']).toBe(true)
        expect(state.guilds.merchant.market['guild.merchant.space.wood-1']).toBe(true)
        expect(state.guilds.farmer.barn).toMatchObject({ iron: 0, wood: 0 })
        expect(state.supply.haversack).toEqual(haversack)
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            metadata: {
                completions: 0,
                points: 0,
                reeveOffered: true,
                drawnWritIds: [],
                details: {
                    kind: 'merchant-pull',
                    spaces: [
                        'guild.merchant.space.iron-2',
                        'guild.merchant.space.wood-1',
                        'guild.merchant.space.iron-3'
                    ],
                    rows: 0,
                    columns: 0
                }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.4 a completed row reaches the threshold: 3 vp, 2 writs drawn, 1 kept, a barrier', () => {
        const { table, playerId } = journeymanTable((state) => nearlyFull(state, { wood: 1 }))
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { ...Pull, params: { goods: ['wood'] } })
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1,
                details: { kind: 'merchant-pull', rows: 1 }
            }
        })
        expect(action.revealsInfo).toBe(true)
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
        expect(table.asked).toBe(playerId)
    })

    it('R-4.6.4 a completed column reaches it too, once however many lines complete', () => {
        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 3, food: 4 })
            setBarn(state, { saltpeter: 1, sulfur: 1, iron: 1 })
        })
        const preview = guildActionPreview(table.hydrated(), playerId, {
            guildId: 'merchant',
            fn: 'pull',
            params: { goods: ['saltpeter', 'sulfur', 'iron'] }
        })
        expect(preview).toMatchObject({ completions: 1, points: 3, rows: 3, revealsInfo: true })

        const column = journeymanTable((state) => {
            setMarket(state, { saltpeter: 1, sulfur: 2, iron: 2, wood: 2, food: 2 })
            setBarn(state, { saltpeter: 1 })
        })
        const [action] = column.table.send(column.playerId, {
            ...Pull,
            params: { goods: ['saltpeter'] }
        })
        expect(action).toMatchObject({
            metadata: { completions: 1, points: 3, details: { rows: 0, columns: 1 } }
        })
    })

    it('R-3.16.1 only the journeyman pulls', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'merchant')
            setBarn(state, { wood: 1 })
            setMarket(state, {})
        })
        expect(() => table.send(playerId, { ...Pull, params: { goods: ['wood'] } })).toThrow(
            'Only the Merchant journeyman pulls.'
        )
    })

    it('R-4.6.1 is closed with nothing to move, and refuses what the barn or bin cannot do', () => {
        const stuck = journeymanTable((state) => {
            setMarket(state, { wood: 4 })
            setBarn(state, { wood: 2 })
        })
        expect(() =>
            stuck.table.send(stuck.playerId, { ...Pull, params: { goods: ['wood'] } })
        ).toThrow('No barn good fits in the market.')

        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, { wood: 3 })
            setBarn(state, { wood: 2, iron: 5 })
        })
        const send = (goods: Good[]) => table.send(playerId, { ...Pull, params: { goods } })
        expect(() => send(['iron', 'iron', 'iron', 'iron'])).toThrow('Move at most 3 goods.')
        expect(() => send(['food'])).toThrow('The barn holds only 0 food.')
        expect(() => send(['wood', 'wood'])).toThrow('The wood bin has room for 1.')
    })

    it('R-4.6-H5 must move as many as fit, up to 3', () => {
        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, {})
            setBarn(state, { wood: 5 })
        })
        expect(() => table.send(playerId, { ...Pull, params: { goods: ['wood'] } })).toThrow(
            '3 goods fit: move them all.'
        )
    })

    it('R-4.6-H5 moves fewer when only that many fit', () => {
        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, { saltpeter: 4, sulfur: 4, iron: 4, wood: 4, food: 3 })
            setBarn(state, { food: 5, wood: 5 })
        })
        const [action] = table.send(playerId, { ...Pull, params: { goods: ['food'] } })
        expect(table.hydrated().guilds.farmer.barn.food).toBe(4)
        expect(action).toMatchObject({ metadata: { details: { rows: 1, columns: 1 } } })
    })

    it('R-4.6.4 offers the best it can reach, and previews a staged input', () => {
        const { table, playerId } = journeymanTable((state) => nearlyFull(state, { wood: 1 }))
        const state = table.hydrated()
        const offer = guildActionOffers(state, playerId).find(
            ({ guildId, fn }) => guildId === 'merchant' && fn === 'pull'
        )
        expect(offer).toMatchObject({ bestVp: 3 })
        expect(offer?.reason).toBeUndefined()
        expect(
            guildActionPreview(state, playerId, {
                guildId: 'merchant',
                fn: 'pull',
                params: {}
            })
        ).toMatchObject({ completions: 0, refused: '1 goods fit: move them all.' })
        expect(
            guildActionPreview(state, playerId, {
                guildId: 'merchant',
                fn: 'pull',
                params: { goods: ['food'] }
            })
        ).toBeUndefined()
        expect(state.guilds.farmer.barn.wood).toBe(1)
    })
})

describe('GuildAction: R-4.6.5 the Merchant push', () => {
    function masterTable(market: GoodAmounts, carts: GoodAmounts) {
        return tableAtGuild((state, seat) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, market)
            setCarts(state, carts)
        })
    }

    it('R-4.6.5, R-4.6-H7 goods leave the highest filled space for the lowest empty one', () => {
        const { table, playerId } = masterTable({ iron: 2, wood: 3 }, { iron: 1 })
        const haversack = table.hydrated().supply.haversack
        const [action] = table.send(playerId, {
            ...Push,
            params: { goods: ['iron', 'wood', 'iron', 'wood'] }
        })
        const state = table.hydrated()
        const { market } = state.guilds.merchant
        const { carts } = state.guilds.alchemist
        expect(market['guild.merchant.space.iron-1']).toBe(false)
        expect(market['guild.merchant.space.wood-3']).toBe(false)
        expect(market['guild.merchant.space.wood-1']).toBe(true)
        expect(carts['guild.alchemist.cart.iron-3']).toBe(true)
        expect(carts['guild.alchemist.cart.wood-2']).toBe(true)
        expect(carts['guild.alchemist.cart.wood-3']).toBe(false)
        expect(state.supply.haversack).toEqual(haversack)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 4,
                details: {
                    kind: 'merchant-push',
                    moves: [
                        {
                            from: 'guild.merchant.space.iron-2',
                            to: 'guild.alchemist.cart.iron-2'
                        },
                        {
                            from: 'guild.merchant.space.wood-3',
                            to: 'guild.alchemist.cart.wood-1'
                        },
                        {
                            from: 'guild.merchant.space.iron-1',
                            to: 'guild.alchemist.cart.iron-3'
                        },
                        {
                            from: 'guild.merchant.space.wood-2',
                            to: 'guild.alchemist.cart.wood-2'
                        }
                    ],
                    completed: ['iron']
                }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it.each<{ carts: GoodAmounts; goods: Good[]; done: number; vp: number }>([
        {
            carts: { wood: 3, iron: 2, food: 2, sulfur: 3, saltpeter: 2 },
            goods: ['iron', 'food', 'saltpeter'],
            done: 3,
            vp: 6
        },
        {
            carts: { wood: 2, iron: 2, food: 0, sulfur: 3, saltpeter: 3 },
            goods: ['wood', 'iron', 'food', 'food'],
            done: 2,
            vp: 5
        },
        {
            carts: { wood: 2, iron: 0, food: 0, sulfur: 3, saltpeter: 3 },
            goods: ['wood', 'iron', 'food', 'food'],
            done: 1,
            vp: 4
        }
    ])('R-4.6.5 $done completed scores $vp vp', ({ carts, goods, done, vp }) => {
        const { table, playerId } = masterTable({ wood: 4, iron: 4, food: 4, saltpeter: 3 }, carts)
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { ...Push, params: { goods } })
        expect(table.seat(playerId).score).toBe(score + vp)
        expect(action).toMatchObject({ metadata: { completions: done, points: vp } })
    })

    it('R-4.6.1, R-4.7-H1 a cart already full is no completion, and takes nothing; a reeve is offered', () => {
        const { table, playerId } = masterTable(
            { wood: 4, iron: 1 },
            { wood: 3, iron: 0, food: 3, sulfur: 3, saltpeter: 3 }
        )
        expect(() => table.send(playerId, { ...Push, params: { goods: ['wood'] } })).toThrow(
            'Only 0 wood fit in the carts and piles.'
        )
        const [action] = table.send(playerId, { ...Push, params: { goods: ['iron'] } })
        expect(action).toMatchObject({
            metadata: { completions: 0, points: 0, reeveOffered: true, details: { completed: [] } }
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.7 a scoring push offers a reeve', () => {
        const { table, playerId } = masterTable(
            { wood: 1 },
            { wood: 2, iron: 3, food: 3, sulfur: 3, saltpeter: 3 }
        )
        const [action] = table.send(playerId, { ...Push, params: { goods: ['wood'] } })
        expect(action).toMatchObject({ metadata: { points: 4, reeveOffered: true } })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-3.16.1 only the master pushes', () => {
        const { table, playerId } = journeymanTable((state) => {
            setMarket(state, { wood: 1 })
            setCarts(state, {})
        })
        expect(() => table.send(playerId, { ...Push, params: { goods: ['wood'] } })).toThrow(
            'Only the Merchant master pushes.'
        )
    })

    it('R-4.6.1, R-4.6-H5 is closed with nothing to move; takes at most 4, and as many as fit', () => {
        const stuck = masterTable({}, { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 })
        expect(() =>
            stuck.table.send(stuck.playerId, { ...Push, params: { goods: ['wood'] } })
        ).toThrow('No market good fits in the carts and piles.')

        const { table, playerId } = masterTable({ wood: 4, iron: 4, food: 1 }, {})
        const send = (goods: Good[]) => table.send(playerId, { ...Push, params: { goods } })
        expect(() => send(['wood', 'wood', 'iron', 'iron', 'iron'])).toThrow(
            'Move at most 4 goods.'
        )
        expect(() => send(['wood'])).toThrow('4 goods fit: move them all.')
        expect(() => send(['food', 'food'])).toThrow('The market holds only 1 food.')
        expect(() => send(['wood', 'wood', 'wood', 'wood'])).toThrow(
            'Only 3 wood fit in the carts and piles.'
        )
    })

    it('R-4.6.5 offers the most it can complete, and previews without moving anything', () => {
        const { table, playerId } = masterTable(
            { wood: 4, iron: 4, food: 4 },
            { wood: 2, iron: 2, food: 1, sulfur: 3, saltpeter: 3 }
        )
        const state = table.hydrated()
        expect(
            guildActionOffers(state, playerId).find(
                ({ guildId, fn }) => guildId === 'merchant' && fn === 'push'
            )
        ).toMatchObject({ bestVp: 6 })
        expect(
            guildActionPreview(state, playerId, {
                guildId: 'merchant',
                fn: 'push',
                params: { goods: ['wood', 'iron'] }
            })
        ).toMatchObject({
            completions: 2,
            points: 5,
            revealsInfo: false,
            details: { kind: 'merchant-push', completed: ['iron', 'wood'] },
            refused: '4 goods fit: move them all.'
        })
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.wood-3']).toBe(false)
    })
})
