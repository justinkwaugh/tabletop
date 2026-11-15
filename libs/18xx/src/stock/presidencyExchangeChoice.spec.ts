import { expect, it } from 'vitest'
import {
    applyPresidencyChange,
    certificateMixesForShares,
    evaluatePresidency,
    type PresidencyExchangeState
} from './presidency.js'
import {
    choosePresidencyExchange,
    presidencyExchangeOptions,
    presidencyExchangeReason
} from './presidencyExchangeChoice.js'
import {
    certificatesOwnedBy,
    sharesOwned,
    type Certificate,
    type FinancialState
} from '../finance/finance.js'

const previous = { kind: 'player', playerId: 'previous' } as const
const next = { kind: 'player', playerId: 'next' } as const

/** A president of two shares and one more; the newcomer holds a two-share and `singles` ones. */
function example(singles: number): FinancialState & PresidencyExchangeState {
    const share = (id: string, shares: number, owner: Certificate['owner']): Certificate => ({
        id,
        companyId: 'rail',
        kind: 'share',
        shares,
        owner
    })
    return {
        bank: {},
        companies: [{ id: 'rail', kind: 'major', shareCount: 10, president: previous }],
        certificates: [
            { ...share('president', 2, previous), president: true },
            share('single:0', 1, previous),
            ...Array.from({ length: singles }, (_, index) => share(`single:${index + 1}`, 1, next)),
            share('last', 2, next)
        ],
        cash: [],
        certificatePools: []
    }
}
const held = (state: FinancialState, owner: typeof previous | typeof next) =>
    certificatesOwnedBy(state, owner)
        .map((certificate) => certificate.id)
        .toSorted()

it('finds each mix of certificate sizes making up the shares, the largest first', () => {
    const state = example(2)
    expect(certificateMixesForShares(certificatesOwnedBy(state, next), 'rail', 2)).toEqual([
        ['last'],
        ['single:1', 'single:2']
    ])
    expect(certificateMixesForShares(certificatesOwnedBy(state, next), 'rail', 3)).toEqual([
        ['last', 'single:1']
    ])
})

it('exchanges the largest and leaves the outgoing president to choose', () => {
    const state = example(2)
    const { change } = evaluatePresidency(state, 'rail', [next, previous], undefined, {
        choice: true
    })
    expect(change?.exchangedCertificateIds).toEqual(['last'])
    expect(change?.alternatives).toEqual([['single:1', 'single:2']])
    if (!change) throw new Error('Expected a presidency change')
    applyPresidencyChange(state, change)
    expect(state.presidencyExchanges).toEqual([change])
    expect(
        presidencyExchangeReason(state, {
            playerId: 'next',
            companyId: 'rail',
            certificateIds: ['last']
        })
    ).toBeDefined()
    expect(
        presidencyExchangeReason(state, {
            playerId: 'previous',
            companyId: 'rail',
            certificateIds: ['single:1']
        })
    ).toBeDefined()
    const before = [sharesOwned(state, 'rail', previous), sharesOwned(state, 'rail', next)]
    choosePresidencyExchange(state, ['single:2', 'single:1'])
    expect(held(state, previous)).toEqual(['single:0', 'single:1', 'single:2'])
    expect(held(state, next)).toEqual(['last', 'president'])
    expect([sharesOwned(state, 'rail', previous), sharesOwned(state, 'rail', next)]).toEqual(before)
    expect(state.presidencyExchanges).toBeUndefined()
})

it('keeps the exchange as made when the outgoing president takes the largest', () => {
    const state = example(2)
    const { change } = evaluatePresidency(state, 'rail', [next, previous], undefined, {
        choice: true
    })
    if (!change) throw new Error('Expected a presidency change')
    applyPresidencyChange(state, change)
    expect(presidencyExchangeOptions(change)).toEqual([['last'], ['single:1', 'single:2']])
    choosePresidencyExchange(state, ['last'])
    expect(held(state, previous)).toEqual(['last', 'single:0'])
    expect(state.presidencyExchanges).toBeUndefined()
})

it('waits for no choice when the shares are held only one way', () => {
    const state = example(1)
    // The outgoing president's single goes, so the newcomer's three shares lead their two.
    state.certificates = state.certificates.filter((certificate) => certificate.id !== 'single:0')
    const { change } = evaluatePresidency(state, 'rail', [next, previous], undefined, {
        choice: true
    })
    expect(change?.exchangedCertificateIds).toEqual(['last'])
    expect(change?.alternatives).toBeUndefined()
    if (!change) throw new Error('Expected a presidency change')
    applyPresidencyChange(state, change)
    expect(state.presidencyExchanges).toBeUndefined()
})
