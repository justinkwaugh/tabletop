import { describe, expect, it } from 'vitest'
import { Goods, type Good, type VesselType } from '../data/components.js'
import { AlchemistCartSpaces } from '../data/guilds.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { InventionChoice } from '../guilds/guildFunctionDetails.js'
import { inventionGoods, inventionOffers } from '../guilds/inventions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ferriesOpen } from '../model/media.js'
import {
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setRowMarkers,
    setVesselsForSale,
    tableAtGuild,
    type GoodAmounts
} from '../testing/guilds.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { setUp } from '../testing/improving.js'
import { guildActionOffers, guildActionPreview } from './guildAction.js'

const Pull = { type: ActionType.GuildAction, guildId: 'alchemist', fn: 'pull' } as const
const Push = { type: ActionType.GuildAction, guildId: 'alchemist', fn: 'push' } as const
const Krud: InventionChoice = 'krud-barrel'

function journeymanTable(market: GoodAmounts, carts: GoodAmounts) {
    return tableAtGuild((state, seat, rest) => {
        setJourneyman(state, seat, 'alchemist', rest[0])
        setMarket(state, market)
        setCarts(state, carts)
    })
}

function masterTable(carts: GoodAmounts, edit?: (state: HydratedFeudumGameState) => void) {
    return tableAtGuild((state, seat) => {
        setMaster(state, seat, 'alchemist')
        setCarts(state, carts)
        setVesselsForSale(state, [])
        edit?.(state)
    })
}

describe('R-1.3 the carts and piles', () => {
    it('R-1.3 the saltpeter pile holds 3, as each cart and pile does', () => {
        for (const good of Goods) {
            expect(AlchemistCartSpaces.filter((space) => space.good === good)).toHaveLength(3)
        }
    })

    it('R-1.3 the third saltpeter completes the pile, and a full pile takes no more', () => {
        const { table, playerId } = journeymanTable({ saltpeter: 1 }, { saltpeter: 2 })
        const [action] = table.send(playerId, { ...Pull, params: { goods: ['saltpeter'] } })
        expect(table.hydrated().guilds.alchemist.carts['guild.alchemist.cart.saltpeter-3']).toBe(
            true
        )
        expect(action).toMatchObject({ metadata: { details: { completed: ['saltpeter'] } } })

        const full = journeymanTable({ saltpeter: 1 }, { saltpeter: 3 })
        expect(() =>
            full.table.send(full.playerId, { ...Pull, params: { goods: ['saltpeter'] } })
        ).toThrow('No market good fits in the carts and piles.')
    })
})

describe('GuildAction: R-4.6.4 the Alchemist pull', () => {
    it('R-4.6.4, R-4.7-H1 two market goods into the carts; no cart completed, no points, no barrier, a reeve offered', () => {
        const { table, playerId } = journeymanTable({ iron: 3, food: 1 }, {})
        const score = table.seat(playerId).score
        const haversack = table.hydrated().supply.haversack
        const [action] = table.send(playerId, { ...Pull, params: { goods: ['iron', 'food'] } })
        const state = table.hydrated()
        expect(state.guilds.merchant.market['guild.merchant.space.iron-3']).toBe(false)
        expect(state.guilds.merchant.market['guild.merchant.space.food-1']).toBe(false)
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.iron-1']).toBe(true)
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.food-1']).toBe(true)
        expect(state.supply.haversack).toEqual(haversack)
        expect(table.seat(playerId).score).toBe(score)
        expect(action).toMatchObject({
            metadata: {
                completions: 0,
                points: 0,
                reeveOffered: true,
                drawnWritIds: [],
                details: { kind: 'alchemist-pull', completed: [] }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.4 a cart or pile completed: 3 vp, 2 writs drawn, 1 kept, a barrier, however many', () => {
        const { table, playerId } = journeymanTable(
            { wood: 1, iron: 1 },
            { wood: 2, iron: 2, food: 3, sulfur: 3, saltpeter: 3 }
        )
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, { ...Pull, params: { goods: ['wood', 'iron'] } })
        expect(table.seat(playerId).score).toBe(score + 3)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 3,
                drawnCount: 2,
                keep: 1,
                details: { completed: ['iron', 'wood'] }
            }
        })
        expect(action.revealsInfo).toBe(true)
        expect(table.state.machineState).toBe(MachineState.KeepingWrits)
    })

    it('R-3.16.1 only the journeyman pulls', () => {
        const { table, playerId } = tableAtGuild((state, seat) => {
            setMaster(state, seat, 'alchemist')
            setMarket(state, { wood: 1 })
            setCarts(state, {})
        })
        expect(() => table.send(playerId, { ...Pull, params: { goods: ['wood'] } })).toThrow(
            'Only the Alchemist journeyman pulls.'
        )
    })

    it('R-4.6.1, R-4.6-H5 takes at most 2, and as many as fit', () => {
        const { table, playerId } = journeymanTable({ wood: 4 }, {})
        const send = (goods: Good[]) => table.send(playerId, { ...Pull, params: { goods } })
        expect(() => send(['wood', 'wood', 'wood'])).toThrow('Move at most 2 goods.')
        expect(() => send(['wood'])).toThrow('2 goods fit: move them all.')
        expect(() => send(['iron', 'wood'])).toThrow('The market holds only 0 iron.')

        const fewer = journeymanTable({ wood: 4 }, { wood: 2, iron: 3, food: 3, sulfur: 3 })
        const [action] = fewer.table.send(fewer.playerId, { ...Pull, params: { goods: ['wood'] } })
        expect(action).toMatchObject({ metadata: { completions: 1, points: 3 } })
    })

    it('R-4.6.4 offers the threshold, and previews both outcomes without moving anything', () => {
        const { table, playerId } = journeymanTable(
            { wood: 1, iron: 2 },
            { wood: 2, iron: 0, food: 3, sulfur: 3, saltpeter: 3 }
        )
        const state = table.hydrated()
        expect(
            guildActionOffers(state, playerId).find(
                ({ guildId, fn }) => guildId === 'alchemist' && fn === 'pull'
            )
        ).toMatchObject({ bestVp: 3 })
        const preview = (goods: Good[]) =>
            guildActionPreview(state, playerId, {
                guildId: 'alchemist',
                fn: 'pull',
                params: { goods }
            })
        expect(preview(['wood', 'iron'])).toMatchObject({
            completions: 1,
            points: 3,
            revealsInfo: true
        })
        expect(preview(['iron', 'iron'])).toMatchObject({
            completions: 0,
            points: 0,
            revealsInfo: false
        })
        expect(preview(['food'])).toBeUndefined()
        expect(state.guilds.alchemist.carts['guild.alchemist.cart.wood-3']).toBe(false)
    })
})

describe('GuildAction: R-4.6.5 the Alchemist push', () => {
    it.each<{ vessel: VesselType; carts: GoodAmounts }>([
        { vessel: 'ship', carts: { food: 1, wood: 2 } },
        { vessel: 'submersible', carts: { food: 1, iron: 2 } },
        { vessel: 'flying-machine', carts: { food: 1, iron: 1, wood: 1 } }
    ])(
        'R-4.6.5 $vessel: its recipe to the haversack, onto the vessel space',
        ({ vessel, carts }) => {
            const { table, playerId } = masterTable(carts)
            const before = table.hydrated()
            const inSupply = before.supply.vessels[vessel]
            expect(ferriesOpen(before)).toBe(true)
            const [action] = table.send(playerId, { ...Push, params: { inventions: [vessel] } })
            const state = table.hydrated()
            expect(state.guilds.alchemist.vesselsForSale).toEqual([vessel])
            expect(state.supply.vessels[vessel]).toBe(inSupply - 1)
            expect(ferriesOpen(state)).toBe(false)
            for (const good of Goods) {
                const used = carts[good] ?? 0
                expect(state.supply.haversack[good]).toBe(before.supply.haversack[good] + used)
            }
            expect(Object.values(state.guilds.alchemist.carts).some(Boolean)).toBe(false)
            expect(action).toMatchObject({
                metadata: {
                    completions: 1,
                    points: 4,
                    details: { kind: 'alchemist-push', goodsUsed: carts, barrels: [] }
                }
            })
            expect(action.revealsInfo).toBeFalsy()
        }
    )

    it.each([
        { inventions: ['ship'], vp: 4 },
        { inventions: ['ship', 'submersible'], vp: 5 },
        { inventions: ['ship', 'submersible', 'flying-machine'], vp: 6 }
    ] as const)('R-4.6.5 $inventions.length inventions score $vp vp', ({ inventions, vp }) => {
        const { table, playerId } = masterTable({ food: 3, wood: 3, iron: 3 })
        const score = table.seat(playerId).score
        const [action] = table.send(playerId, {
            ...Push,
            params: { inventions: [...inventions] }
        })
        expect(table.seat(playerId).score).toBe(score + vp)
        expect(action).toMatchObject({
            metadata: { completions: inventions.length, points: vp, reeveOffered: true }
        })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })

    it('R-4.6.5 refuses none, more than 3, or more than the carts hold', () => {
        const { table, playerId } = masterTable({ food: 1, wood: 3, iron: 3 })
        const send = (inventions: InventionChoice[]) =>
            table.send(playerId, { ...Push, params: { inventions } })
        expect(() => send([])).toThrow('Pick up to 3 inventions.')
        expect(() => send(['ship', 'ship', 'ship', 'ship'])).toThrow('Invent at most 3.')
        expect(() => send(['ship', 'submersible'])).toThrow(
            'That needs 2 food; the carts and piles hold 1.'
        )
    })

    it('R-4.6-H8 a vessel needs one in the general supply', () => {
        const { table, playerId } = masterTable({ food: 3, wood: 3, iron: 3 }, (state) => {
            setVesselsForSale(state, ['ship', 'ship'])
            const seat = state.players[0]
            state.supply.vessels.ship -= 1
            seat.vessels.ship += 1
        })
        expect(() => table.send(playerId, { ...Push, params: { inventions: ['ship'] } })).toThrow(
            'The general supply has only 0 ship.'
        )
    })

    it('R-4.6.5 is closed when nothing can be invented', () => {
        const { table, playerId } = masterTable({ food: 3 })
        expect(() => table.send(playerId, { ...Push, params: { inventions: ['ship'] } })).toThrow(
            'Nothing can be invented from the carts and piles.'
        )
    })

    it('R-3.16.1 only the master pushes', () => {
        const { table, playerId } = journeymanTable({}, { food: 1, wood: 2 })
        expect(() => table.send(playerId, { ...Push, params: { inventions: ['ship'] } })).toThrow(
            'Only the Alchemist master pushes.'
        )
    })
})

describe('GuildAction: R-4.6.6 krud barrels', () => {
    const FirstBarrel: GoodAmounts = { saltpeter: 2, sulfur: 1 }

    function rows(table: { hydrated(): HydratedFeudumGameState }) {
        return table.hydrated().guilds.knight.rows.map((row) => row.markers)
    }

    it('R-4.6.6 fills the leading unfilled section of every row: full 0, 3 of 6 adds 3, 2 adds 1, empty 1', () => {
        const { table, playerId } = masterTable(FirstBarrel, (state) =>
            setRowMarkers(state, [6, 3, 2, 0])
        )
        const before = table.hydrated()
        const [first, second, third, fourth] = before.guilds.knight.rows
        const [action] = table.send(playerId, { ...Push, params: { inventions: [Krud] } })
        expect(rows(table)).toEqual([6, 6, 3, 1])
        const { influence } = table.hydrated().supply
        expect(influence[first.colour]).toBe(before.supply.influence[first.colour])
        expect(influence[second.colour]).toBe(before.supply.influence[second.colour] - 3)
        expect(influence[third.colour]).toBe(before.supply.influence[third.colour] - 1)
        expect(influence[fourth.colour]).toBe(before.supply.influence[fourth.colour] - 1)
        expect(action).toMatchObject({
            metadata: {
                completions: 1,
                points: 4,
                details: {
                    kind: 'alchemist-push',
                    goodsUsed: FirstBarrel,
                    barrels: [
                        [
                            { colour: second.colour, playerId: second.playerId, added: 3 },
                            { colour: third.colour, playerId: third.playerId, added: 1 },
                            { colour: fourth.colour, playerId: fourth.playerId, added: 1 }
                        ]
                    ]
                }
            }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-4.6.6 a row at 1 of 6 takes the 2 of its second section', () => {
        const { table, playerId } = masterTable(FirstBarrel, (state) =>
            setRowMarkers(state, [1, 6, 6, 6])
        )
        table.send(playerId, { ...Push, params: { inventions: [Krud] } })
        expect(rows(table)).toEqual([3, 6, 6, 6])
    })

    it('R-4.6.6, R-1.4-H1 dummy rows fill alike, and name no seat', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['guild', 'move', 'tax'] }), 2)
        const playerId = table.asked
        setUp(table, (state) => {
            setMaster(state, playerId, 'alchemist')
            setCarts(state, FirstBarrel)
            setRowMarkers(state, [6, 6, 0, 2])
        })
        const dummy = table.hydrated().guilds.knight.rows[2]
        expect(dummy.playerId).toBeUndefined()
        const [action] = table.send(playerId, { ...Push, params: { inventions: [Krud] } })
        expect(table.hydrated().guilds.knight.rows.map((row) => row.markers)).toEqual([6, 6, 1, 3])
        expect(action).toMatchObject({
            metadata: { details: { barrels: [[{ colour: dummy.colour, added: 1 }, {}]] } }
        })
    })

    it('R-4.6.5, R-4.6-H4 barrels cost the 1st, 2nd and 3rd price within this push', () => {
        const { table, playerId } = masterTable({ saltpeter: 3, sulfur: 2, wood: 1 }, (state) =>
            setRowMarkers(state, [0, 0, 0, 0])
        )
        const haversack = table.hydrated().supply.haversack
        const [action] = table.send(playerId, {
            ...Push,
            params: { inventions: [Krud, Krud, Krud] }
        })
        expect(rows(table)).toEqual([6, 6, 6, 6])
        const state = table.hydrated()
        expect(Object.values(state.guilds.alchemist.carts).some(Boolean)).toBe(false)
        expect(state.supply.haversack).toMatchObject({
            saltpeter: haversack.saltpeter + 3,
            sulfur: haversack.sulfur + 2,
            wood: haversack.wood + 1
        })
        expect(action).toMatchObject({
            metadata: { completions: 3, points: 6, details: { barrels: [{}, {}, {}] } }
        })
    })

    it('R-4.6-H4 the next action prices its first barrel at the first price again', () => {
        expect(inventionGoods([Krud])).toMatchObject({ saltpeter: 2, sulfur: 1, wood: 0 })
        expect(inventionGoods([Krud, 'ship', Krud])).toMatchObject({
            saltpeter: 3,
            sulfur: 2,
            food: 1,
            wood: 2
        })
        const { table } = masterTable({ ...FirstBarrel })
        const offer = inventionOffers(table.hydrated()).find(({ invention }) => invention === Krud)
        expect(offer).toMatchObject({ goods: FirstBarrel })
        expect(offer?.reason).toBeUndefined()
    })

    it('R-4.6.6 a barrel needs a row with an unfilled section, counted through this push', () => {
        const carts = { saltpeter: 3, sulfur: 3, wood: 3 }
        const full = masterTable(carts, (state) => setRowMarkers(state, [6, 6, 6, 6]))
        expect(() =>
            full.table.send(full.playerId, { ...Push, params: { inventions: [Krud] } })
        ).toThrow('Nothing can be invented from the carts and piles.')

        const { table, playerId } = masterTable(carts, (state) =>
            setRowMarkers(state, [3, 3, 6, 6])
        )
        expect(() =>
            table.send(playerId, { ...Push, params: { inventions: [Krud, Krud] } })
        ).toThrow('No Knight row has an unfilled section left.')
        table.send(playerId, { ...Push, params: { inventions: [Krud] } })
        expect(rows(table)).toEqual([6, 6, 6, 6])
    })

    it('R-4.6-H8 a row takes what the general supply has, and the barrel still scores', () => {
        const { table, playerId } = masterTable(FirstBarrel, (state) => {
            setRowMarkers(state, [3, 6, 6, 6])
            const [{ colour, playerId: seat }] = state.guilds.knight.rows
            const left = state.supply.influence[colour]
            state.supply.influence[colour] = 1
            if (seat) {
                state.getPlayerState(seat).influenceSupply += left - 1
            }
        })
        const [action] = table.send(playerId, { ...Push, params: { inventions: [Krud] } })
        expect(rows(table)).toEqual([4, 6, 6, 6])
        expect(action).toMatchObject({ metadata: { points: 4 } })
    })

    it('R-4.6.5 offers the most it can invent, and previews without moving anything', () => {
        const { table, playerId } = masterTable(
            { saltpeter: 3, sulfur: 2, wood: 1, food: 1, iron: 2 },
            (state) => setRowMarkers(state, [0, 6, 6, 6])
        )
        const state = table.hydrated()
        expect(
            guildActionOffers(state, playerId).find(
                ({ guildId, fn }) => guildId === 'alchemist' && fn === 'push'
            )
        ).toMatchObject({ bestVp: 6 })
        const preview = guildActionPreview(state, playerId, {
            guildId: 'alchemist',
            fn: 'push',
            params: { inventions: [Krud, 'submersible'] }
        })
        expect(preview).toMatchObject({
            completions: 2,
            points: 5,
            revealsInfo: false,
            details: {
                goodsUsed: { saltpeter: 2, sulfur: 1, food: 1, iron: 2 },
                barrels: [[{ added: 1 }]]
            }
        })
        expect(preview?.refused).toBeUndefined()
        expect(state.guilds.knight.rows[0].markers).toBe(0)
        expect(state.guilds.alchemist.vesselsForSale).toEqual([])
        expect(
            guildActionPreview(state, playerId, {
                guildId: 'alchemist',
                fn: 'push',
                params: { inventions: ['ship', 'ship'] }
            })
        ).toBeUndefined()
        expect(
            guildActionPreview(state, playerId, { guildId: 'alchemist', fn: 'push', params: {} })
        ).toMatchObject({ completions: 0, refused: 'Pick up to 3 inventions.' })
    })
})
