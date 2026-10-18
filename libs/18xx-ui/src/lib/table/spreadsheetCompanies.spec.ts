import { expect, it } from 'vitest'
import type { Company } from '@tabletop/18xx'
import { minimalPlayState } from '@tabletop/18xx/testing'
import { spreadsheetCompanies } from './spreadsheetCompanies.js'

function withCompanies(companies: readonly Omit<Company, 'kind' | 'shareCount'>[]) {
    return {
        ...minimalPlayState(),
        companies: companies.map((company) => ({ kind: 'major', shareCount: 10, ...company }))
    }
}

const ids = (companies: readonly { id: string }[]) => companies.map((company) => company.id)

it('follows the operating order, then companies that started but do not operate', () => {
    const state = withCompanies([
        { id: 'B', started: true },
        { id: 'A', started: true, floated: true },
        { id: 'C', started: true, floated: true }
    ])
    expect(ids(spreadsheetCompanies(state, [], 0, ['C', 'A']))).toEqual(['C', 'A', 'B'])
})

it('keeps included companies last when the operating order also lists them', () => {
    const state = withCompanies([
        { id: 'S', started: true, floated: true },
        { id: 'Gt', started: true },
        { id: 'PEIR' }
    ])
    expect(ids(spreadsheetCompanies(state, [], 0, ['S', 'PEIR'], ['PEIR']))).toEqual([
        'S',
        'Gt',
        'PEIR'
    ])
})

it('keeps included companies first when the operating order starts with them', () => {
    const state = withCompanies([
        { id: 'MS', started: true },
        { id: 'B', started: true },
        { id: 'A', started: true, floated: true },
        { id: 'BIG4', started: true }
    ])
    expect(ids(spreadsheetCompanies(state, [], 0, ['MS', 'BIG4', 'A'], ['MS', 'BIG4']))).toEqual([
        'MS',
        'BIG4',
        'A',
        'B'
    ])
})

it('lists companies the operating order leaves out after it when it holds only included ones', () => {
    const state = withCompanies([
        { id: 'B', started: true },
        { id: 'MS', started: true },
        { id: 'BIG4', started: true }
    ])
    expect(ids(spreadsheetCompanies(state, [], 0, ['MS', 'BIG4'], ['MS', 'BIG4']))).toEqual([
        'MS',
        'BIG4',
        'B'
    ])
})
