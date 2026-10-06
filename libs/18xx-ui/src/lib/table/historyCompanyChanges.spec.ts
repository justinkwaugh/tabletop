import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { type FloatCompany } from '@tabletop/18xx'
import { historyCompanyChanges } from './historyCompanyChanges.js'

it('uses recorded company effects even when reversal data is absent or replaced', () => {
    const float: FloatCompany = {
        id: 'float',
        gameId: 'history',
        type: 'FloatCompany',
        source: ActionSource.System,
        companyId: 'A',
        metadata: {
            companyId: 'A',
            payments: [],
            companyChanges: {
                presidents: [
                    {
                        companyId: 'A',
                        previous: { kind: 'player', playerId: 'alex' },
                        next: { kind: 'company', companyId: 'bank' }
                    }
                ],
                closedCompanyIds: ['private']
            }
        }
    }
    const later: GameAction = {
        id: 'sale',
        gameId: 'history',
        type: 'SellShares',
        source: ActionSource.User,
        undoPatch: [{ op: 'replace', path: '', value: {} }]
    }
    const original = structuredClone([float, later])
    expect(historyCompanyChanges([float, later]).get(float.id)).toEqual(
        float.metadata?.companyChanges
    )
    expect(historyCompanyChanges([float, later]).has(later.id)).toBe(false)
    float.undoPatch = [{ op: 'replace', path: '/companies', value: [] }]
    expect(historyCompanyChanges([float]).get(float.id)).toEqual(float.metadata?.companyChanges)
    delete float.undoPatch
    expect([float, later]).toEqual(original)
})

it('accepts legacy records without inventing company effects', () => {
    const float: FloatCompany = {
        id: 'float',
        gameId: 'history',
        type: 'FloatCompany',
        source: ActionSource.System,
        companyId: 'A',
        metadata: { companyId: 'A', payments: [] }
    }
    expect(historyCompanyChanges([float]).size).toBe(0)
})
