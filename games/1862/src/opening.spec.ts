import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { available, charter, declineAll, table } from '../test/kit.js'
import { marketSpaceIdAt } from './stockMarket.js'
import { Stalled, endingTrigger, stalled } from './lner.js'

describe('1862 opening', () => {
    it('deals eight companies at once, four from B, four from C and four out of play', () => {
        const game = table(4)
        const phases = Object.values(game.state.availability)
        expect(phases.filter((phase) => phase === 'A')).toHaveLength(8)
        expect(phases.filter((phase) => phase === 'B')).toHaveLength(4)
        expect(phases.filter((phase) => phase === 'C')).toHaveLength(4)
        expect(game.state.removedCompanyIds).toHaveLength(4)
        const permits = Object.values(game.state.originalPermits)
        expect(permits.filter((kind) => kind === 'freight')).toHaveLength(6)
        expect(permits.filter((kind) => kind === 'express')).toHaveLength(5)
    })

    it('adds a company at once and a permit of each kind with seven or eight players', () => {
        const game = table(8)
        expect(Object.values(game.state.availability).filter((p) => p === 'A')).toHaveLength(10)
        expect(game.state.removedCompanyIds).toHaveLength(2)
        expect(Object.keys(game.state.originalPermits)).toHaveLength(18)
    })

    it('opens with two Parliament Rounds, then the first stock round', () => {
        const game = table(4)
        expect(game.state.machineState).toBe('ParliamentRound')
        const priority = game.state.turnManager.turnOrder[0]
        expect(game.player).toBe(priority)
        declineAll(game)
        expect(game.state.machineState).toBe('ParliamentRound')
        expect(game.state.parliament?.number).toBe(2)
        declineAll(game)
        expect(game.state.machineState).toBe('StockRound')
        expect(game.player).toBe(priority)
    })

    it('charters a company: bid, par and director’s certificate paid to the bank', () => {
        const game = table(4)
        const [companyId] = available(game)
        const winner = game.player
        game.act('OpenCharterAuction', { companyId, bid: 10 })
        game.act('RaiseCharterBid', { bid: 20 })
        while (game.state.parliament?.auction) game.act('PassCharterBid')
        const buyer = game.player
        expect(buyer).not.toBe(winner)
        game.act('ObtainCharter', { companyId, parPrice: 74, extraShares: 0 })
        const cash = game.state.cash.find(
            (entry) => entry.owner.kind === 'player' && entry.owner.playerId === buyer
        )
        expect(cash?.amount).toBe(600 - 20 - 3 * 74)
        expect(game.state.chartered).toContain(companyId)
        expect(game.state.obligations).toEqual([{ companyId, playerId: buyer, stockRound: 1 }])
        expect(game.state.parliament?.openerId).not.toBe(buyer)
    })

    it('floats a chartered company bought to half, with three £60 stations', () => {
        const game = table(4)
        const [companyId] = available(game)
        charter(game, companyId, 100, 2)
        const company = game.state.companies.find((entry) => entry.id === companyId)
        expect(company?.floated).toBe(true)
        const treasury = game.state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
        )
        expect(treasury?.amount).toBe(1000 - 180)
        expect(
            game.state.stations.filter((station) => station.companyId === companyId)
        ).toHaveLength(3)
        expect(game.state.obligations).toEqual([])
    })
})

describe('1862 stock rounds', () => {
    function toStockRound(game: ReturnType<typeof table>) {
        declineAll(game)
        declineAll(game)
        expect(game.state.machineState).toBe('StockRound')
    }

    it('starts a non-chartered company at a chosen price, paying three times it to the company', () => {
        const game = table(4)
        toStockRound(game)
        const [companyId] = available(game)
        game.act('StartCompany', {
            buyer: { kind: 'player', playerId: game.player },
            companyId,
            marketSpaceId: marketSpaceIdAt(150),
            expectedPrice: 450
        })
        const company = game.state.companies.find((entry) => entry.id === companyId)
        expect(company?.parPrice).toBe(100)
        expect(
            game.state.certificates.filter((entry) => entry.poolId === `treasury:${companyId}`)
        ).toHaveLength(7)
        const treasury = game.state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
        )
        expect(treasury?.amount).toBe(450)
    })

    it('has the director of a floated non-chartered company choose its stations', () => {
        const game = table(4)
        toStockRound(game)
        const [companyId] = available(game)
        const director = game.player
        game.act('StartCompany', {
            buyer: { kind: 'player', playerId: director },
            companyId,
            marketSpaceId: marketSpaceIdAt(100),
            expectedPrice: 300
        })
        game.act('FinishStockTurn')
        for (let bought = 0; bought < 2;) {
            const certificate = game.state.certificates.find(
                (entry) => entry.poolId === `treasury:${companyId}`
            )
            game.act('BuyShares', {
                buyer: { kind: 'player', playerId: game.player },
                certificateId: certificate?.id,
                expectedPrice: 100
            })
            bought++
            if (game.state.machineState === 'BuyingStations') break
            game.act('FinishStockTurn')
        }
        expect(game.state.machineState).toBe('BuyingStations')
        expect(game.player).toBe(director)
        game.act('BuyStations', { companyId, count: 5 })
        expect(game.state.machineState).toBe('StockRound')
        const treasury = game.state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
        )
        expect(treasury?.amount).toBe(500 - 200)
        expect(game.state.stations.filter((entry) => entry.companyId === companyId)).toHaveLength(5)
    })

    it('fines an unfloated charter five times par and returns the company to the IPO', () => {
        const game = table(4)
        const [companyId] = available(game)
        const holder = game.player
        charter(game, companyId, 90)
        declineAll(game)
        declineAll(game)
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
        const cash = game.state.cash.find(
            (entry) => entry.owner.kind === 'player' && entry.owner.playerId === holder
        )
        // 600 - 270 for the director's certificate, then 450 fine less 3 × 45 for the shares.
        expect(cash?.amount).toBe(600 - 270 - 450 + 135)
        expect(game.state.companies.find((entry) => entry.id === companyId)?.started).toBeFalsy()
        expect(
            game.state.certificates.filter(
                (entry) => entry.companyId === companyId && entry.poolId === 'initial-offering'
            )
        ).toHaveLength(8)
    })
})

describe('1862 stalemate', () => {
    it('ends the game once no company runs and no player can afford to start one', () => {
        const game = table(3)
        expect(stalled(game.hydrated)).toBe(false)
        // The cheapest start is a director's certificate at the lowest price, three times £54.
        for (const entry of game.state.cash) if (entry.owner.kind === 'player') entry.amount = 161
        expect(stalled(game.hydrated)).toBe(true)
        expect(endingTrigger(game.hydrated)?.reason).toBe(Stalled)
        const richest = game.state.cash.find((entry) => entry.owner.kind === 'player')
        assertExists(richest, 'Players hold cash')
        richest.amount = 162
        expect(stalled(game.hydrated)).toBe(false)
    })
})
