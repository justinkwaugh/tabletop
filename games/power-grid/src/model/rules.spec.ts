import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { setUpPlants } from '../definition/initializer.js'
import { GERMANY } from '../components/maps/germany.js'
import { PlantBack, plantBack, powerPlant, POWER_PLANTS } from '../components/plants.js'
import { Step } from '../components/rules.js'
import {
    Resource,
    noResources,
    purchaseCost,
    type ResourceAmounts
} from '../components/resources.js'
import { TestGame } from '../testing/testGame.js'
import { bestPowerPlan, burnsExactly, canStore, forcedReturn, overflow, plantsOf } from './fuel.js'
import { PlayArea, connectionPlan } from './network.js'
import { STEP_3_CARD } from './plantMarket.js'
import { isRestock } from '../actions/restock.js'
import { isTrustBuysResources } from '../actions/trustBuysResources.js'
import { isTrustTakesPlant } from '../actions/trustTakesPlant.js'

const amounts = (partial: Partial<ResourceAmounts>): ResourceAmounts => ({
    ...noResources(),
    ...partial
})
const ALL_REGIONS = GERMANY.regions.map((region) => region.id)

function userAction(game: TestGame, playerId: string, data: Record<string, unknown>): GameAction {
    return {
        id: `t${game.state.actionCount}`,
        gameId: game.state.gameId,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassAuction,
        ...data
    }
}

describe('building costs', () => {
    const area = new PlayArea(GERMANY, ALL_REGIONS)

    // Recharged p. 5: Anna owns Essen and Münster.
    it('follows the rulebook example', () => {
        const total = (targets: string[]) =>
            connectionPlan(area, ['essen', 'muenster'], targets).reduce(
                (sum, step) => sum + step.connectionCost,
                0
            )
        expect(total(['duisburg'])).toBe(0)
        expect(total(['dortmund'])).toBe(2)
        expect(total(['aachen'])).toBe(11)
        expect(total(['duesseldorf'])).toBe(2)
        expect(total(['koeln'])).toBe(6)
        expect(total(['duesseldorf', 'koeln'])).toBe(6)
    })

    it('connects a set of cities in the cheapest order', () => {
        const plan = connectionPlan(area, ['essen'], ['koeln', 'duesseldorf'])
        expect(plan.map((step) => step.cityId)).toEqual(['duesseldorf', 'koeln'])
        expect(plan.map((step) => step.connectionCost)).toEqual([2, 4])
    })

    it('charges nothing to connect a first city', () => {
        const plan = connectionPlan(area, [], ['berlin', 'frankfurt_oder'])
        expect(plan.reduce((sum, step) => sum + step.connectionCost, 0)).toBe(6)
    })

    it('never routes through regions outside the play area', () => {
        const north = new PlayArea(GERMANY, ['teal', 'brown'])
        expect(north.distance('hamburg', 'berlin')).toBe(26)
        expect(north.contains('koeln')).toBe(false)
        expect(north.distance('hamburg', 'koeln')).toBe(Infinity)
    })

    it('quotes house costs by step and refuses a second house in Step 1', () => {
        const game = new TestGame(4)
        const state = game.hydrated
        state.regions = ALL_REGIONS
        const [anna, bob, carol] = state.playerOrder
        state.cities = { essen: [anna], muenster: [anna], duesseldorf: [bob], koeln: [carol] }
        expect(state.buildQuote(anna, ['duisburg'])?.total).toBe(10)
        expect(state.buildQuote(anna, ['duesseldorf'])).toBeUndefined()
        state.step = Step.Two
        expect(state.buildQuote(anna, ['duesseldorf'])?.total).toBe(17)
        expect(state.buildQuote(anna, ['duesseldorf', 'koeln'])?.total).toBe(36)
        expect(state.buildQuote(anna, ['essen'])).toBeUndefined()
    })
})

describe('resources', () => {
    it('prices the cheapest tokens first', () => {
        expect(purchaseCost(Resource.Coal, 24, 4)).toBe(1 + 1 + 1 + 2)
        expect(purchaseCost(Resource.Uranium, 2, 2)).toBe(14 + 16)
        expect(purchaseCost(Resource.Uranium, 2, 3)).toBe(Infinity)
    })

    it('lets hybrids hold coal and oil together', () => {
        const plants = plantsOf([5, 7])
        expect(canStore(plants, amounts({ coal: 4, oil: 6 }))).toBe(true)
        expect(canStore(plants, amounts({ coal: 5, oil: 6 }))).toBe(false)
        expect(canStore(plants, amounts({ coal: 2, oil: 8 }))).toBe(true)
        expect(canStore(plants, amounts({ garbage: 1 }))).toBe(false)
    })

    it('returns only what the remaining plants cannot hold', () => {
        const remaining = plantsOf([5, 13])
        const held = amounts({ coal: 3, oil: 3 })
        expect(overflow(remaining, held)).toBe(2)
        expect(forcedReturn(remaining, held)).toEqual(amounts({ coal: 2 }))
        expect(forcedReturn(remaining, held, true)).toEqual(amounts({ oil: 2 }))
    })

    it('burns exactly what the plants need', () => {
        expect(burnsExactly(plantsOf([5]), amounts({ coal: 1, oil: 1 }))).toBe(true)
        expect(burnsExactly(plantsOf([5]), amounts({ coal: 3 }))).toBe(false)
        expect(burnsExactly(plantsOf([13]), noResources())).toBe(true)
    })

    it('plans the most cities for the least fuel', () => {
        const plan = bestPowerPlan([4, 13, 20], amounts({ coal: 3 }), 6)
        expect(plan.plants).toEqual([13, 20])
        expect(plan.supplied).toBe(6)
        expect(bestPowerPlan([4, 13, 20], amounts({ coal: 3 }), 2).plants).toEqual([4, 13])
    })
})

describe('setup', () => {
    it('builds the Recharged plant stack', () => {
        let seed = 7
        const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
        const { market, deck } = setUpPlants(4, random)
        expect(market).toHaveLength(8)
        expect(market.every((plant) => plantBack(plant) === PlantBack.Plug)).toBe(true)
        expect(plantBack(Number(deck[0]))).toBe(PlantBack.Plug)
        expect(deck.at(-1)).toBe(STEP_3_CARD)
        // 42 plants less 8 in the market and 1 plug + 3 socket plants removed, plus Step 3.
        expect(deck).toHaveLength(42 - 8 - 4 + 1)
    })

    it('gives every plant its printed values', () => {
        expect(POWER_PLANTS).toHaveLength(42)
        expect(powerPlant(29)).toMatchObject({ kind: 'hybrid', fuel: 1, cities: 4 })
        expect(powerPlant(22)).toMatchObject({ kind: 'ecological', fuel: 0, cities: 2 })
        expect(powerPlant(50)).toMatchObject({ kind: 'fusion', cities: 6 })
    })
})

describe('the auction', () => {
    it('puts the discount on the lowest plant and lets it open at 1', () => {
        const game = new TestGame(4)
        const state = game.hydrated
        const lowest = state.auctionablePlants()[0]
        expect(state.discountPlant).toBe(lowest)
        const [chooser] = state.activePlayerIds
        game.execute(
            userAction(game, chooser, { type: ActionType.ChoosePlant, plant: lowest, bid: 1 })
        )
        expect(game.state.machineState).toBe(MachineState.Bidding)
        expect(game.state.auction?.bidding.highBid).toBe(1)
    })

    it('refuses a pass in the first round', () => {
        const game = new TestGame(4)
        const [chooser] = game.state.activePlayerIds
        expect(() => game.execute(userAction(game, chooser, {}))).toThrow()
    })

    it('sells to the last bidder left and refills the market', () => {
        const game = new TestGame(3)
        const state = game.hydrated
        const plant = state.auctionablePlants()[1]
        const [chooser] = state.activePlayerIds
        game.execute(userAction(game, chooser, { type: ActionType.ChoosePlant, plant, bid: plant }))
        for (let passes = 0; passes < 2; passes++) {
            const [bidder] = game.state.activePlayerIds
            game.execute(userAction(game, bidder, { type: ActionType.PassBid }))
        }
        const after = game.hydrated
        expect(after.getPlayerState(chooser).plants).toEqual([plant])
        expect(after.getPlayerState(chooser).money).toBe(50 - plant)
        expect(after.market).toHaveLength(8)
        expect(after.market).not.toContain(plant)
        expect(after.phaseDone).toContain(chooser)
    })

    it('reorders the players by their plants after the first auction phase', () => {
        const game = new TestGame(4)
        game.playUntil((state) => state.machineState === MachineState.BuyingResources)
        const state = game.hydrated
        const largest = state.playerOrder.map((id) => state.getPlayerState(id).largestPlant())
        expect(largest).toEqual(largest.toSorted((a, b) => b - a))
    })
})

describe('the end of a round', () => {
    it('resupplies from the supply and moves the highest plant under the stack', () => {
        const game = new TestGame(4)
        game.playUntil(
            (state) => state.machineState === MachineState.Restocking || state.round === 2
        )
        const restock = game.actions.findLast(isRestock)
        const resupplied = restock?.metadata?.resupplied
        // Four players, Step 1: 5 coal, 3 oil, 2 garbage, 1 uranium, as far as the supply allows.
        expect(resupplied?.coal).toBeLessThanOrEqual(5)
        expect(resupplied).toMatchObject({ oil: 3, garbage: 2, uranium: 1 })
        expect(game.state.underStack).toHaveLength(1)
    })

    it('ends with the most cities powered, money breaking ties', () => {
        const game = new TestGame(4)
        game.playToEnd()
        const standings = game.hydrated.finalStandings()
        const [best] = standings
        expect(game.state.winningPlayerIds).toContain(best.playerId)
        expect(
            game.state.players.some(
                (player) =>
                    Object.values(game.state.cities).filter((owners) =>
                        owners.includes(player.playerId)
                    ).length >= 17
            )
        ).toBe(true)
    })
})

describe('against the Trust', () => {
    it('has the players place six adjacent Trust houses before the first auction', () => {
        const game = new TestGame(2)
        expect(game.state.machineState).toBe(MachineState.PlacingTrust)
        const [first, second] = game.state.seatOrder
        const placers: string[] = []
        game.playUntil((state) => {
            if (state.machineState === MachineState.PlacingTrust)
                placers.push(state.activePlayerIds[0])
            return state.machineState === MachineState.ChoosingPlant
        })
        expect(placers).toEqual([first, second, second, first, first, second])
        const trust = game.state.trust
        expect(trust?.startingCities).toHaveLength(6)
        expect(trust?.housesLeft).toBe(10)
        const area = game.hydrated.area()
        const [start, ...rest] = trust?.startingCities ?? []
        expect(start).toBeDefined()
        rest.forEach((cityId, index) => {
            const earlier = [start, ...rest.slice(0, index)]
            expect(earlier.some((placed) => area.isAdjacent(placed, cityId))).toBe(true)
        })
    })

    it('takes the biggest plant once a round, burns fuel and blocks new cities', () => {
        const game = new TestGame(2)
        game.playUntil((state) => state.round === 3)
        const taken = game.actions.filter(isTrustTakesPlant)
        expect(taken).toHaveLength(2)
        expect(game.actions.filter(isTrustBuysResources)).toHaveLength(2)
        const trust = game.state.trust
        expect(trust?.plants.length).toBeGreaterThan(0)
        const opened = Object.values(game.state.cities).filter(
            (owners) => owners.length === 2 && owners[1] === 'trust'
        )
        expect(opened.length).toBe(10 - (trust?.housesLeft ?? 0))
    })
})
