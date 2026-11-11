import { describe, expect, it } from 'vitest'
import { assertExists, GameEngine, validateGameResult } from '@tabletop/common'
import { EmergencyTrainFunding } from '@tabletop/18xx'
import { Privates1850 } from '../privates.js'
import { StockRules1850, TrainFundingRules1850 } from '../stock.js'
import { TileSet1850 } from '../tiles.js'
import { TrainRules1850 } from '../trains.js'
import { operated, prepared, spaceAt, table, trackAlong } from '../../test/kit.js'
import { Definition } from './gameDefinition.js'

const runtime = Definition.runtime
const counts = [2, 3, 4, 5, 6]
const configs = [undefined, { finish400: true }, { diesels: true }, { reducedTokens: true }]

function rotations(playerIds: readonly string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

// What a seat assignment rightly changes: the turn order, and who the auction waits for.
function withoutSeating(state: object, normal: { turnManager: object }) {
    return JSON.parse(
        JSON.stringify({ ...state, turnManager: normal.turnManager }, (key, value) =>
            key === 'nextPlayerId' || key === 'activePlayerIds' ? undefined : value
        )
    )
}

describe.each(counts)('1850 tournaments with %i players', (count) => {
    const ids = Array.from({ length: count }, (_, index) => `p${index + 1}`)

    it.each(configs)('seats each assigned order through the auction (%j)', (config) => {
        for (const order of rotations(ids)) {
            const game = table(count, 7, config, () => order)
            expect(game.state.turnManager.turnOrder).toEqual(order)
            for (const [index, lot] of Privates1850.entries()) {
                expect(game.player).toBe(order[index % count])
                game.act('BuyAuctionLot', { lotId: lot.id, expectedPrice: lot.faceValue })
                if (game.state.pendingPar)
                    game.act('ParCompany', {
                        companyId: game.state.pendingPar.companyId,
                        marketSpaceId: spaceAt(68)
                    })
            }
        }
    })

    it.each(configs)('leaves ordinary setup otherwise unchanged (%j)', (config) => {
        const game = table(count, 7, config).game
        const engine = new GameEngine(runtime)
        const uninitialized = engine.generateUninitializedState(
            game,
            '0123456789abcdef0123456789abcdef'
        )
        const initialize = (playerIds?: string[]) =>
            runtime.initializer
                .initializeGameState(
                    game,
                    structuredClone(uninitialized),
                    playerIds ? { playerIds } : undefined
                )
                .dehydrate()
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(withoutSeating(assigned, normal)).toEqual(withoutSeating(normal, normal))
        }
    })

    it('scores every player from a finished game', () => {
        const game = prepared((state) => {
            state.phaseId = '12'
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => train.status !== 'depot' || train.definitionId === '12'
            )
            for (const company of state.companies)
                if (company.kind === 'private') company.closed = true
            operated(state, 'GN', 'p1', { price: 100, shares: 2, cash: 13 })
            state.cash = state.cash.map((account) =>
                account.owner.kind === 'player' && account.owner.playerId === 'p1'
                    ? { ...account, amount: 0 }
                    : account
            )
            state.tileInventory = TileSet1850.createInventory(trackAlong(['D9', 'C8', 'B7']))
        }, count)
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
        game.act('FinishTrack', { companyId: 'GN' })
        const purchase = new EmergencyTrainFunding(
            game.hydrated,
            TrainFundingRules1850,
            StockRules1850,
            TrainRules1850
        ).purchases()[0]
        game.act('FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
        expect(game.state.machineState).toBe('GameOver')
        expect(() => validateGameResult(game.hydrated)).not.toThrow()
        const scoring = runtime.scoring
        assertExists(scoring, 'The title reports final scores')
        expect(Object.keys(scoring.finalScores(game.state)).toSorted()).toEqual(ids.toSorted())
    })
})
