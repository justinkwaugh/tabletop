import { describe, expect, it } from 'vitest'
import { AuctionKind, CompanyId } from '@tabletop/hill-country-grocers'
import { saleDescription, winVerb } from './describeAction.js'

describe('player sentences', () => {
    it('describes a sale in the past tense, so it reads for any buyer', () => {
        const sale = {
            companyId: CompanyId.Verbena,
            kind: AuctionKind.Initial,
            buyerId: 'p1',
            price: 4
        }
        expect(saleDescription(sale)).toEqual([
            { playerId: 'p1' },
            ' bought the ',
            { companyId: CompanyId.Verbena },
            ' share for $4'
        ])
    })

    it('agrees the win with the winners', () => {
        expect(winVerb(['p2'], 'p1')).toBe('wins')
        expect(winVerb(['p1'], 'p1')).toBe('win')
        expect(winVerb(['p1'], undefined)).toBe('wins')
        expect(winVerb(['p1', 'p2'], 'p1')).toBe('share the win')
    })
})
