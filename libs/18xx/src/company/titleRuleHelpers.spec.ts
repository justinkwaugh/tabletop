import { describe, expect, it } from 'vitest'
import {
    createOrdinaryShareCertificates,
    openShares,
    presidentCertificate,
    type FinancialState,
    type Owner
} from '../finance/finance.js'
import { certificateWealthItem } from '../ending/finalWealth.js'
import { createCompanyStations, homeStationId } from '../map/station.js'
import { floatedCompaniesInMarketOrder } from '../operating/operatingSet.js'
import {
    createRectangularStockMarket,
    placeStockMarker,
    type StockMarket
} from '../stock/stockMarket.js'
import { allSharesHeld } from '../stock/stockRoundRules.js'
import { marketSaleTerms } from '../stock/stockRules.js'
import { fullCapitalizationPayments, sharesStillToFloat } from './companyFlotation.js'

const ipo = { owner: { kind: 'bank' } as const, poolId: 'ipo' }
const alex: Owner = { kind: 'player', playerId: 'alex' }
function position(sold: number, funded = false) {
    const stockMarket = createRectangularStockMarket([[60, 70, 80]], () => 'white')
    placeStockMarker(stockMarket, 'A', '0:1')
    placeStockMarker(stockMarket, 'B', '0:2')
    const state: Pick<FinancialState, 'companies' | 'certificates'> & { stockMarket: StockMarket } =
        {
            stockMarket,
            certificates: createOrdinaryShareCertificates(
                'A',
                Array.from({ length: 8 }, (_, index) => (index < sold - 2 ? { owner: alex } : ipo)),
                sold >= 2 ? alex : ipo
            ),
            companies: [
                {
                    id: 'A',
                    name: 'Alpha',
                    kind: 'major',
                    shareCount: 10,
                    started: true,
                    parPrice: 65,
                    funded,
                    floated: true
                },
                {
                    id: 'B',
                    name: 'Beta',
                    kind: 'major',
                    shareCount: 10,
                    started: true,
                    floated: false
                },
                {
                    id: 'C',
                    name: 'Gamma',
                    kind: 'major',
                    shareCount: 10,
                    started: true,
                    floated: true,
                    closed: true
                }
            ]
        }
    return state
}
const inOffering = (certificate: { poolId?: string }) => certificate.poolId === 'ipo'

describe('helpers for ordinary title rules', () => {
    it('counts the shares that must still leave the offering before a company floats', () => {
        expect(sharesStillToFloat(position(4), 'A', 50, inOffering)).toBe(1)
        expect(sharesStillToFloat(position(5), 'A', 50, inOffering)).toBe(0)
        expect(sharesStillToFloat(position(5), 'A', 60, inOffering)).toBe(1)
        expect(sharesStillToFloat(position(6), 'A', 60, inOffering)).toBe(0)
    })

    it('pays par times the share count once the company can float, and only once', () => {
        expect(fullCapitalizationPayments(position(4), 'A', 1)).toBeUndefined()
        expect(fullCapitalizationPayments(position(5), 'A', 0)).toEqual([
            { from: { kind: 'bank' }, to: { kind: 'company', companyId: 'A' }, amount: 650 }
        ])
        expect(fullCapitalizationPayments(position(5, true), 'A', 0)).toEqual([])
    })

    it('finds a company’s open shares and its president certificate', () => {
        const state = position(3)
        expect(openShares(state, 'A')).toHaveLength(9)
        expect(presidentCertificate(state, 'A')?.id).toBe('A:president')
        expect(presidentCertificate(state, 'B')).toBeUndefined()
    })

    it('is sold out when every open share is held as the title counts holding', () => {
        const byPlayers = (certificate: { owner: Owner }) => certificate.owner.kind === 'player'
        expect(allSharesHeld(position(10), 'A', byPlayers)).toBe(true)
        expect(allSharesHeld(position(9), 'A', byPlayers)).toBe(false)
        expect(allSharesHeld(position(9), 'A', () => true)).toBe(true)
        expect(allSharesHeld(position(10), 'C', () => true)).toBe(false)
    })

    it('sells to a bank pool at the market price, moving the price down', () => {
        expect(
            marketSaleTerms(position(5), 'A', {
                destinationPoolId: 'market',
                marketLimit: 50,
                maximumShares: 10,
                movement: 2
            })
        ).toEqual({
            payer: { kind: 'bank' },
            price: 70,
            direction: 'down',
            destinationPoolId: 'market',
            marketLimit: 50,
            maximumShares: 10,
            movement: 2
        })
    })

    it('operates floated, open companies by stock price', () => {
        expect(floatedCompaniesInMarketOrder(position(5))).toEqual(['A'])
    })

    it('labels a final-wealth line and names a company’s station markers', () => {
        const state = position(5)
        expect(certificateWealthItem(state, presidentCertificate(state, 'A')!, 140)).toEqual({
            assetId: 'A:president',
            label: 'Alpha · 2 shares',
            value: 140
        })
        expect(createCompanyStations('A', 3).map((station) => station.id)).toEqual([
            homeStationId('A'),
            'A:station:1',
            'A:station:2'
        ])
    })
})
