import { expect, it } from 'vitest'
import type { Company, President } from '@tabletop/18xx'
import { minimalPlayState } from '@tabletop/18xx/testing'
import { entityColumns } from './entityColumns.js'

const alex: President = { kind: 'player', playerId: 'alex' }
const blair: President = { kind: 'player', playerId: 'blair' }
const unionBank: President = { kind: 'company', companyId: 'UB' }

function stateWith(companies: Company[], unionBankOwner?: President) {
    const state = minimalPlayState()
    return {
        ...state,
        turnManager: { ...state.turnManager, turnOrder: ['blair', 'alex'] },
        companies: [{ id: 'UB', kind: 'private' } as const, ...companies],
        certificates: unionBankOwner
            ? [{ id: 'UB', companyId: 'UB', owner: unionBankOwner, kind: 'private' } as const]
            : []
    }
}
const major = (id: string, president?: President): Company => ({
    id,
    kind: 'major',
    started: true,
    ...(president ? { president } : {})
})

const columnSummary = (columns: ReturnType<typeof entityColumns>) =>
    columns.map((column) => ({
        players: column.playerIds,
        portfolios: column.portfolioCompanyIds,
        companies: column.companies.map((company) => company.id)
    }))

it('gives each player, in turn order, a column of the companies they preside over', () => {
    const companies = [major('A', alex), major('B', blair), major('C', alex)]
    expect(columnSummary(entityColumns(stateWith(companies), companies, []))).toEqual([
        { players: ['blair'], portfolios: [], companies: ['B'] },
        { players: ['alex'], portfolios: [], companies: ['A', 'C'] }
    ])
})

it('puts a company-held portfolio and the companies it presides over under the player who owns it', () => {
    const companies = [major('A', unionBank), major('B', alex)]
    expect(columnSummary(entityColumns(stateWith(companies, alex), companies, ['UB']))).toEqual([
        { players: ['blair'], portfolios: [], companies: [] },
        { players: ['alex'], portfolios: ['UB'], companies: ['A', 'B'] }
    ])
})

it('ends with a column for what no player controls, only when there is some', () => {
    const companies = [major('A', unionBank), major('B')]
    expect(columnSummary(entityColumns(stateWith(companies), companies, ['UB']))).toEqual([
        { players: ['blair'], portfolios: [], companies: [] },
        { players: ['alex'], portfolios: [], companies: [] },
        { players: [], portfolios: ['UB'], companies: ['A', 'B'] }
    ])
})
