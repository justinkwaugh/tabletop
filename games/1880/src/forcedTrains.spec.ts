import { describe, expect, it } from 'vitest'
import { EmergencyTrainFunding, finiteCashOwnedBy } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { botMove, Random, type BotSteering } from '../test/bot.js'
import { kit, type Table } from '../test/kit.js'
import { TrainFundingRules1880 } from './operating.js'
import { StockRules1880 } from './stock.js'
import { TrainRules1880 } from './trainRules.js'
import { Phases1880, RestoredTwoId, TrainDepot1880 } from './trains.js'

/** The first seeded bot game, from the seed given, to reach the position. */
function reach(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    steering: BotSteering = {}
): Table {
    for (let tried = seed; tried < seed + 40; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        for (let count = 0; count < 6000 && !done(game); count++) {
            if (game.state.machineState === 'GameOver') break
            const next = botMove(game, random, steering)
            game.act(next.type, next.fields, next.playerId)
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

const remaining = (game: Table, definitionId: string) =>
    TrainDepot1880.remaining(game.state.trainInventory, definitionId)

describe('a forced purchase (§X Forced Purchase; R46)', () => {
    it('is never of a restored 2-train', () => {
        // 4-player bot games, from seed 1, reach a forced purchase with 2R-trains on sale.
        const game = reach(
            4,
            1,
            (table) =>
                table.state.machineState === 'BuyingTrains' &&
                Phases1880.isAtLeast(table.state.phaseId, 'C2') &&
                remaining(table, RestoredTwoId) !== 0 &&
                table.valid().includes('FundTrain')
        )
        const state = game.hydrated
        const companyId = state.trainPurchaseStep?.companyId
        assertExists(companyId, 'A company buys trains')
        const funding = new EmergencyTrainFunding(
            state,
            TrainFundingRules1880,
            StockRules1880,
            TrainRules1880
        )
        const purchases = funding.purchases()
        expect(purchases.length).toBeGreaterThan(0)
        expect(purchases.map((purchase) => purchase.definitionId)).not.toContain(RestoredTwoId)
        expect(purchases[0].price).toBeGreaterThan(
            finiteCashOwnedBy(state, { kind: 'company', companyId })
        )
    }, 300_000)
})
