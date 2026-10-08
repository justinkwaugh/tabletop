import { describe, expect, it } from 'vitest'
import { placeStockMarker } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoGameConfig,
    EighteenThirtyTwoPhaseRules,
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrainRules,
    createEighteenThirtyTwoTrainInventory,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

function trading(prepare: (state: EighteenThirtyTwoState) => void) {
    return playExample(EighteenThirtyTwoScenarios, 'trading', 3, prepare)
}

describe('variants', () => {
    it('records the chosen variants', () => {
        expect(EighteenThirtyTwoGameConfig.variants({ diesels: true, finish400: false })).toEqual({
            diesels: true
        })
        expect(EighteenThirtyTwoGameConfig.variants(undefined)).toEqual({})
    })

    it('ends the game when a price reaches $400 at the end of a stock round', () => {
        const play = trading((state) => {
            state.variants = { finish400: true }
            placeStockMarker(state.stockMarket, 'CG', '0:20')
        })
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.gameEnding?.reason).toBe('$400 share price')
        expect(play.state.machineState).toBe('GameOver')
    })

    it('plays on past $400 without the variant', () => {
        const play = trading((state) => placeStockMarker(state.stockMarket, 'CG', '0:20'))
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.gameEnding).toBeUndefined()
    })

    it('holds no merger phase without mergers', () => {
        const play = trading((state) => {
            state.variants = { noMergers: true }
            state.phaseId = '4'
            state.tileInventory = EighteenThirtyTwoTileSet.createInventory([
                { locationId: 'T29', definitionId: '18xx:57', rotation: 0 },
                { locationId: 'U28', definitionId: '18xx:57', rotation: 0 }
            ])
        })
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.machineState).not.toBe('Merging')
    })

    describe('diesels', () => {
        it('takes the 8- and 10-trains out of the depot', () => {
            const ranks = (inventory: ReturnType<typeof createEighteenThirtyTwoTrainInventory>) =>
                new Set(
                    inventory.trains
                        .filter((train) => train.status === 'depot')
                        .map((train) => train.definitionId)
                )
            // The unlimited 12-trains are made as they are bought.
            expect(ranks(createEighteenThirtyTwoTrainInventory({ diesels: true }))).toEqual(
                new Set(['2', '3', '4', '5', '6'])
            )
            expect(ranks(createEighteenThirtyTwoTrainInventory({}))).toContain('8')
        })

        it('offers diesels from the first 6-train, with a $300 trade-in', () => {
            const { state } = trading((draft) => {
                draft.variants = { diesels: true }
                draft.phaseId = '6'
            })
            expect(EighteenThirtyTwoTrainRules.availableDefinitions(state)).toContain('12')
            const train = state.trainInventory.trains[0]
            expect(EighteenThirtyTwoTrainRules.exchangePrice(state, 'CG', '12', train)).toBe(800)
            const plain = { ...state, variants: {} }
            expect(EighteenThirtyTwoTrainRules.exchangePrice(plain, 'CG', '12', train)).toBe(
                undefined
            )
        })

        it('keeps 5-trains and rusts 4-trains on the first diesel', () => {
            const { state } = trading((draft) => {
                draft.variants = { diesels: true }
                draft.phaseId = '12'
            })
            const train = (definitionId: string) => ({
                id: definitionId,
                definitionId,
                status: 'depot' as const
            })
            expect(EighteenThirtyTwoPhaseRules.rustTiming(state, train('5'))).toBeUndefined()
            expect(EighteenThirtyTwoPhaseRules.rustTiming(state, train('4'))).toBe('immediate')
            const plain = { ...state, variants: {} }
            expect(EighteenThirtyTwoPhaseRules.rustTiming(plain, train('5'))).toBe('immediate')
        })
    })
})
