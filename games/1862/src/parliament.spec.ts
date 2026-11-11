import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { declineAll, table, type Table } from '../test/kit.js'
import { charterableCompanies, parliamentDecision } from './parliament.js'
import { CharteredParPrices } from './stockMarket.js'

const lowestPar = Math.min(...CharteredParPrices)

function seats(game: Table): string[] {
    return [...game.state.turnManager.turnOrder]
}

function turns(game: Table) {
    return game.state.turnManager.series.map((turn) => turn.playerId)
}

function firstCharterable(game: Table): string {
    const [companyId] = charterableCompanies(game.hydrated)
    assertExists(companyId, 'A charter is to auction')
    return companyId
}

describe('1862 Parliament turns', () => {
    it('gives each opener, bidder and winner a turn of their own', () => {
        const game = table(4)
        const [p0, p1, p2, p3] = seats(game)
        const companyId = firstCharterable(game)
        game.act('OpenCharterAuction', { companyId, bid: 0 }, p0)
        game.act('RaiseCharterBid', { bid: 5 }, p1)
        game.act('PassCharterBid', {}, p2)
        game.act('PassCharterBid', {}, p3)
        game.act('PassCharterBid', {}, p0)
        expect(parliamentDecision(game.state)).toEqual({
            kind: 'charter',
            playerId: p1,
            companyId,
            bid: 5
        })
        game.act('ObtainCharter', { companyId, parPrice: lowestPar, extraShares: 0 }, p1)
        expect(turns(game)).toEqual([p0, p1, p2, p3, p0, p1, p2])
        const series = game.state.turnManager.series
        expect(series.filter((turn) => turn.end === undefined)).toEqual([series.at(-1)])
        expect(game.player).toBe(p2)
    })

    it('passes the opening to the next player in seat order after a decline', () => {
        const game = table(4)
        const [p0, p1, p2] = seats(game)
        expect(game.player).toBe(p0)
        game.act('DeclineCharter', {}, p0)
        expect(game.player).toBe(p1)
        game.act('DeclineCharter', {}, p1)
        expect(game.player).toBe(p2)
        expect(turns(game)).toEqual([p0, p1, p2])
    })

    it('passes the opening to the player after the latest winner, who may not open again', () => {
        const game = table(4)
        const [p0, p1, p2, p3] = seats(game)
        const charterTo = (opener: string, others: readonly string[]) => {
            const companyId = firstCharterable(game)
            game.act('OpenCharterAuction', { companyId, bid: 0 }, opener)
            for (const playerId of others) game.act('PassCharterBid', {}, playerId)
            game.act('ObtainCharter', { companyId, parPrice: lowestPar, extraShares: 0 }, opener)
        }
        charterTo(p0, [p1, p2, p3])
        charterTo(p1, [p2, p3, p0])
        const companyId = firstCharterable(game)
        game.act('OpenCharterAuction', { companyId, bid: 0 }, p2)
        game.act('PassCharterBid', {}, p3)
        game.act('RaiseCharterBid', { bid: 5 }, p0)
        game.act('PassCharterBid', {}, p1)
        game.act('PassCharterBid', {}, p2)
        game.act('ObtainCharter', { companyId, parPrice: lowestPar, extraShares: 0 }, p0)
        expect(game.state.parliament?.winnerIds).toEqual([p1, p0])
        expect(game.state.parliament?.declinedIds).toEqual([p1])
        expect(game.player).toBe(p2)
    })

    it('skips players who passed and closes once every other player has passed', () => {
        const game = table(4)
        const [p0, p1, p2, p3] = seats(game)
        const companyId = firstCharterable(game)
        game.act('OpenCharterAuction', { companyId, bid: 0 }, p0)
        game.act('PassCharterBid', {}, p1)
        game.act('RaiseCharterBid', { bid: 5 }, p2)
        game.act('PassCharterBid', {}, p3)
        expect(game.player).toBe(p0)
        game.act('RaiseCharterBid', { bid: 10 }, p0)
        expect(game.player).toBe(p2)
        expect(game.state.parliament?.auction?.passedIds).toEqual([p1, p3])
        game.act('PassCharterBid', {}, p2)
        expect(game.state.parliament?.auction).toBeUndefined()
        expect(parliamentDecision(game.state)).toEqual({
            kind: 'charter',
            playerId: p0,
            companyId,
            bid: 10
        })
    })

    it('ends the round once every player declines in succession, the priority opening the next', () => {
        const game = table(4)
        const [p0] = seats(game)
        declineAll(game)
        expect(game.state.parliament?.number).toBe(2)
        expect(game.player).toBe(p0)
        declineAll(game)
        expect(game.state.machineState).toBe('StockRound')
        const series = game.state.turnManager.series
        expect(series.filter((turn) => turn.end === undefined)).toEqual([
            expect.objectContaining({ playerId: p0 })
        ])
    })
})
