import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists, GameResult } from '@tabletop/common'
import {
    TrackConstruction,
    stockCertificateCount,
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    sharesOwned,
    trainsOwnedBy,
    sameOwner,
    createStockRound,
    RouteEvaluation,
    EarningsDistribution,
    evaluateShareSale,
    type RoutePath,
    type Owner
} from '@tabletop/18xx'
import { emergencyBuyingGame } from './testSupport.js'
import { bankruptcyShortfall } from './bankruptcy.js'
import { inReceivership } from './receivership.js'
import { receiverShareChoices } from './receiverShares.js'
import { receiverTrainPurchase } from './receiverOperations.js'
import { StockRules1846, Market1846 } from './stock.js'
import { TrackRules1846 } from './track.js'
import { TransferRules1846 } from './acquisitions.js'
import { RouteRules1846 } from './routes.js'
import { EarningsRules1846 } from './earnings.js'
import { emergencyTrainChoices } from './emergencyTrain.js'

type Table = ReturnType<typeof emergencyBuyingGame>
const treasury = { kind: 'company', companyId: 'IC' } as const
function setCash(table: Table, owner: Owner, amount: number) {
    const balance = table.state.cash.find((entry) => sameOwner(entry.owner, owner))
    assertExists(balance)
    balance.amount = amount
}
function giveShares(table: Table, companyId: string, playerId: string, shares: number) {
    const certificates = table.state.certificates
        .filter(
            (certificate) =>
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'company'
        )
        .slice(0, shares)
    expect(certificates).toHaveLength(shares)
    for (const certificate of certificates) {
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
    }
}
function setPrice(table: Table, price: number) {
    const space = Market1846.spaces.find((space) => space.price === price)
    assertExists(space)
    placeStockMarker(table.state.stockMarket, 'IC', space.id)
}
function funding(price = 40, cash = 0) {
    const table = emergencyBuyingGame(0, price)
    const playerId = table.state.activePlayerIds[0]
    setCash(table, { kind: 'player', playerId }, cash)
    return { table, playerId }
}
function declare(table: Table) {
    return table.act('DeclareBankruptcy1846', { companyId: 'IC' })
}
function stockRound(table: Table, playerId = 'p2') {
    table.state.machineState = 'StockRound'
    table.state.stockRound = createStockRound(2)
    table.state.activePlayerIds = [playerId]
    table.state.turnManager.turnOrder = ['p2', 'p3']
}
function receiverStock() {
    const { table } = funding()
    table.act('StartEmergencyFunding', { companyId: 'IC' })
    declare(table)
    stockRound(table)
    if (getCompany(table.state, 'IC').closed) throw Error('Fixture must preserve IC')
    return table
}

describe('1846 bankruptcy and receivership', () => {
    it('liquidates the president, closes their independent and private, eliminates them, and replays/undoes atomically', () => {
        const { table, playerId } = funding()
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        expect(bankruptcyShortfall(table.hydrated)).toBe(60)
        const before = structuredClone(table.state)
        const result = declare(table)
        expect(table.state.bankruptPlayerIds).toEqual([playerId])
        expect(table.state.turnManager.turnOrder).not.toContain(playerId)
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId })).toBe(0)
        expect(getCompany(table.state, 'BIG4').closed).toBe(true)
        expect(getCompany(table.state, 'SC').closed).toBe(true)
        expect(result.processedActions[0].metadata).toMatchObject({
            receiverCompanyIds: ['IC'],
            forcedSales: [{ companyId: 'IC', shares: 2, price: 20, proceeds: 40 }],
            closedPrivateIds: ['SC']
        })
        expect(
            table.state.certificates.some(
                (c) => c.owner.kind === 'player' && c.owner.playerId === playerId
            )
        ).toBe(false)
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('forces remaining stock above the market cap without moving its price', () => {
        const { table, playerId } = funding(20)
        giveShares(table, 'IC', playerId, 4)
        for (const certificate of table.state.certificates) {
            if (certificate.companyId === 'IC' && certificate.owner.kind === 'company') {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = 'open-market'
            }
        }
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        expect(bankruptcyShortfall(table.hydrated)).toBe(60)
        const result = declare(table)
        expect(result.processedActions[0].metadata).toMatchObject({
            sales: [{ proceeds: 20 }],
            forcedSales: [{ shares: 5, price: 10, proceeds: 50 }]
        })
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(10)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(10)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(0)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(70)
    })
    it('rejects premature, wrong-player, and forged system declarations', () => {
        const { table } = funding()
        expect(() => declare(table)).toThrow()
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        expect(() =>
            table.act('DeclareBankruptcy1846', { companyId: 'IC', playerId: 'p2' })
        ).toThrow()
        expect(() =>
            table.act('DeclareBankruptcy1846', { companyId: 'IC', source: ActionSource.System })
        ).toThrow()
        setCash(table, { kind: 'player', playerId: table.state.activePlayerIds[0] }, 60)
        expect(bankruptcyShortfall(table.hydrated)).toBeUndefined()
        expect(() => declare(table)).toThrow()
    })
    it('hands the compulsory purchase to an eligible new president without their predecessor’s sale restrictions', () => {
        const { table, playerId } = funding()
        giveShares(table, 'IC', 'p2', 2)
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        declare(table)
        expect(getCompany(table.state, 'IC').president).toEqual({ kind: 'player', playerId: 'p2' })
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.activePlayerIds).toEqual(['p2'])
        expect(table.state.emergencyFunding).toBeUndefined()
        expect(table.state.bankruptPlayerIds).toEqual([playerId])
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: 'p2' })).toBe(2)
        setCash(table, { kind: 'player', playerId: 'p2' }, 500)
        const choice = emergencyTrainChoices(table.hydrated)[0]
        assertExists(choice)
        table.act('EmergencyBuyTrain', choice)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
    })
    it('automatically buys a receiver’s cheapest train using the forced liquidation proceeds', () => {
        const { table } = funding(40, 20)
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        const result = declare(table)
        expect(result.processedActions.map((a) => a.type)).toContain('BuyReceiverTrain')
        expect(trainsOwnedBy(table.state, treasury).map((t) => t.definitionId)).toEqual(['2'])
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(0)
        expect(inReceivership(table.state, 'IC')).toBe(true)
    })
    it('buys the cheaper phase-II face and resumes receiver completion after advancing phase', () => {
        const { table } = funding(40, 100)
        table.state.trainInventory.trains = table.state.trainInventory.trains.filter(
            (train) => !(train.status === 'depot' && train.definitionId === '2')
        )
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        expect(bankruptcyShortfall(table.hydrated)).toBe(40)
        const before = structuredClone(table.state)
        const result = declare(table)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'DeclareBankruptcy1846',
            'BuyReceiverTrain',
            'AdvancePhase',
            'FinishReceiverTurn',
            'StartOperatingRound',
            'StartOperatingTurn'
        ])
        expect(table.state.phaseId).toBe('II')
        expect(table.state.phaseChange).toBeUndefined()
        expect(trainsOwnedBy(table.state, treasury).map((train) => train.definitionId)).toEqual([
            '3/5'
        ])
        expect(getCompany(table.state, 'IC').president).toBeUndefined()
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
    })
    it.each([
        [60, 40, false],
        [20, undefined, true]
    ] as const)(
        'automatically operates a trainless receiver at $%i and closes it only at zero',
        (price, after, closed) => {
            const { table } = funding()
            table.act('StartEmergencyFunding', { companyId: 'IC' })
            declare(table)
            setPrice(table, price)
            expect(table.state.machineState).toBe('LayingTrack')
            const result = table.act('FinishTrack', { companyId: 'MS' })
            expect(result.processedActions.map((action) => action.type)).toContain(
                'StartReceiverTurn'
            )
            expect(result.processedActions.map((action) => action.type)).toContain('SettleReceiver')
            expect(getCompany(table.state, 'IC').closed ?? false).toBe(closed)
            if (after !== undefined) {
                expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(after)
                expect(table.state.machineState).toBe('StockRound')
                expect(table.state.turnManager.turnOrder).not.toContain('p1')
            }
        }
    )
    it('accepts a surviving player’s routes, automatically withholds, and forbids receiver train sales', () => {
        const { table } = funding(40, 20)
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        declare(table)
        setPrice(table, 60)
        const station = table.state.stations.find(
            (station) => station.companyId === 'IC' && station.status === 'placed'
        )
        assert(station?.status === 'placed')
        station.position = { locationId: 'C15', nodeId: 'city', slot: 1 }
        const choice = new TrackConstruction(table.hydrated, TrackRules1846).choices('B16')[0]
        assertExists(choice)
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = choice
        table.act('LayTile', {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
        table.act('FinishTrack', { companyId: 'MS' })
        table.act('RunTrains', { companyId: 'MS', routes: [] })
        expect(table.state.machineState).toBe('RunningReceiver')
        expect(table.state.activePlayerIds.toSorted()).toEqual(['p2', 'p3'])
        const evaluation = new RouteEvaluation(table.hydrated, RouteRules1846)
        const start = { locationId: 'C15', nodeId: 'city' }
        const paths: RoutePath[] = []
        for (const locationId of ['C15', 'B16']) {
            const path = evaluation.network.extensions(start, paths).find(
                (path) =>
                    path.locationId === locationId &&
                    (locationId === 'B16' ||
                        evaluation.network
                            .face('C15')
                            .paths.find((entry) => entry.id === path.pathId)
                            ?.endpoints.some((end) => end.kind === 'edge' && end.edge === 3))
            )
            assertExists(path)
            paths.push(path)
        }
        const trainId = trainsOwnedBy(table.state, treasury)[0].id
        const routes = [{ trainId, start, paths }]
        expect(evaluation.evaluate('IC', routes).result?.revenue).toBe(60)
        expect(() => table.act('RunTrains', { companyId: 'IC', routes, playerId: 'p1' })).toThrow()
        expect(() => table.act('FinishTrack', { companyId: 'IC' })).toThrow()
        const result = table.act('RunTrains', { companyId: 'IC', routes, playerId: 'p3' })
        expect(result.processedActions.map((action) => action.type)).toContain('SettleReceiver')
        expect(result.processedActions[1].metadata).toMatchObject({
            choice: 'withhold',
            revenue: 60,
            retained: 60
        })
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(60)
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(50)
        expect(inReceivership(table.state, 'IC')).toBe(true)
        table.state.machineState = 'BuyingTrains'
        expect(
            TransferRules1846.canPurchase(table.hydrated, 'NYC', { kind: 'train', trainId })
        ).toBe(false)
    })
    it('ends immediately when bankruptcy leaves one player, even if the receiver could buy a train', () => {
        const { table } = funding(40, 20)
        table.state.bankruptPlayerIds = ['p3']
        table.state.turnManager.turnOrder = ['p1', 'p2']
        table.state.stockRound.passedPlayerIds = table.state.stockRound.passedPlayerIds.filter(
            (id) => id !== 'p3'
        )
        table.state.gameEnding = { reason: 'Bank broken', finalOperatingSet: 2 }
        table.act('StartEmergencyFunding', { companyId: 'IC' })
        const result = declare(table)
        expect(table.state.machineState).toBe('GameOver')
        expect(table.state.result).toBe(GameResult.Win)
        expect(table.state.gameEnding).toEqual({ reason: 'All other players bankrupt' })
        expect(table.state.winningPlayerIds).toEqual(['p2'])
        expect(table.state.activePlayerIds).toEqual([])
        expect(result.processedActions.map((a) => a.type)).not.toContain('BuyReceiverTrain')
        expect(table.state.finalWealth).toHaveLength(3)
    })
    it('keeps 10% holders out of the presidency, then exchanges two shares on an ordinary stock purchase', () => {
        const table = receiverStock()
        table.buy('IC', 'bank')
        expect(inReceivership(table.state, 'IC')).toBe(true)
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: 'p2' })).toBe(1)
        table.finishTurn()
        const cash = finiteCashOwnedBy(table.state, { kind: 'player', playerId: 'p2' })
        const price = Market1846.companySpace(table.state.stockMarket, 'IC').price
        const result = table.buy('IC', 'bank')
        expect(getCompany(table.state, 'IC').president).toEqual({ kind: 'player', playerId: 'p2' })
        expect(result.processedActions[0].metadata).toMatchObject({
            presidencyClaim: { companyId: 'IC' }
        })
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId: 'p2' })).toBe(
            cash - price
        )
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: 'p2' })).toBe(2)
    })
    it('allows presidency recovery at the certificate limit when the exchange leaves the count unchanged', () => {
        const table = receiverStock()
        giveShares(table, 'IC', 'p2', 1)
        const owner = { kind: 'player' as const, playerId: 'p2' }
        const limit = StockRules1846.certificateLimit(table.hydrated, owner)
        for (const companyId of ['NYC', 'B&O']) {
            const needed = limit - stockCertificateCount(table.hydrated, owner, StockRules1846)
            giveShares(table, companyId, 'p2', Math.min(6, needed))
        }
        expect(stockCertificateCount(table.hydrated, owner, StockRules1846)).toBe(limit)
        table.buy('IC', 'bank')
        expect(getCompany(table.state, 'IC').president).toEqual(owner)
        expect(stockCertificateCount(table.hydrated, owner, StockRules1846)).toBe(limit)
    })
    it('permits buying half the market president certificate only with a 10% exchange', () => {
        const table = receiverStock()
        for (const certificate of table.state.certificates) {
            if (
                certificate.kind !== 'share' ||
                certificate.president ||
                certificate.companyId !== 'IC'
            )
                continue
            certificate.owner = treasury
            delete certificate.poolId
        }
        expect(receiverShareChoices(table.hydrated, 'p2')).toEqual([])
        giveShares(table, 'IC', 'p2', 1)
        const choice = receiverShareChoices(table.hydrated, 'p2')[0]
        assertExists(choice)
        const before = structuredClone(table.state)
        const result = table.act('BuyReceiverShare', {
            companyId: 'IC',
            expectedPrice: choice.price
        })
        expect(getCompany(table.state, 'IC').president).toEqual({ kind: 'player', playerId: 'p2' })
        expect(sharesOwned(table.state, 'IC', { kind: 'player', playerId: 'p2' })).toBe(2)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(1)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'BuyReceiverShare',
            'FinishStockTurn'
        ])
        expect(table.state.activePlayerIds).not.toContain('p2')
        let replay = structuredClone(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('disallows selling receiver stock and lets surviving players submit routes without a presidency', () => {
        const table = receiverStock()
        giveShares(table, 'IC', 'p2', 1)
        expect(
            evaluateShareSale(
                table.hydrated,
                {
                    playerId: 'p2',
                    seller: { kind: 'player', playerId: 'p2' },
                    sales: [{ companyId: 'IC', shares: 1 }]
                },
                StockRules1846
            ).details
        ).toBeUndefined()
        table.state.routeStep = { companyId: 'IC' }
        table.state.activePlayerIds = ['p2', 'p3']
        expect(new RouteEvaluation(table.hydrated, RouteRules1846).canAct('p2', 'IC')).toBe(true)
        expect(new RouteEvaluation(table.hydrated, RouteRules1846).canAct('p3', 'IC')).toBe(true)
        table.state.routeStep.result = { companyId: 'IC', routes: [], revenue: 0 }
        setPrice(table, 60)
        const result = new EarningsDistribution(table.hydrated, EarningsRules1846).evaluate(
            'IC',
            'withhold'
        )
        expect(
            Market1846.spaces.find(
                (space) => space.id === result.details?.marketMove?.toMarketSpaceId
            )?.price
        ).toBe(40)
        expect(
            new EarningsDistribution(table.hydrated, EarningsRules1846).evaluate('IC', 'pay')
                .details
        ).toBeUndefined()
        table.state.trainPurchaseStep = { companyId: 'IC', purchasedTrainIds: [] }
        setCash(table, treasury, 1000)
        expect(receiverTrainPurchase(table.hydrated)?.definitionId).toBe('2')
    })
})
