import { GameEngine } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AllAntiques, AntiquesPerPlayer, type Antique } from '../components/antiques.js'
import { EntranceFountainIds, Shops } from '../components/board.js'
import {
    hasDistinctColors,
    longestSameColorRun,
    MaxSameColorRunInQueue,
    VisitorCounts
} from '../components/visitors.js'
import { MarracashGameStateValidator, type MarracashProjectedState } from '../model/gameState.js'
import { StartingMoney } from '../model/playerState.js'
import { createGame, TestMasterSeed } from '../util/testHelper.js'
import { MarketColor } from './marketColor.js'
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
        expect(state.queue).toHaveLength(55)
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
