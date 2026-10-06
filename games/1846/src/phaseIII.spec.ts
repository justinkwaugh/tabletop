import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import {
    controllingOwner,
    getCompany,
    finiteCashOwnedBy,
    privateOwner,
    trainsOwnedBy,
    trainsCountingForLimit,
    discardableTrains,
    TrainPurchase,
    StationPlacement,
    payingRouteStops,
    type TrainDefinition,
    type RouteRevenueStop
} from '@tabletop/18xx'
import {
    start,
    emergencyBuyingGame,
    phaseIIIReadyGame,
    buyTrain,
    discardTrain,
    setCompanyInReceivership
} from './testSupport.js'
import { TrainDepot1846, TrainRules1846, trainBuyingChoices1846 } from './trains.js'
import { StationRules1846 } from './stations.js'
import { RouteRules1846 } from './routes.js'
import { emergencyBankOffers, emergencyTrainChoices } from './emergencyTrain.js'
import { receiverTrainPurchase } from './receiverOperations.js'
import { isAdvancePhase1846 } from './phases.js'

describe('1846 Phase III trains and lifecycle', () => {
    it.each([3, 4, 5])('supplies %i Phase III certificates', (count) => {
        const { state } = start(count)
        expect(TrainDepot1846.remaining(state.trainInventory, '5')).toBe(count)
        expect(TrainDepot1846.remaining(state.trainInventory, '4/6')).toBe(count)
    })
    it.each([
        ['5', 500],
        ['4/6', 450]
    ] as const)(
        'introduces %s, closes companies, interrupts for discards and resumes the buyer',
        (definitionId, price) => {
            const table = phaseIIIReadyGame()
            const buyer = table.state.activePlayerIds[0]
            const decider = controllingOwner(table.state, 'NYC')?.playerId
            expect(buyer).not.toBe(decider)
            table.state.steamboat = { companyId: 'IC', locationId: 'D6' }
            const mail = table.state.certificates.find(
                (certificate) => certificate.companyId === 'MAIL' && !certificate.retired
            )
            assertExists(mail)
            mail.owner = { kind: 'company', companyId: 'IC' }
            table.state.revenueMarkers = [
                {
                    privateCompanyId: 'MPC',
                    companyId: 'IC',
                    locationId: 'D6',
                    setNumber: 1,
                    roundNumber: 1
                }
            ]
            expect(privateOwner(table.state, 'C&WI')?.kind).toBe('player')
            expect(
                new StationPlacement(table.hydrated, StationRules1846).openSlots(
                    'B&O',
                    'D6',
                    'city-3'
                )
            ).toEqual([])
            const before = structuredClone(table.state)
            const result = buyTrain(table, definitionId)
            expect(result.processedActions.map((action) => action.type)).toEqual([
                'BuyTrain',
                'AdvancePhase'
            ])
            expect(
                new StationPlacement(table.hydrated, StationRules1846).openSlots(
                    'B&O',
                    'D6',
                    'city-3'
                )
            ).toEqual([0])
            expect(table.state.stationReservations).toEqual(
                before.stationReservations.filter((reservation) => reservation.companyId !== 'C&WI')
            )
            const phase = result.processedActions.find(isAdvancePhase1846)
            expect(phase?.metadata?.removedReservations).toEqual([
                { companyId: 'C&WI', locationId: 'D6', nodeId: 'city-3' }
            ])
            expect(phase?.metadata?.closedRailroads.map((closure) => closure.companyId)).toEqual([
                'MS',
                'BIG4'
            ])
            expect(phase?.metadata?.event.pendingRustTrainIds).toHaveLength(3)
            expect(phase?.metadata?.event.rustedTrainIds).toHaveLength(2)
            expect(getCompany(table.state, 'MAIL').closed).not.toBe(true)
            expect(
                table.state.companies
                    .filter((company) => company.kind === 'private' && !company.closed)
                    .map((company) => company.id)
            ).toEqual(['MAIL'])
            expect(table.state.steamboat).toBeUndefined()
            expect(table.state.revenueMarkers).toEqual(before.revenueMarkers)
            expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toBe(
                2000 - price
            )
            for (const companyId of ['MS', 'BIG4']) {
                expect(getCompany(table.state, companyId).closed).toBe(true)
                expect(trainsOwnedBy(table.state, { kind: 'company', companyId })).toEqual([])
                expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId })).toBe(0)
            }
            expect(table.state.phaseId).toBe('III')
            expect(table.state.machineState).toBe('DiscardingTrains')
            expect(table.state.activePlayerIds).toEqual([decider])
            expect(trainsCountingForLimit(table.hydrated, TrainRules1846, 'IC')).toHaveLength(1)
            const trainId = discardableTrains(table.hydrated, 'NYC', TrainRules1846)[0].id
            expect(() =>
                table.act('DiscardTrain', { companyId: 'NYC', trainId, playerId: buyer })
            ).toThrow()
            expect(() =>
                table.act('DiscardTrain', {
                    companyId: 'NYC',
                    trainId,
                    source: ActionSource.System
                })
            ).toThrow()
            const { result: discarded } = discardTrain(table)
            expect(table.state.machineState).toBe('BuyingTrains')
            expect(table.state.activePlayerIds).toEqual([buyer])
            expect(table.state.trainPurchaseStep?.companyId).toBe('IC')
            expect(table.state.phaseChange).toBeUndefined()
            const actions = [...result.processedActions, ...discarded.processedActions]
            let replay = before
            for (const action of actions)
                replay = table.engine.applyProcessedAction({
                    game: table.game,
                    state: replay,
                    action
                })
            expect(replay).toEqual(table.state)
            for (const action of actions.toReversed())
                replay = table.engine.undoProcessedAction({ state: replay, action })
            expect(replay).toEqual(before)
            expect(
                new StationPlacement(replay, StationRules1846).openSlots('B&O', 'D6', 'city-3')
            ).toEqual([])
        }
    )
    it('closes player-held Mail and rejects a phase-triggering purchase at the old limit', () => {
        const table = phaseIIIReadyGame()
        expect(privateOwner(table.state, 'MAIL')?.kind).toBe('player')
        const extra = table.state.trainInventory.trains.find((train) => train.status === 'market')
        assertExists(extra)
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.id === extra.id
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId: 'IC' } }
                : train
        )
        expect(
            new TrainPurchase(table.hydrated, TrainRules1846)
                .offers()
                .filter((offer) => offer.evaluation.details)
        ).toEqual([])
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.id === extra.id
                ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                : train
        )
        buyTrain(table, '4/6')
        expect(getCompany(table.state, 'MAIL').closed).toBe(true)
    })
    it('resells either face of a returned train without regressing the phase or blocking new stock', () => {
        const table = phaseIIIReadyGame()
        buyTrain(table, '5')
        const { train } = discardTrain(table)
        const offers = trainBuyingChoices1846(table.hydrated)?.offers.filter(
            (offer) => offer.trainId === train.id
        )
        expect(offers?.map((offer) => [offer.definitionId, offer.price])).toEqual([
            ['4', 180],
            ['3/5', 160]
        ])
        expect(TrainRules1846.availableDefinitions(table.hydrated)).toEqual(['5', '4/6'])
        buyTrain(table, '3/5', train.id)
        expect(table.state.phaseId).toBe('III')
        expect(table.state.phaseEvents).toHaveLength(1)
        expect(
            table.state.trainInventory.trains.find((entry) => entry.id === train.id)
        ).toMatchObject({ status: 'owned', definitionId: '3/5' })
        buyTrain(table, '4/6')
        expect(trainsCountingForLimit(table.hydrated, TrainRules1846, 'IC')).toHaveLength(3)
        expect(trainBuyingChoices1846(table.hydrated)?.offers).toEqual([])
    })
    it('lets surviving players discard for a receiver and restores the original buyer', () => {
        const table = phaseIIIReadyGame()
        setCompanyInReceivership(table, 'NYC')
        const buyer = table.state.activePlayerIds[0]
        buyTrain(table, '4/6')
        expect(table.state.activePlayerIds).toEqual(table.state.turnManager.turnOrder)
        discardTrain(table)
        expect(table.state.activePlayerIds).toEqual([buyer])
        expect(table.state.machineState).toBe('BuyingTrains')
    })
    it('uses the cheapest returned face for emergency and receiver purchases', () => {
        const table = emergencyBuyingGame(100, 20)
        table.state.phaseId = 'III'
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status !== 'depot'
                ? train
                : train.definitionId === '2'
                  ? { ...train, status: 'removed' }
                  : train.definitionId === '4'
                    ? { ...train, status: 'market' }
                    : train
        )
        expect(Math.min(...emergencyBankOffers(table.hydrated).map((offer) => offer.price))).toBe(
            160
        )
        const choice = emergencyTrainChoices(table.hydrated).find(
            (offer) => offer.definitionId === '3/5'
        )
        assertExists(choice)
        expect(choice.contribution).toBe(60)
        const beforePurchase = structuredClone(table.state)
        table.act('EmergencyBuyTrain', choice)
        expect(
            table.state.trainInventory.trains.find((train) => train.id === choice.trainId)
        ).toMatchObject({ status: 'owned', definitionId: '3/5' })
        expect(table.state.phaseId).toBe('III')
        Object.assign(table.state, beforePurchase)
        setCompanyInReceivership(table, 'IC')
        const cash = table.state.cash.find(
            (balance) => balance.owner.kind === 'company' && balance.owner.companyId === 'IC'
        )
        assertExists(cash)
        cash.amount = 160
        expect(receiverTrainPurchase(table.hydrated)).toMatchObject({
            definitionId: '3/5',
            price: 160
        })
    })
    it('retires phased-out trains after an unused final route step and records the removal', () => {
        const table = emergencyBuyingGame(500)
        table.state.phaseId = 'III'
        const train = table.state.trainInventory.trains.find(
            (entry) => entry.status === 'depot' && entry.definitionId === '2'
        )
        assertExists(train)
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((entry) =>
            entry.id === train.id
                ? {
                      ...entry,
                      status: 'owned',
                      owner: { kind: 'company', companyId: 'IC' },
                      rustsAfterOperation: true
                  }
                : entry
        )
        table.state.machineState = 'RunningTrains'
        table.state.routeStep = { companyId: 'IC' }
        delete table.state.trainPurchaseStep
        const before = structuredClone(table.state)
        const result = table.act('RunTrains', { companyId: 'IC', routes: [] })
        expect(result.processedActions.map((action) => action.type)).toContain('RustTrains')
        expect(
            result.processedActions.find((action) => action.type === 'RustTrains')?.metadata
        ).toMatchObject({ trainIds: [train.id] })
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })).toEqual([])
        expect(['DistributingEarnings', 'BuyingTrains']).toContain(table.state.machineState)
        let replay = before
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('chooses four paying stops for a 4/6, including a station and East–West bonuses', () => {
        const stops: RouteRevenueStop[] = [10, 30, 40, 50, 60, 70].map((amount, i) => ({
            locationId: String(i),
            nodeId: 'city',
            amount,
            bonus: 0,
            companyStation: i === 0
        }))
        const choose = (train: TrainDefinition, visits: readonly RouteRevenueStop[]) =>
            payingRouteStops(visits, RouteRules1846.revenuePolicy?.(train) ?? {})
        expect(
            choose(TrainDepot1846.trainDefinition('4/6'), stops).map((stop) => stop.locationId)
        ).toEqual(['0', '3', '4', '5'])
        expect(choose(TrainDepot1846.trainDefinition('5'), stops)).toEqual(stops)
        stops[1].locationId = 'C5'
        stops[2].locationId = 'D22'
        expect(
            choose(TrainDepot1846.trainDefinition('4/6'), stops).map((stop) => stop.locationId)
        ).toEqual(['0', 'C5', 'D22', '5'])
    })
})
