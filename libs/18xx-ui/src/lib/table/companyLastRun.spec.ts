import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { DistributeEarnings, EarningsChoice, RunTrains } from '@tabletop/18xx'
import { companyLastRun } from './companyLastRun.js'

const fields = { gameId: 'g', source: ActionSource.User, playerId: 'alex' }
function run(id: string, companyId: string): RunTrains {
    return { ...fields, id, companyId, type: 'RunTrains', routes: [] }
}
function distribute(id: string, companyId: string, choice: EarningsChoice): DistributeEarnings {
    const metadata = {
        companyId,
        choice,
        revenue: 0,
        retained: 0,
        dividendPerShare: 0,
        bonusPerShare: 0,
        bankAdjustment: 0,
        payments: [],
        privateEffects: [],
        round: { number: 1, roundNumber: 1 }
    }
    return { ...fields, id, companyId, type: 'DistributeEarnings', choice, metadata }
}

it('reads a company’s last run as withheld only once its distribution withheld it', () => {
    const actions = [
        run('r1', 'R'),
        distribute('d1', 'R', 'withhold'),
        run('s1', 'S'),
        distribute('e1', 'S', 'half-pay'),
        run('r2', 'R')
    ]
    expect(companyLastRun(actions, 1, 'R')).toEqual({ run: actions[0], withheld: false })
    expect(companyLastRun(actions, 2, 'R')).toEqual({ run: actions[0], withheld: true })
    expect(companyLastRun(actions, 4, 'S')).toEqual({ run: actions[2], withheld: false })
    expect(companyLastRun(actions, 5, 'R')).toEqual({ run: actions[4], withheld: false })
    expect(companyLastRun(actions, 5, 'B')).toBeUndefined()
})

it('ignores a distribution recorded outside an operating round, as the payouts do', () => {
    const withheld = distribute('d1', 'R', 'withhold')
    const { round: _, ...metadata } = withheld.metadata!
    const unrounded = { ...withheld, metadata }
    expect(companyLastRun([run('r1', 'R'), unrounded], 2, 'R')?.withheld).toBe(false)
})
