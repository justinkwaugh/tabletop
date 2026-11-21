import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    certificateLimitAllows,
    finiteCashOwnedBy,
    getCompany,
    presidentOf,
    sharesOwned,
    stockCertificateCount,
    trainsOwnedBy
} from '@tabletop/18xx'
import {
    buy,
    edit,
    finishStockRound,
    opened,
    setCash,
    start,
    toBuyingTrains,
    type Table
} from '../test/kit.js'
import {
    nationalDecision,
    nationalPriceSpaceId,
    nationalStationsReason,
    nationalTopUp,
    nationalTrainsReason
} from './national.js'
import { EarningsRules1856, TrainRules1856 } from './operating.js'
import type { State1856 } from './state.js'
import { StockRules1856, certificateLimit1856 } from './stock.js'
import { MarketPoolId1856 } from './names.js'
import { Market1856 } from './stockMarket.js'

const price = (prices: number[]) => Market1856.space(nationalPriceSpaceId(prices)).price

describe('1856 CGR starting price (Stock Value)', () => {
    it('starts at $100 when the average is lower', () => {
        expect(price([80, 90])).toBe(100)
    })
    it('drops the lowest of three or more, rounds down to $5, then takes the nearest top-row space', () => {
        expect(price([90, 120, 125])).toBe(125)
        expect(price([105, 105])).toBe(110)
        expect(price([140, 140])).toBe(150)
    })
})

/**
 * GT and CPR started, phase 5 with the 6s next; CPR operates first, then GT buys the first
 * 6-train. CPR owes three loans it cannot repay.
 */
function sixTrainBought(prepare: (state: State1856) => void = () => {}) {
    const game = opened(4)
    edit(game, (state) => {
        for (const entry of state.cash) if (entry.owner.kind === 'player') entry.amount = 1000
    })
    start(game, 'GT', 90)
    start(game, 'CPR', 100)
    buy(game, 'GT', 90, 4)
    buy(game, 'CPR', 100, 4)
    edit(game, (state) => {
        state.trainInventory.trains = state.trainInventory.trains.filter(
            (train) => train.status !== 'depot' || ['6'].includes(train.definitionId)
        )
        state.phaseId = '5'
        getCompany(state, 'GT').loans = 2
        getCompany(state, 'CPR').loans = 3
    })
    finishStockRound(game)
    expect(game.state.trackStep?.companyId).toBe('CPR')
    toBuyingTrains(game)
    if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId: 'CPR' })
    if (game.valid().includes('FinishOperatingTurn'))
        game.act('FinishOperatingTurn', { companyId: 'CPR' })
    expect(game.state.trackStep?.companyId).toBe('GT')
    edit(game, (state) => {
        setCash(state, { kind: 'company', companyId: 'GT' }, 1000)
        setCash(state, { kind: 'company', companyId: 'CPR' }, 50)
        prepare(state)
    })
    toBuyingTrains(game)
    const six = game.state.trainInventory.trains.find(
        (train) => train.status === 'depot' && train.definitionId === '6'
    )
    game.act('BuyTrain', {
        companyId: 'GT',
        trainId: six?.id,
        definitionId: '6',
        expectedPrice: 700
    })
    if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId: 'GT' })
    if (game.valid().includes('FinishOperatingTurn'))
        game.act('FinishOperatingTurn', { companyId: 'GT' })
    return game
}

describe('1856 CGR formation (Canadian Government Railway)', () => {
    it('forms after the 6-train buyer’s turn: treasuries repay what they can, presidents decide', () => {
        const game = sixTrainBought()
        expect(game.state.machineState).toBe('FormingNational')
        // GT repaid both loans from its treasury; CPR's president decides.
        expect(getCompany(game.state, 'GT').loans).toBeUndefined()
        expect(game.state.nationalFormation?.owing).toEqual(['CPR'])
        expect(game.valid()).toContain('SettleNationalLoans')
    })

    it('absorbs a company whose president declines, exchanging two shares for one', () => {
        const game = sixTrainBought()
        const holders = game.state.players.map((player) => ({
            playerId: player.playerId,
            shares: sharesOwned(game.state, 'CPR', { kind: 'player', playerId: player.playerId })
        }))
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        const state = game.hydrated
        const cgr = getCompany(state, 'CGR')
        expect(cgr.started).toBe(true)
        expect(getCompany(state, 'CPR').closed).toBe(true)
        // Two CPR shares for each CGR share; the most CGR shares take the presidency.
        const most = Math.max(...holders.map((entry) => Math.floor(entry.shares / 2)))
        const president = presidentOf(state, 'CGR')
        expect(president?.kind).toBe('player')
        const presidentId = president?.kind === 'player' ? president.playerId : ''
        expect(
            Math.floor((holders.find((entry) => entry.playerId === presidentId)?.shares ?? 0) / 2)
        ).toBe(most)
        expect(state.national?.presidencyOwedBy).toBe(most === 1 ? presidentId : undefined)
        // CPR's treasury, its home station, a $100 price; having operated, it waits for the next round.
        expect(finiteCashOwnedBy(state, { kind: 'company', companyId: 'CGR' })).toBe(50)
        expect(
            state.stations.some(
                (station) =>
                    station.companyId === 'CGR' &&
                    station.status === 'placed' &&
                    station.position.locationId === 'M4'
            )
        ).toBe(true)
        expect(Market1856.companySpace(state.stockMarket, 'CGR').price).toBe(100)
        // Ten companies left besides CPR, and the CGR: 22 certificates at four players.
        expect(state.certificateLimitCompanies).toBe(11)
        expect(certificateLimit1856(state)).toBe(22)
        expect(state.operatingSet?.roundNumber).toBe(2)
    })

    it('borrows a Diesel to run while it has never owned a permanent train', () => {
        const game = sixTrainBought()
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        while (
            game.state.machineState === 'StockRound' ||
            game.state.trackStep?.companyId !== 'CGR'
        ) {
            const valid = game.valid()
            if (game.state.machineState !== 'StockRound') toBuyingTrains(game)
            const companyId = game.state.trainPurchaseStep?.companyId
            if (valid.includes('CompleteNationalPresidency'))
                game.act('CompleteNationalPresidency', {
                    poolId: 'initial-offering',
                    expectedPrice: 100
                })
            else if (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
            else if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId })
            else game.act('FinishOperatingTurn', { companyId })
        }
        game.act('FinishTrack', { companyId: 'CGR' })
        const types = game.actions.map((action) => action.type)
        // With no route it runs nothing, but it borrowed the Diesel first and returned it after.
        expect(types).toContain('BorrowTrain')
        expect(types.indexOf('ReturnBorrowedTrain')).toBeGreaterThan(types.indexOf('BorrowTrain'))
        expect(trainsOwnedBy(game.state, { kind: 'company', companyId: 'CGR' })).toHaveLength(0)
        expect(game.state.national?.borrowedTrainId).toBeUndefined()
    })

    it('does not form when every company repays', () => {
        const game = sixTrainBought()
        edit(game, (state) => {
            for (const entry of state.cash) if (entry.owner.kind === 'player') entry.amount = 1000
        })
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: true })
        expect(getCompany(game.state, 'CGR').closed).toBe(true)
        expect(getCompany(game.state, 'CPR').loans).toBeUndefined()
        expect(game.state.certificateLimitCompanies).toBe(11)
    })
})

/** Plays every company's turn as a pass until the stock round. */
function toStockRound(game: Table) {
    for (let guard = 0; guard < 60 && game.state.machineState !== 'StockRound'; guard++) {
        if (game.state.machineState === 'FormingNational') {
            const valid = game.valid()
            if (valid.includes('ChooseNationalTrains'))
                game.act('ChooseNationalTrains', {
                    trainIds: trainsOwnedBy(game.state, { kind: 'company', companyId: 'CGR' })
                        .slice(0, 3)
                        .map((train) => train.id)
                })
            continue
        }
        toBuyingTrains(game)
        if (game.state.machineState === 'StockRound') break
        const companyId = game.state.trainPurchaseStep?.companyId
        if (game.valid().includes('FinishTrains')) game.act('FinishTrains', { companyId })
        else game.act('FinishOperatingTurn', { companyId })
    }
}

describe('1856 CGR presidency on one share (Determining the CGR President)', () => {
    it('makes the president buy the second share first in the next stock round', () => {
        const game = sixTrainBought()
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        const president = presidentOf(game.state, 'CGR')
        const presidentId = president?.kind === 'player' ? president.playerId : ''
        edit(game, (state) => {
            state.national = { ...state.national, presidencyOwedBy: presidentId }
            state.certificates = state.certificates.map((certificate) =>
                certificate.id === 'CGR:president' && certificate.kind === 'share'
                    ? { ...certificate, shares: 1 }
                    : certificate
            )
        })
        toStockRound(game)
        while (game.state.activePlayerIds[0] !== presidentId) game.act('FinishStockTurn')
        expect(game.valid(presidentId)).toContain('CompleteNationalPresidency')
        expect(game.valid(presidentId)).not.toContain('FinishStockTurn')
        const before = finiteCashOwnedBy(game.state, { kind: 'player', playerId: presidentId })
        const shares = game.state.certificates.length
        game.act(
            'CompleteNationalPresidency',
            { poolId: 'initial-offering', expectedPrice: 100 },
            presidentId
        )
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId: presidentId })).toBe(
            before - 100
        )
        // The certificate is whole again; the share paid for leaves play.
        expect(
            game.state.certificates.find((certificate) => certificate.id === 'CGR:president')
        ).toMatchObject({ shares: 2 })
        expect(game.state.certificates).toHaveLength(shares - 1)
        expect(game.state.national?.presidencyOwedBy).toBeUndefined()
    })
})

describe('1856 CGR open market over half (CGR Share Limits; designer)', () => {
    it('makes a CGR holder buy an open-market share even when they must sell to pay for it', () => {
        const game = sixTrainBought()
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        toStockRound(game)
        const holderId = game.state.activePlayerIds[0]
        const holder = { kind: 'player' as const, playerId: holderId }
        edit(game, (state) => {
            const cgr = state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'CGR' &&
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    certificate.owner.kind === 'bank'
            )
            for (const certificate of cgr) certificate.poolId = MarketPoolId1856
            const single = cgr.find((certificate) => certificate.owner.kind === 'bank')
            if (single) {
                single.owner = holder
                delete single.poolId
            }
            setCash(state, holder, 0)
        })
        expect(game.valid(holderId)).toContain('BuyNationalMarketShare')
        expect(game.valid(holderId)).not.toContain('FinishStockTurn')
        const owned = sharesOwned(game.state, 'CGR', holder)
        const price = Market1856.companySpace(game.state.stockMarket, 'CGR').price
        game.act('BuyNationalMarketShare', { expectedPrice: price }, holderId)
        expect(sharesOwned(game.state, 'CGR', holder)).toBe(owned + 1)
        expect(game.state.cashCrisis?.debts).toEqual([{ playerId: holderId, amount: price }])
        expect(['RaisingCash', 'GameOver']).toContain(game.state.machineState)
    })
})

/** Real 4-trains of the supply, which the formation games have taken out of the depot. */
const fourTrainIds = opened(4)
    .initialState.trainInventory.trains.filter((train) => train.definitionId === '4')
    .map((train) => train.id)

/** The CPR president, as the formation is about to begin. */
function cprPresident(state: State1856): string {
    const president = presidentOf(state, 'CPR')
    if (president?.kind !== 'player') throw new Error('CPR has a player president')
    return president.playerId
}

/** Every president owing loans lets the CGR absorb their companies. */
function declineAll(game: Table) {
    for (let decision = nationalDecision(game.hydrated); decision;) {
        for (const companyId of decision.companyIds)
            game.act('SettleNationalLoans', { companyId, repay: false }, decision.playerId)
        decision = nationalDecision(game.hydrated)
    }
}

describe('1856 CGR loan repayment (Absorbing Companies)', () => {
    it('lets a president repay from their own cash what the treasury cannot', () => {
        const game = sixTrainBought()
        const presidentId = cprPresident(game.state)
        expect(nationalTopUp(game.hydrated, 'CPR')).toBe(250)
        const cash = finiteCashOwnedBy(game.state, { kind: 'player', playerId: presidentId })
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: true }, presidentId)
        expect(getCompany(game.state, 'CPR').loans).toBeUndefined()
        expect(getCompany(game.state, 'CPR').closed).toBeFalsy()
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'CPR' })).toBe(0)
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId: presidentId })).toBe(
            cash - 250
        )
    })

    it('absorbs a company whose president cannot repay, without asking them or selling shares', () => {
        const game = sixTrainBought((state) =>
            setCash(state, { kind: 'player', playerId: cprPresident(state) }, 100)
        )
        expect(
            game.actions.some(
                (action) =>
                    action.type === 'SettleNationalLoans' && action.source !== ActionSource.System
            )
        ).toBe(false)
        expect(getCompany(game.state, 'CPR').closed).toBe(true)
        expect(game.actions.some((action) => action.type === 'SellSharesToPay')).toBe(false)
    })

    it('loses an absorbed company’s escrow to the bank', () => {
        const game = sixTrainBought((state) => {
            const funding = state.funding.find((entry) => entry.companyId === 'CPR')
            if (!funding) throw new Error('CPR has its capitalization')
            funding.escrow = 200
        })
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        // Only CPR's own $50 joins the CGR; its escrow stays with the bank.
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'CGR' })).toBe(50)
        expect(game.state.funding.some((entry) => entry.companyId === 'CPR')).toBe(false)
    })
})

describe('1856 CGR stations and trains (Token Exchange, CGR Trains)', () => {
    /** GT and CPR both absorbed, each with a station in Ironsides beside its home, and CPR two 4-trains and GT one. */
    function bothAbsorbed() {
        const game = sixTrainBought((state) => {
            getCompany(state, 'GT').loans = 5
            for (const [companyId, nodeId] of [
                ['GT', 'city-0'],
                ['CPR', 'city-1']
            ]) {
                const spare = state.stations.find(
                    (station) => station.companyId === companyId && station.status === 'available'
                )
                if (!spare) throw new Error(`${companyId} has a spare station`)
                state.stations = state.stations.map((station) =>
                    station.id === spare.id
                        ? {
                              id: station.id,
                              companyId,
                              status: 'placed',
                              position: { locationId: 'I12', nodeId, slot: 0 }
                          }
                        : station
                )
            }
            state.trainInventory.trains.push(
                ...fourTrainIds.slice(0, 3).map((id, index) => ({
                    id,
                    definitionId: '4',
                    status: 'owned' as const,
                    owner: { kind: 'company' as const, companyId: index < 2 ? 'CPR' : 'GT' }
                }))
            )
        })
        declineAll(game)
        return game
    }

    it('keeps one station a hex, the president choosing between the two in one hex', () => {
        const game = bothAbsorbed()
        const choice = game.state.nationalFormation?.stationChoice
        expect(choice?.keep).toBe(1)
        expect(choice?.stations.map((station) => station.position.locationId)).toEqual([
            'I12',
            'I12'
        ])
        const [first, second] = choice?.stations ?? []
        if (!first || !second) throw new Error('Two stations to choose between')
        expect(
            nationalStationsReason(game.hydrated, [first.stationId, second.stationId])
        ).toBeDefined()
        expect(nationalStationsReason(game.hydrated, [])).toBeDefined()
        expect(nationalStationsReason(game.hydrated, [second.stationId])).toBeUndefined()
        const presidentId = cprPresidentOf(game, 'CGR')
        game.act('ChooseNationalStations', { stationIds: [second.stationId] }, presidentId)
        expect(
            game.state.stations.filter(
                (station) =>
                    station.companyId === 'CGR' &&
                    station.status === 'placed' &&
                    station.position.locationId === 'I12'
            )
        ).toMatchObject([{ position: { nodeId: second.position.nodeId } }])
    })

    it('keeps every permanent train and at most three in all', () => {
        const game = bothAbsorbed()
        const choice = game.state.nationalFormation?.stationChoice
        const presidentId = cprPresidentOf(game, 'CGR')
        if (choice)
            game.act(
                'ChooseNationalStations',
                { stationIds: [choice.stations[0].stationId] },
                presidentId
            )
        expect(game.state.nationalFormation?.trainChoice).toBe(true)
        const trains = trainsOwnedBy(game.state, { kind: 'company', companyId: 'CGR' })
        const sixes = trains.filter((train) => train.definitionId === '6').map((train) => train.id)
        const fours = trains.filter((train) => train.definitionId === '4').map((train) => train.id)
        expect(sixes.length).toBeGreaterThan(0)
        expect(fours).toHaveLength(3)
        expect(nationalTrainsReason(game.hydrated, [...sixes, ...fours])).toBe(
            'The CGR keeps at most three trains.'
        )
        expect(nationalTrainsReason(game.hydrated, fours)).toBe(
            'The CGR keeps every permanent train, up to three.'
        )
        const kept = [...sixes, fours[0]]
        game.act('ChooseNationalTrains', { trainIds: kept }, presidentId)
        expect(
            trainsOwnedBy(game.state, { kind: 'company', companyId: 'CGR' }).map(
                (train) => train.id
            )
        ).toEqual(expect.arrayContaining(kept))
        expect(trainsOwnedBy(game.state, { kind: 'company', companyId: 'CGR' })).toHaveLength(
            kept.length
        )
    })
})

function cprPresidentOf(game: Table, companyId: string): string {
    const president = presidentOf(game.state, companyId)
    if (president?.kind !== 'player') throw new Error(`${companyId} has a player president`)
    return president.playerId
}

describe('1856 the CGR before its first permanent train (CGR Trains, CGR Dividends)', () => {
    function formed() {
        const game = sixTrainBought()
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        return game
    }

    it('withholds until it has owned a permanent train', () => {
        const game = formed()
        expect(EarningsRules1856.choices(game.hydrated, 'CGR')).toEqual(['withhold'])
        edit(game, (state) => {
            state.national = { ...state.national, permanentTrain: true }
        })
        expect(EarningsRules1856.choices(game.hydrated, 'CGR')).toEqual(['pay', 'withhold'])
    })

    it('must buy a permanent train once it has $1,100, or $750 with a 4-train to trade, never from its president', () => {
        const game = formed()
        const required = (cash: number, four: boolean) => {
            edit(game, (state) => {
                setCash(state, { kind: 'company', companyId: 'CGR' }, cash)
                state.trainInventory.trains = state.trainInventory.trains.filter(
                    (train) => train.id !== fourTrainIds[3]
                )
                if (four)
                    state.trainInventory.trains.push({
                        id: fourTrainIds[3],
                        definitionId: '4',
                        status: 'owned',
                        owner: { kind: 'company', companyId: 'CGR' }
                    })
            })
            return TrainRules1856.requiresTrain(game.hydrated, 'CGR')
        }
        expect(required(1099, false)).toBe(false)
        expect(required(1100, false)).toBe(true)
        expect(required(749, true)).toBe(false)
        expect(required(750, true)).toBe(true)
        expect(TrainRules1856.limitReason?.(game.hydrated, 'CGR', '4')).toBe(
            'The CGR buys only permanent trains.'
        )
    })
})

describe('1856 the CGR’s 5% shares (CGR Share Limits; designer)', () => {
    it('lets a 5% share fill the certificate limit, never pass it', () => {
        const game = sixTrainBought()
        game.act('SettleNationalLoans', { companyId: 'CPR', repay: false })
        edit(game, (state) => {
            getCompany(state, 'CGR').shareCount = 20
        })
        const state = game.hydrated
        const share = state.certificates.find(
            (certificate) =>
                certificate.companyId === 'CGR' &&
                certificate.kind === 'share' &&
                !certificate.president
        )
        if (!share) throw new Error('The CGR has ordinary shares')
        expect(StockRules1856.certificateWeight(state, share)).toBe(0.5)
        const player = { kind: 'player' as const, playerId: game.player }
        const count = stockCertificateCount(state, player, StockRules1856)
        const withLimit = (limit: number) =>
            certificateLimitAllows(state, player, share, {
                ...StockRules1856,
                certificateLimit: () => limit
            })
        expect(withLimit(count + 0.5)).toBe(true)
        expect(withLimit(count)).toBe(false)
    })
})
