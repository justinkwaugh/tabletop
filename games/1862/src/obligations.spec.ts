import { describe, expect, it } from 'vitest'
import { available, charter, declineAll, table, type Table } from '../test/kit.js'
import { cashOf, player } from '../test/positions.js'
import { canStart } from './companyRules.js'
import { FineMultiple, isEnforceObligations, isForgiveFine } from './obligations.js'
import { charterableCompanies } from './parliament.js'
import { marketSpaceIdAt } from './stockMarket.js'

function toFirstStockRound(game: Table) {
    declineAll(game)
    declineAll(game)
    expect(game.state.machineState).toBe('StockRound')
}

function finesLevied(game: Table) {
    return game.actions.filter(isEnforceObligations).flatMap((action) => action.metadata?.fines)
}

function forgiven(game: Table) {
    return game.actions.filter(isForgiveFine).map((action) => action.metadata)
}

describe('1862 fines nobody can pay (§4.3)', () => {
    it('forgives what is left once the fined player has nothing to sell', () => {
        const game = table(4)
        const [x] = available(game)
        const fined = game.player
        charter(game, x, 100)
        toFirstStockRound(game)
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
        // £600 less £300 for the director's certificate, then three train-less shares at £50.
        const fine = FineMultiple * 100
        expect(finesLevied(game)).toEqual([
            {
                companyId: x,
                playerId: fined,
                fine,
                paidInCash: 300,
                sharesSold: 3,
                owed: fine - 300 - 150
            }
        ])
        expect(forgiven(game)).toEqual([{ playerId: fined, amount: 50 }])
        expect(game.state.fines).toBeUndefined()
        expect(game.state.machineState).not.toBe('PayingFine')
        expect(cashOf(game, player(fined))).toBe(0)
    })

    it('has the fined player sell their other shares first, then forgives the rest', () => {
        const game = table(4)
        const [x, y] = available(game)
        const fined = game.player
        charter(game, x, 100)
        charter(game, y, 54, 2)
        expect(game.state.companies.find((company) => company.id === y)?.floated).toBe(true)
        toFirstStockRound(game)
        let bought = false
        while (game.state.machineState === 'StockRound') {
            if (game.player !== fined || bought) {
                game.act('FinishStockTurn')
                continue
            }
            const share = game.state.certificates.find(
                (entry) => entry.companyId === y && entry.poolId === 'initial-offering'
            )
            game.act('BuyShares', {
                buyer: player(fined),
                certificateId: share?.id,
                expectedPrice: 54
            })
            bought = true
        }
        expect(finesLevied(game)).toEqual([
            {
                companyId: x,
                playerId: fined,
                fine: 500,
                paidInCash: 600 - 300 - 54,
                sharesSold: 3,
                owed: 500 - 246 - 150
            }
        ])
        expect(game.state.machineState).toBe('PayingFine')
        expect(game.player).toBe(fined)
        expect(forgiven(game)).toEqual([])
        game.act('SellForFine', { companyId: y, shares: 1 })
        // The train-less company's share sells for half its £54 price.
        expect(forgiven(game)).toEqual([{ playerId: fined, amount: 104 - 27 }])
        expect(game.state.fines).toBeUndefined()
        expect(game.state.machineState).not.toBe('PayingFine')
        expect(cashOf(game, player(fined))).toBe(0)
    })
})

describe('1862 companies reset for a missed obligation (§4.3)', () => {
    it('may not be chartered in the next Parliament Round, but may start in the next stock round', () => {
        const game = table(4)
        const [x, ...others] = available(game)
        charter(game, x, 54)
        toFirstStockRound(game)
        expect(canStart(game.hydrated, x)).toBe(false)
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')

        expect(game.state.resetCompanyIds).toEqual([x])
        expect(game.state.machineState).toBe('ParliamentRound')
        expect(canStart(game.hydrated, x)).toBe(false)
        expect(charterableCompanies(game.hydrated)).not.toContain(x)
        expect(charterableCompanies(game.hydrated)).toEqual(expect.arrayContaining(others))
        expect(() => game.act('OpenCharterAuction', { companyId: x, bid: 0 })).toThrow()

        declineAll(game)
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.resetCompanyIds).toBeUndefined()
        expect(canStart(game.hydrated, x)).toBe(true)
        game.act('StartCompany', {
            buyer: player(game.player),
            companyId: x,
            marketSpaceId: marketSpaceIdAt(54),
            expectedPrice: 162
        })
        expect(game.state.companies.find((company) => company.id === x)?.started).toBe(true)
    })
})
