import { describe, expect, it } from 'vitest'
import { evaluateShareSale, getCompany } from '@tabletop/18xx'
import { buy, finishStockRound, kit, opened, start, toBuyingTrains } from '../test/kit.js'
import { StockRules1856 } from './stock.js'

/** Plays on, every company passing, until the next stock round. */
function toNextStockRound(game: ReturnType<typeof opened>) {
    const round = game.state.stockRound.number
    for (
        let guard = 0;
        guard < 40 &&
        !(game.state.machineState === 'StockRound' && game.state.stockRound.number > round);
        guard++
    ) {
        toBuyingTrains(game)
        const companyId = game.state.trainPurchaseStep?.companyId
        if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId })
        else if (game.valid().includes('FinishOperatingTurn'))
            game.act('FinishOperatingTurn', { companyId })
    }
}

describe('1856 selling shares bought this turn (Sell shares; designer)', () => {
    it('lets a player sell shares of a company they bought into this turn only if they keep one', () => {
        const game = opened(4)
        start(game, 'GT', 100)
        const holderId = game.player
        buy(game, 'GT', 100, 1)
        finishStockRound(game)
        toNextStockRound(game)
        expect(getCompany(game.state, 'GT').floated).toBe(true)
        while (game.player !== holderId) game.act('FinishStockTurn')
        const seller = { kind: 'player' as const, playerId: holderId }
        const sale = (shares: number) =>
            evaluateShareSale(
                game.hydrated,
                { playerId: holderId, seller, sales: [{ companyId: 'GT', shares }] },
                StockRules1856
            )
        expect(sale(1).details).toBeDefined()
        kit.buyIpo(game, 'GT', 100)
        expect(game.state.stockTurnPurchases).toEqual([
            { kind: 'share', companyId: 'GT', poolId: 'initial-offering' }
        ])
        // Two shares now, one bought this turn: one may be sold, not both.
        expect(sale(1).details).toBeDefined()
        expect(sale(2).reason).toBeDefined()
        game.act('FinishStockTurn')
        expect(game.state.stockTurnPurchases).toBeUndefined()
    })
})
