import { describe, expect, it } from 'vitest'
import { ActionSource, getPrng } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { PowerGridRuntime } from '../definition/runtime.js'
import { HydratedCloseAuctions } from '../actions/closeAuctions.js'
import { HydratedRestock } from '../actions/restock.js'
import { HydratedScrapPlant } from '../actions/scrapPlant.js'
import { HydratedStartStep2 } from '../actions/startStep2.js'
import { HydratedTrustBuysResources } from '../actions/trustBuysResources.js'
import { HydratedTrustTakesPlant } from '../actions/trustTakesPlant.js'
import { GERMANY } from '../components/maps/germany.js'
import { Step } from '../components/rules.js'
import { noResources } from '../components/resources.js'
import { TestGame } from '../testing/testGame.js'
import { PowerGridGameStateValidator, type HydratedPowerGridGameState } from './gameState.js'
import { STEP_3_CARD, isPlant, type DeckCard } from './plantMarket.js'

function system<T extends ActionType>(state: HydratedPowerGridGameState, type: T) {
    return { id: `s${state.actionCount}`, gameId: state.gameId, source: ActionSource.System, type }
}

function market(
    state: HydratedPowerGridGameState,
    cards: DeckCard[],
    deck: DeckCard[],
    { step = Step.One, underStack = [] as number[] } = {}
) {
    state.market = [...cards]
    state.plantDeck = [...deck]
    state.deckCount = deck.length
    state.underStack = [...underStack]
    state.step = step
    state.step3Drawn = cards.includes(STEP_3_CARD)
    state.discountPlant = undefined
    state.outOfGame = []
}

const STEP_1_MARKET = [3, 4, 5, 6, 7, 8, 9, 10]

describe('the discount token', () => {
    it('leaves with the first plant drawn below the discounted one', () => {
        const state = new TestGame(4).hydrated
        market(state, [5, 6, 7, 8, 9, 10, 11], [4, 14])
        state.discountPlant = 5
        const refill = state.refillMarket()
        expect(refill).toEqual({ drawn: [4, 14], removed: [4], discountLost: true })
        expect(state.discountPlant).toBeUndefined()
        expect(state.market).toContain(14)
        expect(state.outOfGame).toEqual([4])
    })

    it('takes an unsold discounted plant out of the game at the end of Phase 2', () => {
        const state = new TestGame(4).hydrated
        market(state, STEP_1_MARKET, [14, 15])
        state.discountPlant = 3
        const action = new HydratedCloseAuctions(system(state, ActionType.CloseAuctions))
        action.apply(state)
        expect(action.metadata?.unsoldDiscount).toBe(3)
        expect(state.market).toEqual([4, 5, 6, 7, 8, 9, 10, 14])
        expect(state.outOfGame).toEqual([3])
    })
})

describe('the steps', () => {
    it('replaces the lowest plant as Step 2 begins', () => {
        const state = new TestGame(4).hydrated
        market(state, STEP_1_MARKET, [14, 15])
        const action = new HydratedStartStep2(system(state, ActionType.StartStep2))
        action.apply(state)
        expect(state.step).toBe(Step.Two)
        expect(state.market).toEqual([4, 5, 6, 7, 8, 9, 10, 14])
        expect(action.metadata).toEqual({ drawn: [14], removed: [3] })
    })

    it('makes the Step 2 changes first when Step 3 comes up in Phase 2 of Step 1', () => {
        const state = new TestGame(4).hydrated
        market(state, [3, 4, 5, 6, 7, 8, 9, STEP_3_CARD], [20, 25])
        const action = new HydratedCloseAuctions(system(state, ActionType.CloseAuctions))
        action.apply(state)
        expect(state.step).toBe(Step.Three)
        expect(state.market).toEqual([5, 6, 7, 8, 9, 20])
        expect(action.metadata).toMatchObject({ step2Began: true, step3Began: true })
        expect(state.outOfGame).toEqual([3, 4])
    })

    it('makes the Step 2 changes first when Step 3 comes up in Phase 5 of Step 1', () => {
        const state = new TestGame(4).hydrated
        market(state, STEP_1_MARKET, [STEP_3_CARD, 20, 25])
        const action = new HydratedRestock(system(state, ActionType.Restock))
        action.apply(state)
        expect(state.step).toBe(Step.Three)
        expect(state.market).toHaveLength(6)
        expect(state.market).not.toContain(STEP_3_CARD)
        expect(state.outOfGame).toEqual([3, 4])
        expect(action.metadata).toMatchObject({
            placedUnder: 10,
            step2Began: true,
            step3Began: true
        })
    })

    it('starts Step 3 at the end of Phase 5 when the card comes up as Step 2 begins', () => {
        const state = new TestGame(4).hydrated
        market(state, STEP_1_MARKET, [STEP_3_CARD, 30], { underStack: [12] })
        new HydratedStartStep2(system(state, ActionType.StartStep2)).apply(state)
        expect(state.market).toEqual([4, 5, 6, 7, 8, 9, 10, STEP_3_CARD])
        expect(state.step).toBe(Step.Two)

        const restock = new HydratedRestock(system(state, ActionType.Restock))
        restock.apply(state)
        expect(state.step).toBe(Step.Three)
        expect(state.market).toEqual([5, 6, 7, 8, 9, 10])
        expect(restock.metadata).toMatchObject({ step2Began: false, step3Began: true })
        expect(restock.metadata?.placedUnder).toBeUndefined()
    })

    it('removes the lowest plant at the end of each Step 3 round', () => {
        const state = new TestGame(4).hydrated
        market(state, [20, 21, 22, 23, 24, 25], [30], { step: Step.Three })
        new HydratedRestock(system(state, ActionType.Restock)).apply(state)
        expect(state.market).toEqual([21, 22, 23, 24, 25, 30])
        expect(state.outOfGame).toEqual([20])
    })
})

describe('the nuclear phase-out', () => {
    it('starts when a player buys plant 39', () => {
        const state = new TestGame(4).hydrated
        market(state, [36, 37, 38, 39, 40, 42, 44, 46], [50])
        const [buyer, ...others] = state.seatOrder
        state.phaseDone = others
        state.openAuction('a', buyer, 39, 39)
        expect(state.getPlayerState(buyer).plants).toContain(39)
        expect(state.uraniumPhasedOut).toBe(true)
        expect(state.resupplyAmounts().uranium).toBe(0)
    })

    it('does not start when the Trust takes plant 39', () => {
        const state = new TestGame(2).hydrated
        market(state, [36, 37, 38, 39, 40, 42, 44, 46], [50])
        new HydratedTrustTakesPlant(system(state, ActionType.TrustTakesPlant)).apply(state)
        expect(state.trust?.plants).toEqual([39])
        expect(state.uraniumPhasedOut).toBe(false)
    })
})

describe('the Trust', () => {
    it('with three plants takes a bigger one and scraps its smallest', () => {
        const state = new TestGame(2).hydrated
        market(state, [21, 22, 23, 24, 25, 26, 27, 28], [30])
        const trust = state.trust
        expect(trust).toBeDefined()
        if (!trust) return
        trust.plants = [10, 13, 20]
        const action = new HydratedTrustTakesPlant(system(state, ActionType.TrustTakesPlant))
        action.apply(state)
        expect(trust.plants).toEqual([13, 20, 24])
        expect(action.metadata).toMatchObject({ taken: 24, scrapped: 10 })
        expect(state.outOfGame).toEqual([10])
    })

    it('with three plants keeps them when the biggest on offer is no better', () => {
        const state = new TestGame(2).hydrated
        market(state, [21, 22, 23, 24, 25, 26, 27, 28], [30])
        const trust = state.trust
        if (!trust) throw Error('No Trust')
        trust.plants = [30, 31, 32]
        new HydratedTrustTakesPlant(system(state, ActionType.TrustTakesPlant)).apply(state)
        expect(trust.plants).toEqual([30, 31, 32])
        expect(state.market).toEqual([21, 22, 23, 24, 25, 26, 27, 28])
    })

    it('alternates coal and oil across all its hybrids, coal first', () => {
        const state = new TestGame(2).hydrated
        const trust = state.trust
        if (!trust) throw Error('No Trust')
        trust.plants = [29, 46]
        state.phaseDone = []
        const action = new HydratedTrustBuysResources(system(state, ActionType.TrustBuysResources))
        action.apply(state)
        expect(action.metadata?.taken).toEqual({ ...noResources(), coal: 2, oil: 2 })
    })
})

describe('scrapping a plant', () => {
    it('lets the player choose which of coal and oil a hybrid gives up', () => {
        const state = new TestGame(4).hydrated
        const [playerId] = state.seatOrder
        const player = state.getPlayerState(playerId)
        player.plants = [5, 7, 13, 22]
        player.resources = { ...noResources(), coal: 3, oil: 3 }
        state.scrapping = { playerId, boughtPlant: 22 }
        const valid = (coal: number, oil: number) =>
            HydratedScrapPlant.isValidScrap(state, playerId, 7, { ...noResources(), coal, oil })
        expect(valid(2, 0)).toBe(true)
        expect(valid(0, 2)).toBe(true)
        expect(valid(1, 1)).toBe(true)
        expect(valid(3, 0)).toBe(false)
        expect(valid(1, 0)).toBe(false)
        expect(HydratedScrapPlant.scrappablePlants(state, playerId)).not.toContain(22)
    })
})

describe('a first house', () => {
    it('goes in an empty city, even once cities hold more houses', () => {
        const state = new TestGame(4).hydrated
        state.regions = GERMANY.regions.map((region) => region.id)
        state.step = Step.Two
        const [starter, other] = state.seatOrder
        state.cities = { essen: [other] }
        expect(state.buildQuote(starter, ['essen'])).toBeUndefined()
        const quote = state.buildQuote(starter, ['essen', 'duisburg'])
        expect(quote?.steps.map((step) => step.cityId)).toEqual(['duisburg', 'essen'])
        expect(quote?.total).toBe(10 + 0 + 15 + 0)
    })
})

describe('exploration', () => {
    it('never puts a plant known to be out of the game back in the stack', () => {
        const game = new TestGame(4)
        const retired = (game.state.plantDeck ?? []).filter(isPlant).slice(0, 5)
        const state = { ...game.state, outOfGame: retired }
        if (!PowerGridGameStateValidator.Check(state)) {
            throw Error('Expected complete canonical state')
        }
        const projected = PowerGridRuntime.visibility.state.project(
            state,
            { kind: 'spectator' },
            { config: game.game.config }
        )
        for (let seed = 1; seed <= 20; seed++) {
            const explored = PowerGridRuntime.exploration.createFromProjectedState({
                game: game.game,
                state: projected,
                actions: [],
                perspective: { kind: 'spectator' },
                random: getPrng(seed)
            })
            expect(explored.plantDeck?.filter(isPlant).some((card) => retired.includes(card))).toBe(
                false
            )
        }
    })
})
