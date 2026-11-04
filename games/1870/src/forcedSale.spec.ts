import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { EmergencyTrainFunding, getCompany, placeStockMarker, type Owner } from '@tabletop/18xx'
import { operated, prepared, trackAlong } from '../test/position.js'
import type { Table } from '../test/table.js'
import { TrainFundingRules1870 } from './operating.js'
import type { State1870 } from './state.js'
import { StockRules1870 } from './stock.js'
import { Market1870 } from './stockMarket.js'
import { TileSet1870 } from './tiles.js'
import { TrainRules1870 } from './trains.js'

const Ima: Owner = { kind: 'player', playerId: 'p1' }

function hold(state: State1870, companyId: string, owner: Owner | 'market', shares: number) {
    const open = state.certificates.filter(
        (certificate) =>
            certificate.companyId === companyId &&
            certificate.kind === 'share' &&
            certificate.poolId === 'initial-offering'
    )
    for (const certificate of open.slice(0, shares)) {
        if (owner === 'market') certificate.poolId = 'open-market'
        else {
            certificate.owner = owner
            delete certificate.poolId
        }
    }
}

function setPrice(state: State1870, companyId: string, price: number) {
    const space = Market1870.spaces.find((entry) => entry.price === price)
    assertExists(space, `No $${price} space`)
    placeStockMarker(state.stockMarket, companyId, space.id)
}

function setCash(state: State1870, playerId: string, amount: number) {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    assertExists(account, 'The player has cash')
    account.amount = amount
}

const p = (playerId: string): Owner => ({ kind: 'player', playerId })

/** The Illinois Central, with $13 and no train, and Ima Swindler, with $37, of p. 25's example. */
function imaSwindler(): Table {
    const game = prepared((state) => {
        state.stockRound.number = 2
        state.phaseId = '12'
        state.trainInventory.trains = state.trainInventory.trains.filter(
            (train) => train.status !== 'depot' || train.definitionId === '12'
        )
        for (const company of state.companies) if (company.kind === 'private') company.closed = true
        operated(state, 'IC', 'p1', { price: 100, shares: 4, cash: 13 })
        hold(state, 'IC', p('p2'), 2)
        hold(state, 'IC', p('p3'), 2)
        hold(state, 'IC', 'market', 2)
        operated(state, 'SP', 'p1', { price: 68, shares: 6, cash: 0 })
        hold(state, 'SP', 'market', 4)
        operated(state, 'TP', 'p2', { price: 68, shares: 5, cash: 0 })
        hold(state, 'TP', Ima, 3)
        hold(state, 'TP', p('p3'), 2)
        operated(state, 'MP', 'p1', { price: 68, shares: 3, cash: 0 })
        hold(state, 'MP', p('p2'), 2)
        hold(state, 'MP', p('p3'), 1)
        hold(state, 'MP', p('p4'), 1)
        hold(state, 'MP', 'market', 3)
        setCash(state, 'p1', 37)
        state.tileInventory = TileSet1870.createInventory(
            trackAlong(['K16', 'J17', 'I18', 'H19', 'G20'])
        )
    })
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    expect(game.state.trackStep?.companyId).toBe('IC')
    game.act('FinishTrack', { companyId: 'IC' })
    expect(game.state.machineState).toBe('BuyingTrains')
    const state = structuredClone(game.state)
    setPrice(state, 'IC', 90)
    setPrice(state, 'SP', 160)
    setPrice(state, 'TP', 120)
    setPrice(state, 'MP', 110)
    game.state = state
    const purchase = funding(game).purchases()[0]
    game.act('FundTrain', {
        companyId: purchase.companyId,
        trainId: purchase.trainId,
        definitionId: purchase.definitionId,
        expectedPrice: purchase.price
    })
    return game
}

const funding = (game: Table) =>
    new EmergencyTrainFunding(game.hydrated, TrainFundingRules1870, StockRules1870, TrainRules1870)

function offered(game: Table) {
    const choice = funding(game).next()
    if (choice.kind !== 'sell') return {}
    const most: Record<string, number> = {}
    for (const sale of choice.sales)
        for (const { companyId, shares } of sale.sales)
            most[companyId] = Math.max(most[companyId] ?? 0, shares)
    return most
}

function sellMost(game: Table, companyId: string) {
    const choice = funding(game).next()
    if (choice.kind !== 'sell') throw new Error(`Expected a sale, got ${choice.kind}`)
    const sale = choice.sales
        .filter((entry) => entry.sales[0].companyId === companyId)
        .sort((a, b) => b.proceeds - a.proceeds)[0]
    game.act('SellFundingShares', {
        seller: Ima,
        companyId,
        shares: sale.sales[0].shares,
        expectedProceeds: sale.proceeds
    })
    return sale.proceeds
}

describe('a forced sale (p. 25)', () => {
    const prices = (game: Table) =>
        Object.fromEntries(
            ['IC', 'SP', 'TP', 'MP'].map((companyId) => [
                companyId,
                Market1870.companySpace(game.state.stockMarket, companyId).price
            ])
        )

    function sellAll(game: Table) {
        return ['IC', 'SP', 'TP', 'MP'].map((companyId) => sellMost(game, companyId))
    }

    it('limits each sale: the presidency held, the open market at 50%, a passing president', () => {
        expect(offered(imaSwindler())).toEqual({ IC: 2, SP: 1, TP: 3, MP: 2 })
    })

    it('raises $920 and goes bankrupt, the T&P’s president deciding before the game ends', () => {
        const game = imaSwindler()
        expect(sellAll(game)).toEqual([180, 160, 360, 220])
        expect(getCompany(game.state, 'MP').president).toEqual(p('p2'))
        expect(game.state.machineState).toBe('ProtectingPrice')
        expect(game.player).toBe('p2')
        game.act('DeclineProtection', { companyId: 'TP' })
        expect(game.state.machineState).toBe('GameOver')
        expect(prices(game)).toEqual({ IC: 76, SP: 140, TP: 90, MP: 90 })
        const ima = game.state.finalWealth?.find((entry) => entry.playerId === 'p1')
        expect(ima?.total).toBe(942)
    })

    it('holds the T&P at $120 if its president protects', () => {
        const game = imaSwindler()
        sellAll(game)
        game.act('ProtectShares', { companyId: 'TP' })
        expect(game.state.machineState).toBe('GameOver')
        expect(prices(game).TP).toBe(120)
    })
})
