import { describe, expect, it } from 'vitest'
import { EmergencyTrainFunding, placeStockMarker } from '@tabletop/18xx'
import { GameEngine, PlayerStatus, assertExists } from '@tabletop/common'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoGameConfig,
    EighteenThirtyTwoPhaseRules,
    EighteenThirtyTwoTileSet,
    EighteenThirtyTwoTrainRules,
    Definition,
    EighteenThirtyTwoStockRules,
    EighteenThirtyTwoTrainFundingRules,
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
            const train = (definitionId: string) => ({
                id: definitionId,
                definitionId,
                status: 'depot' as const
            })
            const price = (tradeIn: string, variants: EighteenThirtyTwoState['variants']) => {
                const withVariants = { ...state, variants }
                return EighteenThirtyTwoTrainRules.exchangePrice(
                    withVariants,
                    'CG',
                    '12',
                    train(tradeIn)
                )
            }
            expect(['4', '5', '6'].map((id) => price(id, { diesels: true }))).toEqual([
                800, 800, 800
            ])
            // Only 4-, 5- and 6-trains are taken in trade, as in 1830.
            expect(price('3', { diesels: true })).toBeUndefined()
            expect(price('12', { diesels: true })).toBeUndefined()
            expect(price('4', {})).toBeUndefined()
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

    it('reaches the opening through the game’s options', () => {
        const runtime = Definition.runtime
        const game = runtime.initializer.initializeGame(
            {
                id: 'variants',
                typeId: Definition.info.id,
                ownerId: 'alex',
                seed: 1832,
                config: { diesels: true, noMergers: true },
                players: ['alex', 'blair', 'casey'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )
        const state = new GameEngine(runtime).startGame(game).initialState
        expect(state.variants).toEqual({ diesels: true, noMergers: true })
        expect(
            state.trainInventory.trains.some(
                (train) => train.definitionId === '8' && train.status === 'depot'
            )
        ).toBe(false)
    })

    it('ends after the company reaching $400 finishes its turn', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3, (state) => {
            state.variants = { finish400: true }
            placeStockMarker(state.stockMarket, 'CG', '0:20')
            // Blair funds CG's train from cash, so no sale moves CG off $400.
            const cash = state.cash.find(
                (entry) => entry.owner.kind === 'player' && entry.owner.playerId === 'blair'
            )
            assertExists(cash, 'Blair has cash')
            cash.amount = 1000
        })
        expect(play.state.gameEnding).toBeUndefined()
        const funding = () =>
            new EmergencyTrainFunding(
                play.state,
                EighteenThirtyTwoTrainFundingRules,
                EighteenThirtyTwoStockRules,
                EighteenThirtyTwoTrainRules
            )
        const [train] = funding().purchases()
        play.act('FundTrain', {
            companyId: train.companyId,
            trainId: train.trainId,
            definitionId: train.definitionId,
            expectedPrice: train.price
        })
        for (let step = 0; play.state.trainFunding && step < 12; step++) {
            const choice = funding().next()
            if (choice.kind === 'contribute')
                play.act('ContributeTrainFunds', { owner: choice.owner, amount: choice.amount })
            else if (choice.kind === 'sell') {
                const sale = choice.sales.at(-1)
                assertExists(sale, 'A sale choice has a sale')
                play.act('SellFundingShares', {
                    seller: choice.owner,
                    companyId: sale.sales[0].companyId,
                    shares: sale.sales[0].shares,
                    expectedProceeds: sale.proceeds
                })
            } else if (choice.kind === 'buy')
                play.act('BuyTrain', {
                    companyId: choice.purchase.companyId,
                    trainId: choice.purchase.trainId,
                    definitionId: choice.purchase.definitionId,
                    expectedPrice: choice.purchase.price
                })
            else throw Error(`Unexpected funding choice ${choice.kind}`)
        }
        expect(play.state.gameEnding?.reason).toBe('$400 share price')
        expect(play.state.machineState).toBe('GameOver')
        // ACL, next in order, never operated after CG.
        expect(play.state.operatingSet?.completedCompanyIds).not.toContain('ACL')
    })

    it('holds no last merger phase without mergers', () => {
        const play = trading((state) => {
            state.variants = { noMergers: true }
            state.phaseId = '6'
        })
        for (let turn = 0; turn < 3; turn++) play.act('FinishStockTurn')
        expect(play.state.mergersEnded).toBeUndefined()
        expect(play.state.machineState).not.toBe('Merging')
    })
})
