import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { fillLandscape } from '../model/landscapes.js'
import { placeMarker } from '../model/locationControl.js'
import { canPayGoods, canSpendWildTiles, spendWildTiles } from '../model/payments.js'
import type { TileId } from '../data/regionTiles.js'
import { FarmerMandate, giveTile, tableInWindow } from '../testing/atWill.js'
import { holdWrit } from '../testing/combat.js'
import { setMarket, setMaster, setPawns, setShillings, tableAtGuild } from '../testing/guilds.js'
import { collectTileOf, giveGood, setUp, spaceOfKind } from '../testing/improving.js'
import { endCardTurn, giveCardTurn, tableAtPlayingCards } from '../testing/table.js'
import { merchantTradeOffers } from '../guilds/merchant.js'
import { chooseFavoursOffer, reasonChooseFavoursRefused } from './chooseFavours.js'
import { tendLandscapePreview } from './tendLandscape.js'

const Trade = { type: ActionType.GuildAction, guildId: 'merchant', fn: 'trade' } as const

function setBarrel(state: HydratedFeudumGameState, playerId: string, barrel: number): void {
    const seat = state.getPlayerState(playerId)
    state.supply.haversack.sulfur += seat.barrel - barrel
    seat.barrel = barrel
}

/** R-4.6.3 The seat masters the Merchant Guild, with sulfur on sale and a full purse. */
function merchant(barrel = 0) {
    return tableAtGuild((state, seat) => {
        setMaster(state, seat, 'merchant')
        setMarket(state, { sulfur: 3, iron: 2 })
        setShillings(state, seat, 20)
        setBarrel(state, seat, barrel)
    })
}

describe('R-4.10.2 a Merchant trade', () => {
    it('R-4.6.3 sulfur bought goes to the supply by default', () => {
        const { table, playerId } = merchant()
        const { sulfur } = table.seat(playerId).goods

        table.send(playerId, { ...Trade, params: { goods: ['sulfur'] } })

        expect(table.seat(playerId).goods.sulfur).toBe(sulfur + 1)
        expect(table.seat(playerId).barrel).toBe(0)
    })

    it('R-4.10.2 the seat names how many go in the barrel', () => {
        const { table, playerId } = merchant()
        const { sulfur } = table.seat(playerId).goods

        table.send(playerId, {
            ...Trade,
            params: { goods: ['sulfur', 'sulfur'], sulfurToBarrel: 2 }
        })

        expect(table.seat(playerId).goods.sulfur).toBe(sulfur)
        expect(table.seat(playerId).barrel).toBe(2)
    })

    it('R-4.10.2 refuses more than it buys, or than fit', () => {
        const { table, playerId } = merchant(2)
        const buy = (goods: string[], sulfurToBarrel: number) => () =>
            table.send(playerId, { ...Trade, params: { goods, sulfurToBarrel } })

        expect(buy(['iron'], 1)).toThrow('Only sulfur goes in your barrel.')
        expect(buy(['sulfur'], 2)).toThrow('You gain only 1 sulfur.')
        expect(buy(['sulfur', 'sulfur'], 2)).toThrow('Your barrel has room for 1.')
    })

    it('R-4.10.2 the sulfur row of the offer says how many could', () => {
        const { table, playerId } = merchant(2)
        const offers = merchantTradeOffers(table.hydrated(), playerId)

        expect(offers.find((offer) => offer.good === 'sulfur')?.sulfurToBarrel).toBe(1)
        expect(offers.find((offer) => offer.good === 'iron')).not.toHaveProperty('sulfurToBarrel')
    })
})

/** The seat is serf under the next seat, holding a tile whose back is a sulfur mine. */
function serfOverMine(barrel = 0) {
    const table = tableAtPlayingCards(() => ({ cards: ['improve', 'move', 'tax', 'guild'] }))
    const playerId = table.asked
    const rulerId = table.order[1]
    const spaceId = spaceOfKind(table.hydrated(), 'farm')
    let tileId: TileId = 'tile.sea.i'
    setUp(table, (state) => {
        placeMarker(state, rulerId, spaceId)
        placeMarker(state, playerId, spaceId)
        state.recomputeRanks()
        giveGood(state, playerId, 'wood')
        setBarrel(state, playerId, barrel)
        tileId = collectTileOf(state, playerId, 'sulfur-mine')
    })
    return { table, playerId, rulerId, spaceId, tileId }
}

describe('R-4.10.2 a sulfur mine tended and collected at once', () => {
    function tend(start: ReturnType<typeof serfOverMine>, more: Record<string, unknown>) {
        return start.table.send(start.playerId, {
            type: ActionType.TendLandscape,
            tileId: start.tileId,
            spaceId: start.spaceId,
            collect: true,
            ...more
        })
    }

    it('R-4.10.2 the seat names how many of its share go in the barrel', () => {
        const start = serfOverMine()
        const { sulfur } = start.table.seat(start.playerId).goods
        const rulerSulfur = start.table.seat(start.rulerId).goods.sulfur

        tend(start, { sulfurToBarrel: 2 })

        expect(start.table.seat(start.playerId).goods.sulfur).toBe(sulfur)
        expect(start.table.seat(start.playerId).barrel).toBe(2)
        // R-4.10-H2 The ruler's share goes to the supply: the input is the serf's.
        expect(start.table.seat(start.rulerId).goods.sulfur).toBe(rulerSulfur + 1)
    })

    it('R-4.10.2 refuses more than its share, more than fit, or nothing collected', () => {
        const start = serfOverMine(2)

        expect(() => tend(start, { sulfurToBarrel: 3 })).toThrow('You gain only 2 sulfur.')
        expect(() => tend(start, { sulfurToBarrel: 2 })).toThrow('Your barrel has room for 1.')
        expect(() => tend(start, { collect: false, sulfurToBarrel: 1 })).toThrow(
            'Only sulfur goes in your barrel.'
        )
    })

    it('R-4.10.2 the preview says how many could', () => {
        const start = serfOverMine(2)

        expect(
            tendLandscapePreview(start.table.hydrated(), start.tileId, start.spaceId)
        ).toMatchObject({ sulfurKept: 2, sulfurToBarrel: 1 })
    })
})

describe('R-4.10.2 a sulfur mine collected at a dawn', () => {
    /** The seat tends a filled sulfur mine and is asked to collect. */
    function dawn(barrel = 0) {
        const start = serfOverMine(barrel)
        start.table.moveTo((state) => {
            const seat = state.getPlayerState(start.playerId)
            seat.regionTiles = seat.regionTiles.filter((id) => id !== start.tileId)
            state.spaces[start.spaceId].landscape = { tileId: start.tileId, amount: 0 }
            fillLandscape(state, start.spaceId)
            endCardTurn(state)
            state.flow.landscapes = { pending: [start.playerId] }
            return MachineState.CollectingLandscapes
        })
        return start
    }

    it('R-4.10.2 the seat names how many of its share go in the barrel', () => {
        const start = dawn()
        const { sulfur } = start.table.seat(start.playerId).goods

        start.table.send(start.playerId, {
            type: ActionType.CollectLandscapes,
            spaceIds: [start.spaceId],
            sulfurToBarrel: 1
        })

        expect(start.table.seat(start.playerId).goods.sulfur).toBe(sulfur + 1)
        expect(start.table.seat(start.playerId).barrel).toBe(1)
    })

    it('R-4.10.2 refuses more than its share, or than fit', () => {
        const start = dawn(2)
        const send = (sulfurToBarrel: number) => () =>
            start.table.send(start.playerId, {
                type: ActionType.CollectLandscapes,
                spaceIds: [start.spaceId],
                sulfurToBarrel
            })

        expect(send(3)).toThrow('You gain only 2 sulfur.')
        expect(send(2)).toThrow('Your barrel has room for 1.')
    })
})

describe('R-4.10.2 favours chosen from a harvest', () => {
    function choosing(barrel = 0) {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            setBarrel(state, seat, barrel)
        })
        table.moveTo((state) => {
            const drawn = { saltpeter: 0, sulfur: 2, iron: 1, wood: 0, food: 0 }
            state.supply.haversack.sulfur -= 2
            state.supply.haversack.iron -= 1
            state.flow.harvest = {
                playerId,
                spaceId: spaceOfKind(state, 'farm'),
                drawn,
                favours: 2
            }
            giveCardTurn(state, playerId, { followUps: [{ kind: 'inspect-harvest', playerId }] })
            return MachineState.InspectingHarvest
        })
        return { table, playerId }
    }
    const Sulfur2 = { saltpeter: 0, sulfur: 2, iron: 0, wood: 0, food: 0 }

    it('R-4.10.2 the seat names how many of the favours go in the barrel', () => {
        const { table, playerId } = choosing()
        const { sulfur } = table.seat(playerId).goods

        table.send(playerId, {
            type: ActionType.ChooseFavours,
            favours: Sulfur2,
            sulfurToBarrel: 1
        })

        expect(table.seat(playerId).goods.sulfur).toBe(sulfur + 1)
        expect(table.seat(playerId).barrel).toBe(1)
    })

    it('R-4.10.2 refuses more than it takes, none taken, or more than fit', () => {
        const { table, playerId } = choosing(2)
        const state = table.hydrated()

        expect(reasonChooseFavoursRefused(state, playerId, Sulfur2, 3)).toBe(
            'You gain only 2 sulfur.'
        )
        expect(reasonChooseFavoursRefused(state, playerId, null, 1)).toBe(
            'Only sulfur goes in your barrel.'
        )
        expect(reasonChooseFavoursRefused(state, playerId, Sulfur2, 2)).toBe(
            'Your barrel has room for 1.'
        )
    })

    it('R-4.10.2 the offer says how many could', () => {
        const { table, playerId } = choosing(2)

        expect(chooseFavoursOffer(table.hydrated(), playerId)?.sulfurToBarrel).toBe(1)
    })
})

describe('R-4.10-H1 a tile named in a payment', () => {
    it('R-4.10-H1 goes to the barrel when it says so, and then pays nothing', () => {
        const { table, playerId } = tableInWindow('before a card')
        table.moveTo((state) => {
            const tileId = giveTile(state, playerId)
            const seat = state.getPlayerState(playerId)
            const before = seat.goods.sulfur
            seat.goods.sulfur = 0
            state.supply.haversack.sulfur += before
            const spend = { tileId, good: 'sulfur', sulfurToBarrel: true } as const

            expect(canPayGoods(state, playerId, { sulfur: 1 }, [spend])).toBe(false)
            expect(canSpendWildTiles(state, playerId, [spend])).toBe(true)
            spendWildTiles(state, playerId, [spend])
            expect(seat.barrel).toBe(1)
            expect(seat.goods.sulfur).toBe(0)
            return MachineState.PlayingCards
        })
    })

    it('R-4.10.2 only sulfur, and only while the barrel has room', () => {
        const { table, playerId } = tableInWindow('before a card')
        table.moveTo((state) => {
            const tileId = giveTile(state, playerId)
            expect(
                canSpendWildTiles(state, playerId, [{ tileId, good: 'iron', sulfurToBarrel: true }])
            ).toBe(false)
            setBarrel(state, playerId, 3)
            expect(
                canSpendWildTiles(state, playerId, [
                    { tileId, good: 'sulfur', sulfurToBarrel: true }
                ])
            ).toBe(false)
            return MachineState.PlayingCards
        })
    })
})

describe('R-4.10-H2 a random draw goes to the supply', () => {
    it('R-4.10-H2 a mandate draws sulfur: all of it to the supply, the barrel untouched', () => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            setPawns(state, seat, ['farmer', 'farmer', 'farmer'])
            holdWrit(state, seat, FarmerMandate)
            state.recomputeRanks()
            for (const good of ['food', 'wood', 'iron', 'saltpeter'] as const) {
                giveGood(state, seat, good, state.supply.haversack[good])
            }
        })
        const { sulfur } = table.seat(playerId).goods

        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: FarmerMandate,
            alternative: 0,
            rewardGuild: 'farmer'
        })

        expect(table.seat(playerId).goods.sulfur).toBe(sulfur + 3)
        expect(table.seat(playerId).barrel).toBe(0)
        expect(action).toMatchObject({
            metadata: { received: { kind: 'goods', goods: ['sulfur', 'sulfur', 'sulfur'] } }
        })
    })
})
