import { describe, expect, it } from 'vitest'
import type { FinancialState, Owner } from '../finance/finance.js'
import { PhaseTable } from '../phases/phaseTable.js'
import { TrainDepot } from '../trains/trainDepot.js'
import { PrivateCatalog } from './privateCatalog.js'

const distance = { measure: 'revenue-centers', maximum: 2 } as const
const depot = new TrainDepot({
    id: 'test',
    trains: ['2', '5'].map((id) => ({ id, name: id, price: 100, distance })),
    supply: ['2', '5'].map((definitionId) => ({ definitionId, count: 1 }))
})
const phase = (id: string, startedBy: string[]) => ({
    id,
    startedBy,
    tileColors: ['yellow'],
    operatingRounds: 1,
    trainLimit: 4
})
const phases = new PhaseTable([phase('early', []), phase('late', ['5'])], depot)
const catalog = new PrivateCatalog(
    {
        closurePhaseId: 'late',
        privates: [
            { id: 'A', name: 'Ordinary', faceValue: 45, revenue: 5 },
            {
                id: 'B',
                name: 'Blocker',
                faceValue: 40,
                revenue: 10,
                blocks: { locationIds: ['K4'], until: 'company-owned' }
            },
            {
                id: 'F',
                name: 'Ferry',
                faceValue: 150,
                revenue: 30,
                closure: { survivesWhilePlayerOwned: { revenue: 50 } }
            },
            { id: 'U', name: 'Bank', faceValue: 120, revenue: 0, closure: 'never', sale: 'never' },
            {
                id: 'H',
                name: 'Engine',
                faceValue: 110,
                revenue: 20,
                sale: { minimum: 1, maximum: 200 },
                blocks: { locationIds: ['N18'], until: 'closed' }
            }
        ]
    },
    phases
)
const player: Owner = { kind: 'player', playerId: 'alex' }
const company: Owner = { kind: 'company', companyId: 'R' }
function state(phaseId: string, owners: Record<string, Owner>, closed: string[] = []) {
    const position: FinancialState & { phaseId: string } = {
        phaseId,
        bank: { name: 'Bank' },
        cash: [],
        certificatePools: [],
        companies: [
            { id: 'R', name: 'Railway', kind: 'major', shareCount: 10 },
            ...Object.keys(owners).map((id) => ({
                id,
                name: id,
                kind: 'private',
                privateRevenue: catalog.definition(id).revenue,
                ...(closed.includes(id) ? { closed: true } : {})
            }))
        ],
        certificates: Object.entries(owners)
            .filter(([id]) => !closed.includes(id))
            .map(([id, owner]) => ({
                id: `${id}:charter`,
                companyId: id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner
            }))
    }
    return position
}

describe('a private catalog', () => {
    it('closes privates together at the closure phase, in company order, unless exempt', () => {
        const owners = { A: player, B: company, F: player, U: player, H: company }
        expect(catalog.closureEffects(state('early', owners))).toEqual([])
        expect(catalog.closureEffects(state('late', owners))).toEqual([
            { kind: 'close', privateCompanyId: 'A' },
            { kind: 'close', privateCompanyId: 'B' },
            { kind: 'income', privateCompanyId: 'F', revenue: 50 },
            { kind: 'close', privateCompanyId: 'H' }
        ])
    })

    it('lets an exempt private survive only while a player owns it, and changes its revenue once', () => {
        expect(catalog.closureEffects(state('late', { F: company }))).toEqual([
            { kind: 'close', privateCompanyId: 'F' }
        ])
        const surviving = state('late', { F: player })
        surviving.companies[1].privateRevenue = 50
        expect(catalog.closureEffects(surviving)).toEqual([])
        expect(catalog.closureEffects(state('late', { A: player }, ['A']))).toEqual([])
    })

    it('blocks a location until a company owns the private, or until it closes', () => {
        expect(catalog.blockedBy(state('early', { B: player }), 'K4')?.id).toBe('B')
        expect(catalog.blockedBy(state('early', { B: { kind: 'bank' } }), 'K4')?.id).toBe('B')
        expect(catalog.blockedBy(state('early', { B: company }), 'K4')).toBeUndefined()
        expect(catalog.blockedBy(state('early', { B: player }, ['B']), 'K4')).toBeUndefined()
        expect(catalog.blockedBy(state('early', { B: player }), 'C4')).toBeUndefined()
        expect(catalog.blockedBy(state('early', { H: company }), 'N18')?.id).toBe('H')
        expect(catalog.blockedBy(state('early', { H: company }, ['H']), 'N18')).toBeUndefined()
    })

    it('bounds a sale at half, rounded up, to double face value unless the private says otherwise', () => {
        expect(catalog.priceRange('A')).toEqual({ minimum: 23, maximum: 90 })
        expect(catalog.priceRange('H')).toEqual({ minimum: 1, maximum: 200 })
        expect(catalog.priceRange('U')).toBeUndefined()
        expect(catalog.faceValue('F')).toBe(150)
    })

    it('offers only the privates in play as lots, at face value', () => {
        expect(catalog.lots(state('early', { A: player, F: player }))).toEqual([
            { id: 'A', name: 'Ordinary', price: 45 },
            { id: 'F', name: 'Ferry', price: 150 }
        ])
    })

    it('refuses what it cannot follow', () => {
        expect(() => new PrivateCatalog({ closurePhaseId: 'never', privates: [] }, phases)).toThrow(
            'Unknown phase never'
        )
        expect(
            () =>
                new PrivateCatalog(
                    {
                        closurePhaseId: 'late',
                        privates: [
                            { id: 'A', name: 'A', faceValue: 1, revenue: 0 },
                            { id: 'A', name: 'A again', faceValue: 1, revenue: 0 }
                        ]
                    },
                    phases
                )
        ).toThrow('Duplicate private company')
        expect(() => catalog.faceValue('Z')).toThrow('Unknown private company Z')
    })
})
