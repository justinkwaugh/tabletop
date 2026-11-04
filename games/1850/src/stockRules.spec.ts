import { describe, expect, it } from 'vitest'
import { getCompany, placeStockMarker } from '@tabletop/18xx'
import {
    PriceProtection1850,
    ShareRedemption1850,
    StockRules1850,
    reissueParPrice,
    tableCertificateLimit
} from './stock.js'
import { operated, prepared, turnFor } from '../test/kit.js'
import { Market1850 } from './stockMarket.js'

describe('certificate limits (§21)', () => {
    it.each([
        [2, 24, 21],
        [3, 17, 15],
        [4, 14, 12],
        [5, 11, 9],
        [6, 9, 8]
    ])('with %i players are %i, then %i once a company closes', (count, nine, eight) => {
        const closing = (closed: boolean) =>
            prepared((state) => {
                getCompany(state, 'GN').closed = closed
            }, count).state
        expect(tableCertificateLimit(closing(false))).toBe(nine)
        expect(tableCertificateLimit(closing(true))).toBe(eight)
    })
})

describe('price protection (§5.9)', () => {
    it('lets a president protect a company they sold earlier this stock round (§5.9.10)', () => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { shares: 6, cash: 0 })
            const share = state.certificates.find(
                (certificate) =>
                    certificate.companyId === 'GN' &&
                    certificate.kind === 'share' &&
                    certificate.poolId === 'initial-offering'
            )
            if (!share) throw new Error('No GN share on offer')
            share.owner = { kind: 'player', playerId: 'p2' }
            delete share.poolId
            turnFor(state, 'p2')
            state.stockRound.number = 2
            state.stockRound.sales.push({
                owner: { kind: 'player', playerId: 'p1' },
                companyId: 'GN'
            })
        })
        game.act(
            'SellShares',
            {
                seller: { kind: 'player', playerId: 'p2' },
                sales: [{ companyId: 'GN', shares: 1 }],
                expectedProceeds: 100
            },
            'p2'
        )
        game.act('FinishStockTurn', {}, 'p2')
        expect(game.state.machineState).toBe('ProtectingPrice')
        expect(game.state.activePlayerIds).toEqual(['p1'])
        expect(PriceProtection1850.decision(game.hydrated)?.sale.companyId).toBe('GN')
    })
})

describe('private sales between players (§5.7, §15.1)', () => {
    const inRound = (number: number) =>
        prepared((state) => {
            state.stockRound.number = number
        })

    it('are refused in the initial stock round', () => {
        const game = inRound(1)
        expect(StockRules1850.privateSales?.priceRange(game.hydrated, 'GRSC')).toBeUndefined()
    })

    it('go for any price of at least $1 afterwards', () => {
        const game = inRound(2)
        expect(StockRules1850.privateSales?.priceRange(game.hydrated, 'GRSC')).toEqual({
            minimum: 1
        })
    })
})

describe('reissue (§5.11)', () => {
    it('stays open with reissued shares unsold, once the original offering has sold', () => {
        const game = prepared((state) => {
            operated(state, 'GN', 'p1', { shares: 7 })
            const certificates = state.certificates.filter(
                (certificate) => certificate.companyId === 'GN' && certificate.kind === 'share'
            )
            const [reissued, redeemed, sold] = certificates.filter(
                (certificate) => certificate.poolId === 'initial-offering'
            )
            sold.owner = { kind: 'player', playerId: 'p2' }
            delete sold.poolId
            redeemed.owner = { kind: 'company', companyId: 'GN' }
            delete redeemed.poolId
            state.stockRound.number = 3
            state.reissues = { GN: 2 }
            expect(reissued.poolId).toBe('initial-offering')
            turnFor(state, 'p1')
        })
        expect(ShareRedemption1850.reissueChoices(game.hydrated, 'p1')).toEqual([
            expect.objectContaining({ companyId: 'GN' })
        ])
    })

    it('takes the higher of the old par and the par boxes’ price', () => {
        const at = (price: number, parPrice: number) => {
            const game = prepared((state) => {
                operated(state, 'GN', 'p1', { price: parPrice })
                const space = Market1850.spaces.find((entry) => entry.price === price)
                if (!space) throw new Error(`No $${price} space`)
                placeStockMarker(state.stockMarket, 'GN', space.id)
                getCompany(state, 'GN').parPrice = parPrice
            })
            return reissueParPrice(game.hydrated, 'GN')
        }
        expect(at(160, 100)).toBe(120)
        expect(at(120, 100)).toBe(100)
        expect(at(400, 100)).toBe(200)
    })
})
