import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { trainsOwnedBy } from '@tabletop/18xx'
import { table, type Table } from '../test/table.js'
import { buyAllPrivates, buyTrain, launch, passStockRound } from '../test/flow.js'
import { setCash } from '../test/takeover.js'
import { MarketPoolId } from './stock.js'

function intoReceivership(game: Table, companyId: string) {
    const state = structuredClone(game.state)
    const company = state.companies.find((company) => company.id === companyId)
    delete company?.president
    for (const certificate of state.certificates)
        if (
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.president
        ) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = MarketPoolId
        }
    game.state = state
}

describe('1833NE receivership', () => {
    it('credits no player with the steps the System takes for a receiver', () => {
        const game = table(4)
        buyAllPrivates(game)
        launch(game, 'B&W', 80)
        launch(game, 'HR', 40)
        passStockRound(game)
        setCash(game, 'HR', 200)
        setCash(game, 'B&W', 500)
        intoReceivership(game, 'B&W')

        game.act('FinishTrack', { companyId: 'HR' })
        buyTrain(game, '2')
        const taken = game.act('FinishOperatingTurn', { companyId: 'HR' }).processedActions
        const steps = taken.filter((action) => 'companyId' in action && action.companyId === 'B&W')
        expect(steps.map((action) => action.type)).toEqual(
            expect.arrayContaining([
                'FinishTrack',
                'RunTrains',
                'DistributeEarnings',
                'BuyTrain',
                'FinishOperatingTurn'
            ])
        )
        for (const step of steps) {
            expect(step.source).toBe(ActionSource.System)
            expect(step).not.toHaveProperty('playerId')
        }
        expect(trainsOwnedBy(game.state, { kind: 'company', companyId: 'B&W' })).toHaveLength(1)
    })
})
