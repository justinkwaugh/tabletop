import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    getCompany,
    certificatesOwnedBy,
    cashOwnedBy,
    certificatesInPool,
    getTreasury,
    sharesOwned,
    privateOwner,
    controllingOwner,
    countCertificatesForLimit,
    FinanceFields,
    validateFinances,
    type FinancialState,
    type Owner
} from './finance.js'

const FinanceValidator = Compile(Type.Object(FinanceFields))

const player = { kind: 'player', playerId: 'one' } as const
const investor = { kind: 'company', companyId: 'investment' } as const
const bank = { kind: 'bank' } as const
const position: FinancialState = {
    bank: { name: 'Bank' },
    companies: [
        { id: 'investment', name: 'Investment company', kind: 'private' },
        { id: 'railway', name: 'Railway', kind: 'major', shareCount: 20, president: investor }
    ],
    certificatePools: [
        { id: 'ipo', name: 'IPO', owner: bank },
        { id: 'market', name: 'Market', owner: bank }
    ],
    cash: [
        { owner: player, amount: 100 },
        { owner: investor, amount: 40 },
        { owner: bank, amount: 800 }
    ],
    certificates: [
        {
            id: 'investment:private',
            companyId: 'investment',
            owner: player,
            kind: 'private',
            retired: false,
            certificateLimitCount: 1
        },
        {
            id: 'president',
            companyId: 'railway',
            owner: investor,
            kind: 'share',
            shares: 4,
            president: true,
            retired: false,
            certificateLimitCount: 1
        },
        {
            id: 'small',
            companyId: 'railway',
            owner: player,
            kind: 'share',
            shares: 1,
            president: false,
            retired: false,
            certificateLimitCount: 0.5
        },
        {
            id: 'offered',
            companyId: 'railway',
            owner: bank,
            poolId: 'ipo',
            kind: 'share',
            shares: 1,
            president: false,
            retired: false,
            certificateLimitCount: 0.5
        },
        {
            id: 'retired',
            companyId: 'railway',
            kind: 'share',
            shares: 1,
            president: false,
            retired: true,
            certificateLimitCount: 0.5
        }
    ]
}

function validatedCopy(data: FinancialState = position) {
    const state = structuredClone(data)
    validateFinances(state, ['one', 'two'])
    return state
}

describe('finances', () => {
    it('keeps personal assets and company treasuries separate through hydration', () => {
        const state = validatedCopy()
        expect(cashOwnedBy(state, player)).toBe(100)
        expect(getTreasury(state, 'investment').cash).toBe(40)
        expect(
            getTreasury(state, 'investment').portfolio.map((certificate) => certificate.id)
        ).toEqual(['president'])
        expect(certificatesOwnedBy(state, player).map((certificate) => certificate.id)).toEqual([
            'investment:private',
            'small'
        ])
        expect(sharesOwned(state, 'railway', player)).toBe(1)
        expect(countCertificatesForLimit(certificatesOwnedBy(state, player))).toBe(1.5)
        expect(countCertificatesForLimit(state.certificates)).toBe(3)
        const restored = validatedCopy(JSON.parse(JSON.stringify(state)))
        expect(restored).toEqual(position)
        restored.cash[2].amount = 'unlimited'
        expect(cashOwnedBy(restored, bank)).toBe('unlimited')
        expect(cashOwnedBy(restored, { kind: 'company', companyId: 'railway' })).toBeUndefined()
    })

    it('changes pool membership without changing ownership, and excludes retired certificates', () => {
        const state = validatedCopy()
        const certificate = certificatesInPool(state, 'ipo')[0]
        certificate.poolId = 'market'
        expect(certificatesInPool(state, 'ipo')).toEqual([])
        expect(certificatesInPool(state, 'market')).toEqual([certificate])
        expect(certificatesOwnedBy(state, bank)).toEqual([certificate])
        certificate.owner = player
        delete certificate.poolId
        expect(certificatesInPool(state, 'market')).toEqual([])
        expect(certificatesOwnedBy(state, bank)).toEqual([])
        expect(sharesOwned(state, 'railway', player)).toBe(2)
        expect(certificatesOwnedBy(validatedCopy(state), player)).toHaveLength(3)
        expect(
            certificatesOwnedBy(state, player).some((certificate) => certificate.id === 'retired')
        ).toBe(false)
    })

    it('derives controlling owners from private ownership and immediate presidencies', () => {
        const state = validatedCopy()
        expect(getCompany(state, 'railway').president).toEqual(investor)
        expect(privateOwner(state, 'investment')).toEqual(player)
        expect(getCompany(state, 'investment').president).toBeUndefined()
        expect(controllingOwner(state, 'investment')).toEqual(player)
        expect(controllingOwner(state, 'railway')).toEqual(player)
        certificatesOwnedBy(state, player)[0].owner = { kind: 'player', playerId: 'two' }
        expect(controllingOwner(state, 'railway')).toEqual({ kind: 'player', playerId: 'two' })
        getCompany(state, 'railway').president = player
        expect(controllingOwner(state, 'railway')).toEqual(player)
        certificatesOwnedBy(state, { kind: 'player', playerId: 'two' })[0].owner = bank
        expect(controllingOwner(state, 'investment')).toBeUndefined()
    })

    it('allows company control chains and cycles without inventing a controlling player', () => {
        const companies: FinancialState['companies'] = [
            { id: 'a', name: 'A', kind: 'major', president: { kind: 'company', companyId: 'b' } },
            { id: 'b', name: 'B', kind: 'minor', president: { kind: 'company', companyId: 'c' } },
            { id: 'c', name: 'C', kind: 'major', president: player }
        ]
        const state = validatedCopy({ ...position, companies, certificates: [], cash: [] })
        expect(controllingOwner(state, 'a')).toEqual(player)
        getCompany(state, 'c').president = { kind: 'company', companyId: 'a' }
        expect(controllingOwner(state, 'a')).toBeUndefined()
        expect(controllingOwner(validatedCopy(state), 'c')).toBeUndefined()
        delete getCompany(state, 'c').president
        expect(controllingOwner(state, 'a')).toBeUndefined()
    })

    it('rejects invalid owners, duplicate identities, negative cash and pool ownership mismatches', () => {
        expect(() => validateFinances(position, [])).toThrow('player')
        expect(() =>
            validatedCopy({ ...position, cash: [...position.cash, position.cash[0]] })
        ).toThrow('Duplicate')
        expect(() =>
            validatedCopy({
                ...position,
                companies: [...position.companies, position.companies[0]]
            })
        ).toThrow('Duplicate')
        expect(() =>
            validatedCopy({ ...position, cash: [{ owner: player, amount: -1 }] })
        ).toThrow()
        for (const owner of [
            { kind: 'company', companyId: 'missing' },
            { kind: 'player', playerId: 'missing' }
        ] satisfies Owner[]) {
            expect(() =>
                validatedCopy({
                    ...position,
                    certificatePools: [{ id: 'bad', name: 'Bad', owner }]
                })
            ).toThrow('Unknown')
        }
        const state = validatedCopy()
        const certificate = certificatesInPool(state, 'ipo')[0]
        certificate.poolId = 'missing'
        expect(() => validatedCopy(state)).toThrow('Unknown certificate pool')
        certificate.poolId = 'ipo'
        certificate.owner = player
        expect(() => validatedCopy(state)).toThrow('pool owner mismatch')
    })

    it('rejects incompatible certificate shapes and conflicting private ownership', () => {
        const state = validatedCopy()
        const retired = state.certificates.find((certificate) => certificate.retired)
        expect(
            FinanceValidator.Check({ ...position, certificates: [{ ...retired, owner: player }] })
        ).toBe(false)
        expect(
            FinanceValidator.Check({
                ...position,
                certificates: [{ ...position.certificates[0], owner: undefined }]
            })
        ).toBe(false)
        state.certificates.push({ ...state.certificates[0], id: 'second-private' })
        expect(() => validatedCopy(state)).toThrow('one ownership certificate')
        state.certificates.pop()
        getCompany(state, 'investment').president = player
        expect(() => validatedCopy(state)).toThrow('private is controlled through its owner')
    })
})
