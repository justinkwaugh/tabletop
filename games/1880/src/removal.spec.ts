import { describe, expect, it } from 'vitest'
import { hasTurnMark } from '@tabletop/18xx'
import { botMove, Random } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { BoughtTrainMark, RemovedTrainsMark, trainOnSale } from './trainRules.js'
import { TrainDepot1880 } from './trains.js'

/** The train-marker company about to finish without buying while both 8E-trains wait. */
function eightEsDue(game: Table): boolean {
    const state = game.hydrated
    return (
        state.machineState === 'BuyingTrains' &&
        state.lastEightRound !== undefined &&
        state.trainPurchaseStep?.companyId === state.trainMarker &&
        trainOnSale(state) === '8E' &&
        TrainDepot1880.remaining(state.trainInventory, '8E') === 2 &&
        !hasTurnMark(state, BoughtTrainMark) &&
        !hasTurnMark(state, RemovedTrainsMark) &&
        game.valid().includes('FinishOperatingTurn')
    )
}

// Seed 17 is the first 4-player bot game to reach the position.
function playUntil(done: (game: Table) => boolean): Table {
    for (let seed = 17; seed < 40; seed++) {
        const game = kit.table(4, seed)
        const random = new Random(seed)
        for (let count = 0; count < 8000 && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

describe('the 8E-trains going unbought (§X; R48)', () => {
    it('leave the game, starting phase D2, and the company goes on buying', () => {
        const game = playUntil(eightEsDue)
        const companyId = game.state.trainMarker
        game.act('FinishOperatingTurn', { companyId })
        expect(TrainDepot1880.remaining(game.state.trainInventory, '8E')).toBe(0)
        expect(game.state.phaseId).toBe('D2')
        expect(game.state.stockRoundInterruption).toBeUndefined()
        // As 18xx.games: no share round, and the company may still buy a 10 or a 2R.
        expect(game.state.machineState).toBe('BuyingTrains')
        expect(game.state.trainPurchaseStep?.companyId).toBe(companyId)
        expect(trainOnSale(game.hydrated)).toBe('10')
        game.act('FinishOperatingTurn', { companyId })
        expect(game.state.operatingSet?.completedCompanyIds).toContain(companyId)
    }, 300_000)
})
