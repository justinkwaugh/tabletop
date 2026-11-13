import { describe, expect, it } from 'vitest'
import {
    Charters1849,
    Corporations1849,
    createCertificates1849,
    lastCertificateId,
    TokenFees1849
} from './companies.js'
import { Map1849 } from './map.js'
import { PrivateCatalog1849 } from './privates.js'
import { CertificateLimits1849, CorporationCountsByPlayers1849, startingCash1849 } from './setup.js'

describe('the corporations (§7.2)', () => {
    it('divide ten shares among eight certificates', () => {
        for (const { id } of Corporations1849) {
            const certificates = createCertificates1849(id)
            expect(certificates).toHaveLength(8)
            expect(certificates.reduce((total, { shares }) => total + shares, 0)).toBe(10)
            expect(certificates.filter((certificate) => certificate.president)).toMatchObject([
                { shares: 2 }
            ])
            const last = certificates.find(
                (certificate) => certificate.id === lastCertificateId(id)
            )
            expect([last?.shares, last?.president]).toEqual([2, undefined])
            expect(certificates.filter((certificate) => certificate.shares === 1)).toHaveLength(6)
            expect(Charters1849.shareCount(id)).toBe(10)
        }
    })

    it('charge the printed token fees', () => {
        expect(TokenFees1849).toEqual({ AFG: 40, ATA: 30, CTL: 40, IFT: 90, RCS: 130, SFA: 40 })
    })

    it('start in cities', () => {
        for (const corporation of Corporations1849)
            for (const id of corporation.homeLocationIds)
                expect(
                    Map1849.location(id).preprintedTile.nodes.some((node) => node.kind === 'city'),
                    id
                ).toBe(true)
    })
})

describe('the privates (§7.1)', () => {
    it('sell to corporations for L. 1 to twice their value, except the Reale Società', () => {
        expect(PrivateCatalog1849.priceRange('SCE')).toEqual({ minimum: 1, maximum: 40 })
        expect(PrivateCatalog1849.priceRange('SMS')).toEqual({ minimum: 1, maximum: 220 })
        expect(PrivateCatalog1849.priceRange('RSA')).toBeUndefined()
        expect(PrivateCatalog1849.privates.map((item) => item.revenue)).toEqual([5, 10, 15, 20, 25])
    })
})

describe('the table (§2, §9.1)', () => {
    it('gives each player count its capital, corporations and certificate limit', () => {
        expect(
            [3, 4, 5].map((playerCount) => startingCash1849({ playerCount, config: {} }))
        ).toEqual([500, 375, 300])
        const limits = Object.entries(CorporationCountsByPlayers1849).flatMap(([players, counts]) =>
            counts.map((corporations) => CertificateLimits1849[corporations][Number(players)])
        )
        expect(limits).toEqual([12, 11, 9, 9])
    })
})
