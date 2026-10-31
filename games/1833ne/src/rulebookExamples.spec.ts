import { describe, expect, it } from 'vitest'
import { corporateFinanceChoices, finiteCashOwnedBy } from '@tabletop/18xx'
import { table, type Table } from '../test/table.js'
import {
    buyAllPrivates,
    buyTrain,
    launch,
    lay,
    ownedTrainId,
    passStockRound,
    placeStation,
    route
} from '../test/flow.js'
import { CorporateFinanceRules1833NE } from './stock.js'

const cash = (game: Table, companyId: string) =>
    finiteCashOwnedBy(game.state, { kind: 'company', companyId })

function finishTurn(game: Table, companyId: string) {
    if (game.valid().includes('FinishOperatingTurn')) game.act('FinishOperatingTurn', { companyId })
}

/** Rulebook p. 8: the B&W and B&P open around Boston and buy ferries. */
function openingOperations() {
    const game = table(4)
    buyAllPrivates(game)
    launch(game, 'B&W', 150)
    launch(game, 'B&P', 150)
    passStockRound(game)

    expect(game.state.trackStep?.companyId).toBe('B&W')
    lay(game, 'F23', '18xx:58', [2, 4])
    lay(game, 'E22', '18xx:5', [5, 0])
    placeStation(game, 'E22')
    expect(cash(game, 'B&W')).toBe(300 - 40 - 40)
    game.act('FinishTrack', { companyId: 'B&W' })
    buyTrain(game, '2')
    buyTrain(game, '2+1')
    finishTurn(game, 'B&W')

    expect(game.state.trackStep?.companyId).toBe('B&P')
    lay(game, 'G24', '18xx:58', [1, 3])
    lay(game, 'F27', '18xx:3', [2, 3])
    game.act('BuyFerry', { companyId: 'B&P', locationId: 'F27' })
    expect(cash(game, 'B&P')).toBe(300 - 40 - 40)
    game.act('FinishTrack', { companyId: 'B&P' })
    buyTrain(game, '2')
    buyTrain(game, '2+1')
    finishTurn(game, 'B&P')
    return game
}

describe('the rulebook’s opening operations (p. 8)', () => {
    it('runs OR1 in reverse price order, top of the column first', () => {
        const game = openingOperations()
        expect(game.state.operatingSet?.roundNumber).toBe(2)
    })

    it('earns the OR2 ferry revenues', () => {
        const game = openingOperations()
        expect(game.state.trackStep?.companyId).toBe('B&W')
        const issue = corporateFinanceChoices(game.hydrated, CorporateFinanceRules1833NE).find(
            (choice) => choice.operation === 'issue' && choice.shares === 1
        )
        expect(issue).toBeDefined()
        game.act('CorporateFinance', issue!)
        lay(game, 'E24', '18xx:9', [0, 3])
        lay(game, 'E26', '18xx:57', [0, 3])
        game.act('BuyFerry', { companyId: 'B&W', locationId: 'E26' })
        game.act('FinishTrack', { companyId: 'B&W' })
        const bw = [
            route(
                game.state,
                ownedTrainId(game, 'B&W', '2+1'),
                { locationId: 'G22', nodeId: 'city-0' },
                ['F23', 'E22']
            ),
            route(
                game.state,
                ownedTrainId(game, 'B&W', '2'),
                { locationId: 'E22', nodeId: 'city' },
                ['E24', 'E26']
            )
        ]
        game.act('RunTrains', { companyId: 'B&W', routes: bw })
        expect(game.state.routeStep?.result?.routes.map((run) => run.revenue)).toEqual([60, 80])
        game.act('DistributeEarnings', { companyId: 'B&W', choice: 'withhold' })
        finishTurn(game, 'B&W')

        expect(game.state.trackStep?.companyId).toBe('B&P')
        game.act('BuyFerry', { companyId: 'B&P', locationId: 'F25' })
        game.act('FinishTrack', { companyId: 'B&P' })
        const bp = [
            route(
                game.state,
                ownedTrainId(game, 'B&P', '2+1'),
                { locationId: 'F25', nodeId: 'city' },
                ['G24', 'G22']
            ),
            route(
                game.state,
                ownedTrainId(game, 'B&P', '2'),
                { locationId: 'F25', nodeId: 'city' },
                ['F27']
            )
        ]
        game.act('RunTrains', { companyId: 'B&P', routes: bp })
        expect(game.state.routeStep?.result?.routes.map((run) => run.revenue)).toEqual([90, 80])
    })
})
