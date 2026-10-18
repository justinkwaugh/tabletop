import { expect, it } from 'vitest'
import type { StockState } from '@tabletop/18xx'
import { spreadsheetCompanies } from './spreadsheetCompanies.js'

function state(companies: readonly Partial<StockState['companies'][number]>[]) {
    return {
        companies: companies.map((company) => ({
            kind: 'major',
            shareCount: 10,
            ...company
        })),
        certificates: []
    } as unknown as StockState
}

const ids = (companies: readonly { id: string }[]) => companies.map((company) => company.id)

it('follows the operating order, then companies that started but do not operate', () => {
    const companies = state([
        { id: 'B', started: true },
        { id: 'A', started: true, floated: true },
        { id: 'C', started: true, floated: true }
    ])
    expect(ids(spreadsheetCompanies(companies, [], 0, ['C', 'A']))).toEqual(['C', 'A', 'B'])
})

it('keeps included companies last when the operating order also lists them', () => {
    const companies = state([
        { id: 'S', started: true, floated: true },
        { id: 'Gt', started: true },
        { id: 'PEIR' }
    ])
    expect(ids(spreadsheetCompanies(companies, [], 0, ['S', 'PEIR'], ['PEIR']))).toEqual([
        'S',
        'Gt',
        'PEIR'
    ])
})
