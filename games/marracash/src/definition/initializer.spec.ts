import { Color, GameEngine, getPrng } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    AllAntiques,
    antiqueColorCounts,
    AntiquesPerPlayer,
    dealAntiqueHands,
    hasDealtHandShape,
    type Antique
} from '../components/antiques.js'
import { EntranceFountainIds, Shops } from '../components/board.js'
import {
    hasDistinctColors,
    longestSameColorRun,
    MaxSameColorRunInQueue,
    startingQueueLength,
    VisitorCounts
} from '../components/visitors.js'
import { MarracashGameStateValidator, type MarracashProjectedState } from '../model/gameState.js'
import { StartingMoney } from '../model/playerState.js'
import { createGame, TestMasterSeed } from '../util/testHelper.js'
import { MarketColor } from './marketColor.js'
import { MarracashColors } from './colors.js'
import { MarracashRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(MarracashRuntime)

function start(count: number, masterSeed = TestMasterSeed): MarracashProjectedState {
    return engine.startGame(createGame(count), { masterSeed }).initialState
}

function antiqueKey(antique: Antique): string {
    return `${antique.color}:${antique.value}`
}

describe.each([3, 4])('MarraCash setup with %i players', (count) => {
    it('produces a canonical state that survives hydration', () => {
        const state = start(count)
        expect(MarracashGameStateValidator.Check(state)).toBe(true)
        const rehydrated = MarracashRuntime.hydrator.hydrateState(structuredClone(state))
        expect(rehydrated.dehydrate()).toEqual(state)
    })

    it('starts with the first seated player choosing an action', () => {
        const state = start(count)
        expect(state.machineState).toBe(MachineState.ChoosingAction)
        expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder[0]])
    })

    it('places all 64 visitors on the entrances and in the queue', () => {
        const state = start(count)
        const entranceGroups = state.fountains
            .filter((fountain) => EntranceFountainIds.includes(fountain.fountainId))
            .map((fountain) => fountain.visitors)
        const otherFountains = state.fountains.filter(
            (fountain) => !EntranceFountainIds.includes(fountain.fountainId)
        )

        expect(entranceGroups.map((group) => group.length)).toEqual([3, 3, 3])
        expect(entranceGroups.every(hasDistinctColors)).toBe(true)
        expect(otherFountains.every((fountain) => fountain.visitors.length === 0)).toBe(true)
        expect(startingQueueLength(EntranceFountainIds.length)).toBe(55)
        expect(state.queue).toHaveLength(startingQueueLength(EntranceFountainIds.length))
        expect(longestSameColorRun(state.queue)).toBeLessThanOrEqual(MaxSameColorRunInQueue)

        const allVisitors = [...entranceGroups.flat(), ...state.queue]
        for (const color of Object.values(MarketColor)) {
            expect(allVisitors.filter((visitor) => visitor === color)).toHaveLength(
                VisitorCounts[color]
            )
        }
    })

    it('deals 5 antiques to each player and keeps the rest in the deck', () => {
        const state = start(count)
        const hands = state.players.map((player) => player.antiques)
        expect(hands.every((hand) => hand.length === AntiquesPerPlayer)).toBe(true)
        expect(state.antiqueDeck.remaining).toBe(AllAntiques.length - AntiquesPerPlayer * count)

        const dealtAndUndealt = [...hands.flat(), ...state.antiqueDeck.items].map(antiqueKey)
        expect(dealtAndUndealt.toSorted()).toEqual(AllAntiques.map(antiqueKey).toSorted())
    })

    it('deals every hand two cards of one colour and one each of three others', () => {
        for (let seed = 1; seed <= 50; seed++) {
            const state = start(count, seed.toString(16).padStart(32, '0'))
            expect(state.players.every((player) => hasDealtHandShape(player.antiques))).toBe(true)
        }
    })

    it('gives every player starting money and leaves every shop unowned', () => {
        const state = start(count)
        expect(state.players.every((player) => player.money === StartingMoney)).toBe(true)
        expect(state.shops.map((shop) => shop.shopId)).toEqual(Shops.map((shop) => shop.id))
        expect(state.shops.every((shop) => !shop.ownerId && shop.customers === 0)).toBe(true)
    })

    it('repeats the same setup for the same seed and varies it for another', () => {
        const first = start(count)
        const again = start(count)
        const other = start(count, 'fedcba9876543210fedcba9876543210')
        const setup = (state: MarracashProjectedState) => ({
            queue: state.queue,
            fountains: state.fountains,
            players: state.players
        })
        expect(setup(again)).toEqual(setup(first))
        expect(setup(other)).not.toEqual(setup(first))
    })
})

describe('MarraCash antiques', () => {
    it('has 5 cards per colour in steps of 25 Dirham', () => {
        const valuesByColor = Object.fromEntries(
            Object.values(MarketColor).map((color) => [
                color,
                AllAntiques.filter((antique) => antique.color === color).map(
                    (antique) => antique.value
                )
            ])
        )
        expect(valuesByColor).toEqual({
            [MarketColor.Red]: [50, 75, 100, 125, 150],
            [MarketColor.Blue]: [125, 150, 175, 200, 225],
            [MarketColor.Green]: [100, 125, 150, 175, 200],
            [MarketColor.Purple]: [75, 100, 125, 150, 175],
            [MarketColor.Yellow]: [150, 175, 200, 225, 250]
        })
    })
})

describe('MarraCash visitor rules', () => {
    it('measures the longest run of one colour', () => {
        const { Red, Blue } = MarketColor
        expect(longestSameColorRun([])).toBe(0)
        expect(longestSameColorRun([Red, Red, Blue, Red, Red, Red])).toBe(3)
    })

    it('spots repeated colours in an entrance group', () => {
        const { Red, Blue, Green } = MarketColor
        expect(hasDistinctColors([Red, Blue, Green])).toBe(true)
        expect(hasDistinctColors([Red, Blue, Red])).toBe(false)
    })
})

describe('MarraCash without antique cards', () => {
    it('deals no antiques and keeps no deck', () => {
        const state = engine.startGame(createGame(4, { antiqueCards: false }), {
            masterSeed: TestMasterSeed
        }).initialState
        expect(state.antiqueCards).toBe(false)
        expect(state.players.every((player) => player.antiques.length === 0)).toBe(true)
        expect(state.antiqueDeck).toEqual({ items: [], remaining: 0 })
        expect(MarracashGameStateValidator.Check(state)).toBe(true)
    })

    it('turns antique cards on by default', () => {
        expect(start(4).antiqueCards).toBe(true)
    })
})

describe('MarraCash player colours', () => {
    it('uses every site colour except the five visitor colours', () => {
        expect(MarracashColors).toEqual([
            Color.Orange,
            Color.Pink,
            Color.Brown,
            Color.Gray,
            Color.Black,
            Color.White
        ])
        const state = start(4)
        expect(state.players.every((player) => MarracashColors.includes(player.color))).toBe(true)
    })
})

describe('dealing antique hands', () => {
    it('recognises only a 2/1/1/1/0 colour split', () => {
        const cards = (colors: MarketColor[]) => colors.map((color) => ({ color, value: 100 }))
        const { Red, Blue, Green, Purple, Yellow } = MarketColor
        expect(hasDealtHandShape(cards([Red, Red, Blue, Green, Purple]))).toBe(true)
        expect(hasDealtHandShape(cards([Red, Blue, Green, Purple, Yellow]))).toBe(false)
        expect(hasDealtHandShape(cards([Red, Red, Blue, Blue, Green]))).toBe(false)
        expect(hasDealtHandShape(cards([Red, Red, Red, Blue, Green]))).toBe(false)
    })

    it('keeps every card when dealing from a partial deck', () => {
        const pool = AllAntiques.filter(
            (card) => card.color !== MarketColor.Yellow || card.value > 200
        )
        const deal = dealAntiqueHands(pool, 3, getPrng(3))
        expect(deal).toBeDefined()
        expect(deal!.hands.every(hasDealtHandShape)).toBe(true)
        expect([...deal!.hands.flat(), ...deal!.undealt].map(antiqueKey).toSorted()).toEqual(
            pool.map(antiqueKey).toSorted()
        )
    })

    it('deals only hands the filter allows, without retrying', () => {
        const redPairNoYellow = (counts: Readonly<Record<MarketColor, number>>) =>
            counts[MarketColor.Red] === 2 && counts[MarketColor.Yellow] === 0
        const deal = dealAntiqueHands(AllAntiques, 2, getPrng(3), (_, counts) =>
            redPairNoYellow(counts)
        )
        expect(deal?.hands.map((hand) => redPairNoYellow(antiqueColorCounts(hand)))).toEqual([
            true,
            true
        ])
        expect(
            dealAntiqueHands(AllAntiques, 3, getPrng(3), (_, counts) => redPairNoYellow(counts))
        ).toBeUndefined()
    })

    it('gives up when the cards cannot make the hands', () => {
        const pool = AllAntiques.filter((card) => card.color === MarketColor.Red)
        expect(dealAntiqueHands(pool, 1, getPrng(3))).toBeUndefined()
    })
})
