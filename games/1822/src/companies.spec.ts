import { describe, expect, it } from 'vitest'
import { treasuryPoolId } from '@tabletop/18xx'
import {
    Charters1822,
    ConcessionIds1822,
    FirstConcessionId,
    FirstMinorId,
    LnwrId,
    MajorIds1822,
    Majors1822,
    MetropolitanId,
    Minors1822,
    concessionId,
    concessionMajorId,
    createMajorCertificates1822,
    createMinorCertificates1822,
    majorStations1822,
    minorStations1822
} from './companies.js'
import { Names1822 } from './names.js'
import { startingCash1822 } from './opening.js'
import {
    CompanyRevenuePrivateIds1822,
    FirstPrivateId,
    Privates1822,
    TaxHavenPrivateId
} from './privates.js'
import { Bank1822, BiddingTokens1822, CertificateLimits1822, StartingCash1822 } from './setup.js'
import { Phases1822, PrivateTrains1822 } from './trains.js'

describe('the setup (§2.1, Table 1)', () => {
    it('divides £2,100 among three to seven players from a £12,000 bank', () => {
        expect(Bank1822).toBe(12_000)
        expect(StartingCash1822).toEqual({ 3: 700, 4: 525, 5: 420, 6: 350, 7: 300 })
        for (const [players, cash] of Object.entries(StartingCash1822))
            expect(Number(players) * cash).toBe(2100)
        expect(startingCash1822({ playerCount: 5, config: {} })).toBe(420)
    })

    it('sets the certificate limits and bidding tokens', () => {
        expect(CertificateLimits1822).toEqual({ 3: 26, 4: 20, 5: 16, 6: 13, 7: 11 })
        expect(BiddingTokens1822).toEqual({ 3: 6, 4: 5, 5: 4, 6: 3, 7: 3 })
    })
})

describe('the major companies (§3.4, Table 6)', () => {
    it('are ten, each with a concession', () => {
        expect(MajorIds1822).toEqual([
            'LNWR',
            'GWR',
            'LBSCR',
            'SECR',
            'CR',
            'MR',
            'LYR',
            'NBR',
            'SWR',
            'NER'
        ])
        expect(ConcessionIds1822).toHaveLength(10)
        expect(FirstConcessionId).toBe('C-LNWR')
        for (const id of MajorIds1822) expect(concessionMajorId(concessionId(id))).toBe(id)
        expect(Majors1822.find(({ id }) => id === 'LYR')?.initials).toBe('L&YR')
    })

    it('divide ten shares among nine certificates, ten for the LNWR (§3.4.2)', () => {
        for (const id of MajorIds1822) {
            const certificates = createMajorCertificates1822(id)
            const lnwr = id === LnwrId
            expect(certificates).toHaveLength(lnwr ? 10 : 9)
            expect(certificates.reduce((total, { shares }) => total + shares, 0)).toBe(10)
            expect(certificates.filter((certificate) => certificate.president)).toMatchObject([
                { shares: lnwr ? 1 : 2 }
            ])
            expect(new Set(certificates.map((certificate) => certificate.id)).size).toBe(
                certificates.length
            )
            for (const certificate of certificates)
                expect(certificate).toMatchObject({
                    owner: { kind: 'company', companyId: id },
                    poolId: treasuryPoolId(id)
                })
            expect(Charters1822.shareCount(id)).toBe(10)
        }
    })

    it('hold six station tokens, seven for the LNWR (§5.12.1, §5.12.2)', () => {
        for (const id of MajorIds1822) {
            const kinds = majorStations1822(id).map(({ kind }) => kind)
            expect(kinds).toEqual([
                'home',
                'destination',
                'available',
                ...Array.from({ length: id === LnwrId ? 4 : 3 }, () => 'exchange')
            ])
            expect(new Set(majorStations1822(id).map((station) => station.id)).size).toBe(
                kinds.length
            )
        }
    })
})

describe('the minor companies (§3.3, Table 4)', () => {
    it('are 24, and 30 with 1822+', () => {
        expect(Minors1822).toHaveLength(30)
        expect(Minors1822.filter((minor) => !minor.expansion).map(({ id }) => id)).toEqual(
            Array.from({ length: 24 }, (_, index) => `M${index + 1}`)
        )
        expect(FirstMinorId).toBe('M24')
        expect(Minors1822.filter((minor) => !minor.home).map(({ id }) => id)).toEqual([
            MetropolitanId
        ])
    })

    it('are a director’s certificate of half the company, the other half embedded (§3.3.2)', () => {
        const certificates = createMinorCertificates1822('M5', { owner: { kind: 'bank' } })
        expect(certificates).toMatchObject([
            { id: 'M5:president', shares: 2, president: true, owner: { kind: 'bank' } },
            {
                id: 'M5:embedded',
                shares: 2,
                owner: { kind: 'company', companyId: 'M5' },
                poolId: treasuryPoolId('M5')
            }
        ])
        expect(certificates[1].president).toBeUndefined()
        expect(Charters1822.shareCount('M5')).toBe(4)
    })

    it('have one station token each (§5.12.3)', () => {
        expect(minorStations1822('M5')).toEqual([{ id: 'M5:home', kind: 'home' }])
    })
})

describe('the private companies (§3.1, Table 3)', () => {
    it('are 18, and 21 with 1822+', () => {
        expect(Privates1822.map(({ id }) => id)).toEqual(
            Array.from({ length: 21 }, (_, index) => `P${index + 1}`)
        )
        expect(Privates1822.filter((company) => company.expansion).map(({ id }) => id)).toEqual([
            'P19',
            'P20',
            'P21'
        ])
        expect(FirstPrivateId).toBe('P1')
    })

    it('pay the printed revenue', () => {
        expect(Privates1822.map(({ revenue }) => revenue)).toEqual([
            5, 10, 0, 0, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, 10, 10, 0, 5, 10
        ])
        expect(
            Privates1822.filter((company) => company.revenuePerPhase).map(({ id }) => id)
        ).toEqual(['P15', 'P20'])
        for (const company of Privates1822)
            expect(Charters1822.privateRevenue(company.id)).toBe(company.revenue)
        expect(CompanyRevenuePrivateIds1822).toEqual(['P2', 'P11', 'P12'])
    })

    it('are acquired by majors only when red, by either when green, and never when blue (§3.1.3)', () => {
        const ids = (color: string) =>
            Privates1822.filter((company) => company.color === color).map(({ id }) => id)
        expect(ids('blue')).toEqual([TaxHavenPrivateId])
        expect(ids('red')).toEqual(['P1', 'P3', 'P4', 'P5', 'P6', 'P7', 'P17', 'P18'])
        expect(ids('green')).toEqual([
            'P2',
            'P8',
            'P9',
            'P10',
            'P11',
            'P12',
            'P13',
            'P14',
            'P15',
            'P19',
            'P20',
            'P21'
        ])
    })

    it('name the phase they can be acquired from (§3.1.4)', () => {
        expect(Privates1822.map(({ acquiredFromPhaseId }) => acquiredFromPhaseId)).toEqual([
            '5',
            '2',
            '2',
            '2',
            '3',
            '3',
            '3',
            '3',
            '3',
            '3',
            '2',
            '3',
            '5',
            '5',
            '2',
            undefined,
            '2',
            '5',
            '1',
            '3',
            '2'
        ])
        for (const { acquiredFromPhaseId } of Privates1822)
            if (acquiredFromPhaseId) expect(Phases1822.has(acquiredFromPhaseId)).toBe(true)
    })

    it('sort into the three 1822+ stacks (§2.1.7)', () => {
        const stack = (name: string) =>
            Privates1822.filter((company) => company.stack === name).map(({ id }) => id)
        expect(stack('trains')).toEqual(['P1', 'P3', 'P4', 'P13', 'P14', 'P19'])
        expect(stack('track')).toEqual(['P2', 'P5', 'P8', 'P10', 'P11', 'P12', 'P21'])
        expect(stack('other')).toEqual(['P6', 'P7', 'P9', 'P15', 'P16', 'P17', 'P18', 'P20'])
        expect(Object.keys(PrivateTrains1822)).toEqual(stack('trains'))
    })
})

describe('the names', () => {
    it('cover every company and concession', () => {
        expect(Names1822.company('LYR')).toBe('Lancashire & Yorkshire Railway')
        expect(Names1822.company('M24')).toBe('Swansea and Mumbles Railway')
        expect(Names1822.company('P16')).toBe('Off-Shore Tax Haven')
        expect(Names1822.company('C-GWR')).toBe('Great Western Railway concession')
        expect(Charters1822.privateRevenue('C-GWR')).toBe(10)
        expect(Names1822.pool(treasuryPoolId('GWR'))).toBe('Treasury')
        expect(Names1822.pool('bank-pool')).toBe('Bank pool')
    })
})
