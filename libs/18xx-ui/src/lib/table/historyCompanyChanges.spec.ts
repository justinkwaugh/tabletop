import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { type Company, type FloatCompany } from '@tabletop/18xx'
import { historyCompanyChanges } from './historyCompanyChanges.js'

it('keeps an earlier presidency change independent of later recorded owners without mutation', () => {
    const companies: Company[] = [
        { id: 'A', name: 'A', kind: 'major', president: { kind: 'player', playerId: 'casey' } }
    ]
    const float: FloatCompany = {
        id: 'float',
        gameId: 'history',
        type: 'FloatCompany',
        source: ActionSource.System,
        companyId: 'A',
        undoPatch: [{ op: 'replace', path: '/companies/0/president/playerId', value: 'alex' }]
    }
    const later: GameAction = {
        id: 'sale',
        gameId: 'history',
        type: 'SellShares',
        source: ActionSource.User,
        undoPatch: [{ op: 'replace', path: '/companies/0/president/playerId', value: 'blair' }]
    }
    const before = structuredClone({ companies, actions: [float, later] })
    const changes = historyCompanyChanges([float, later], { companies })
    expect(changes.get(float.id)?.presidents).toEqual([
        {
            companyId: 'A',
            previous: { kind: 'player', playerId: 'alex' },
            next: { kind: 'player', playerId: 'blair' }
        }
    ])
    expect(changes.has(later.id)).toBe(false)
    expect({ companies, actions: [float, later] }).toEqual(before)
})
