import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany, placeStockMarker, trainsOwnedBy } from '@tabletop/18xx'
import { auctionMinor, edit, finishStockRound, opened, type Table } from '../test/kit.js'

/** Plays the operating turns, each company running nothing and buying the cheapest train. */
function operateRound(game: Table): void {
    while (game.state.machineState !== 'MergerRound' && game.state.machineState !== 'StockRound') {
        const valid = game.valid()
        const companyId =
            game.state.trackStep?.companyId ??
            game.state.stationStep?.companyId ??
            game.state.routeStep?.companyId ??
            game.state.trainPurchaseStep?.companyId ??
            ''
        if (valid.includes('FinishTrack')) game.act('FinishTrack', { companyId })
        else if (valid.includes('FinishStations')) game.act('FinishStations', { companyId })
        else if (valid.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else if (valid.includes('DistributeEarnings'))
            game.act('DistributeEarnings', { companyId, choice: 'half-pay' })
        else if (
            valid.includes('BuyTrain') &&
            !trainsOwnedBy(game.state, { kind: 'company', companyId }).length
        ) {
            const train = game.state.trainInventory.trains.find((entry) => entry.status === 'depot')
            if (!train) throw new Error('No train left')
            game.act('BuyTrain', {
                companyId,
                trainId: train.id,
                definitionId: train.definitionId,
                expectedPrice: 100
            })
        } else game.act('FinishOperatingTurn', { companyId })
    }
}

describe('1861 merger round', () => {
    it('converts a minor from the yellow column into a public company (§12.2, §12.4)', () => {
        const game = opened(3)
        const owner = game.player
        auctionMinor(game, 'N', 240)
        finishStockRound(game)
        edit(game, (state) => {
            state.phaseId = '3'
        })
        operateRound(game)
        expect(game.state.machineState).toBe('MergerRound')
        edit(game, (state) => placeStockMarker(state.stockMarket, 'N', '3:6'))
        expect(game.player).toBe(owner)
        const treasury = finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'N' })
        game.act('ProposeMerger', {
            kind: 'convert',
            minorId: 'N',
            minorIds: ['N'],
            majorId: 'GRR'
        })
        // The owner may buy more as the director; buying one more share at R120.
        game.act('BuyMergerShares', { shares: 1 })
        const grr = getCompany(game.state, 'GRR')
        expect(grr.started).toBe(true)
        expect(getCompany(game.state, 'N').closed).toBe(true)
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'GRR' })).toBe(
            treasury + 120
        )
        expect(game.state.stations.find((station) => station.id === 'GRR:home')).toMatchObject({
            status: 'placed',
            position: { locationId: 'H8', nodeId: 'city-1' }
        })
        // Then each player in turn may buy one share.
        while (
            game.state.machineState === 'MergerRound' &&
            game.valid().includes('BuyMergerShares')
        )
            game.act('BuyMergerShares', { shares: 0 })
        expect(game.state.mergerRound?.completed).toBe(true)
        const held = game.state.certificates
            .filter(
                (certificate) =>
                    certificate.companyId === 'GRR' && certificate.owner.kind === 'player'
            )
            .reduce(
                (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
                0
            )
        expect(held).toBe(3)
    })

    it('refuses a conversion from outside the yellow column (§12.2)', () => {
        const game = opened(3)
        auctionMinor(game, 'N', 100)
        finishStockRound(game)
        edit(game, (state) => {
            state.phaseId = '3'
        })
        operateRound(game)
        expect(() =>
            game.act('ProposeMerger', {
                kind: 'convert',
                minorId: 'N',
                minorIds: ['N'],
                majorId: 'GRR'
            })
        ).toThrow()
    })
})
