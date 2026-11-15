import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { BuyShares, PresidencyChange, SellShares } from '@tabletop/18xx'
import { tradedCertificateIds } from './shareCards.js'

const shares = (id: string) => (id === 'R-president' ? 2 : 1)

function presidency(exchangedCertificateIds: string[]): PresidencyChange {
    return {
        companyId: 'R',
        previous: { kind: 'player', playerId: 'blair' },
        next: { kind: 'player', playerId: 'alex' },
        presidentCertificateId: 'R-president',
        exchangedCertificateIds
    }
}

function sale(certificateIds: string[], exchangedCertificateIds: string[]): SellShares {
    return {
        id: 'sell',
        gameId: 'cards',
        source: ActionSource.User,
        playerId: 'blair',
        type: 'SellShares',
        seller: { kind: 'player', playerId: 'blair' },
        sales: [{ companyId: 'R', shares: certificateIds.length }],
        expectedProceeds: 300,
        metadata: {
            seller: { kind: 'player', playerId: 'blair' },
            sales: [
                {
                    companyId: 'R',
                    shares: certificateIds.length,
                    certificateIds,
                    destinationPoolId: 'market',
                    price: 100,
                    proceeds: 300,
                    fromMarketSpaceId: '0:1',
                    toMarketSpaceId: '1:1',
                    presidency: presidency(exchangedCertificateIds)
                }
            ],
            payments: [],
            proceeds: 300
        }
    }
}

it('shows the bought certificate when a purchase transfers the presidency', () => {
    const buy: BuyShares = {
        id: 'buy',
        gameId: 'cards',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'BuyShares',
        buyer: { kind: 'player', playerId: 'alex' },
        certificateId: 'R-3',
        expectedPrice: 100,
        metadata: {
            certificateId: 'R-3',
            companyId: 'R',
            shares: 1,
            buyer: { kind: 'player', playerId: 'alex' },
            seller: { kind: 'bank' },
            price: 100,
            payments: [],
            presidency: presidency(['R-2', 'R-3'])
        }
    }
    expect(tradedCertificateIds(buy, shares)).toEqual(['R-3'])
})

it('shows the president’s certificate in place of the shares exchanged for it in a sale', () => {
    expect(tradedCertificateIds(sale(['R-4', 'R-5', 'R-6'], ['R-5', 'R-6']), shares)).toEqual([
        'R-4',
        'R-president'
    ])
})

it('drops as many sold shares as the president’s certificate holds when none were exchanged', () => {
    expect(tradedCertificateIds(sale(['R-4', 'R-5', 'R-6'], []), shares)).toEqual([
        'R-6',
        'R-president'
    ])
})
