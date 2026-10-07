import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import type { AuctionAwardDetails, BuyAuctionLot, ResolveAuction, RunTrains } from '@tabletop/18xx'
import { historyDescription } from './historyDescription.js'
import { historyStateFixture } from './history.fixture.js'

it('describes purchased and auctioned bonus shares without current certificates or reversal data', () => {
    const state = historyStateFixture()
    const award: AuctionAwardDetails = {
        lotId: 'private',
        playerId: 'alex',
        price: 100,
        shares: [
            { certificateId: 'president', companyId: 'R', shares: 2, president: true },
            { certificateId: 'ordinary', companyId: 'S', shares: 1, president: false }
        ]
    }
    const buy: BuyAuctionLot = {
        id: 'buy',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'BuyAuctionLot',
        lotId: 'private',
        expectedPrice: 100,
        metadata: award
    }
    const resolve: ResolveAuction = {
        id: 'resolve',
        gameId: 'history',
        source: ActionSource.System,
        type: 'ResolveAuction',
        metadata: { kind: 'award', award }
    }
    expect(historyDescription(buy, state).text).toBe(
        'Bought private, with the R president’s certificate and 1 S'
    )
    expect(historyDescription(resolve, state).detail).toBe(
        'alex won private for $100, with the R president’s certificate and 1 S'
    )
    const expected = historyDescription(resolve, state)
    resolve.undoPatch = [{ op: 'replace', path: '', value: {} }]
    expect(historyDescription(resolve, state)).toEqual(expected)
    delete resolve.metadata
    expect(historyDescription(resolve, state).text).toBe('Auction resolved')
})

it('lists a run’s bonuses beneath it, totalled by what earned them', () => {
    const state = historyStateFixture()
    const route = (bonuses: { locationId: string; amount: number; label?: string }[]) => ({
        trainId: 'train',
        start: { locationId: 'A1', nodeId: 'city' },
        paths: [{ locationId: 'A1', pathId: 'edge-0' }],
        visits: [],
        payments: [],
        bonuses,
        distance: 2,
        revenue: 100
    })
    const run: RunTrains = {
        id: 'run',
        gameId: 'history',
        source: ActionSource.User,
        playerId: 'alex',
        type: 'RunTrains',
        companyId: 'R',
        routes: [],
        metadata: {
            companyId: 'R',
            revenue: 200,
            routes: [
                route([
                    { locationId: 'C17', amount: 30, label: 'East–West' },
                    { locationId: 'C5', amount: 50, label: 'East–West' },
                    { locationId: 'B8', amount: 40, label: 'Steamboat' }
                ]),
                route([{ locationId: 'G9', amount: 20 }])
            ]
        }
    }
    expect(historyDescription(run, state).detail).toBe(
        'East–West +$80 · Steamboat +$40 · +$20 at G9'
    )
})
