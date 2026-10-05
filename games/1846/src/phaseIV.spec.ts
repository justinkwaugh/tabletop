import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    isRustTrains,
    StationPlacement,
    TrainPurchase,
    controllingOwner,
    getCompany,
    trainsOwnedBy,
    trainsCountingForLimit,
    discardableTrains,
    trainCanBeTraded,
    type RouteRevenueStop
} from '@tabletop/18xx'
import {
    phaseIIIReadyGame,
    buyTrain,
    discardTrain,
    start,
    setCompanyInReceivership
} from './testSupport.js'
import { TrainDepot1846, TrainRules1846, trainBuyingChoices1846 } from './trains.js'
import { isAdvancePhase1846 } from './phases.js'
import { AdditionalReservations } from './map.js'
import { StationRules1846 } from './stations.js'
import { RouteRules1846 } from './routes.js'
import { emergencyTrainChoices } from './emergencyTrain.js'
import { receiverTrainPurchase } from './receiverOperations.js'

function phaseIVReady() {
    const table = phaseIIIReadyGame()
    const mail = table.state.certificates.find(
        (certificate) => certificate.companyId === 'MAIL' && !certificate.retired
    )
    assert(mail && !mail.retired)
    mail.owner = { kind: 'company', companyId: 'IC' }
    buyTrain(table, '5')
    discardTrain(table)
    let secondTier = 0
    table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) => {
        if (train.status === 'removed') return train
        if (train.definitionId === '5')
            return { ...train, status: 'owned', owner: { kind: 'company', companyId: 'NYC' } }
        if (train.definitionId === '4') {
            secondTier++
            return secondTier <= 2
                ? {
                      ...train,
                      definitionId: secondTier === 1 ? '4' : '3/5',
                      status: 'owned',
                      owner: { kind: 'company', companyId: 'IC' }
                  }
                : { id: train.id, definitionId: secondTier === 3 ? '3/5' : '4', status: 'market' }
        }
        return train
    })
    table.state.trainPurchaseStep = { companyId: 'IC', purchasedTrainIds: [] }
    table.state.revenueMarkers = [
        { privateCompanyId: 'SC', companyId: 'IC', locationId: 'B8', setNumber: 1, roundNumber: 1 },
        {
            privateCompanyId: 'MPC',
            companyId: 'IC',
            locationId: 'D6',
            setNumber: 1,
            roundNumber: 1
        },
        { privateCompanyId: 'BT', companyId: 'IC', locationId: 'H12', setNumber: 1, roundNumber: 1 }
    ]
    return table
}

describe('1846 Phase IV trains and lifecycle', () => {
    it.each([3, 4, 5])('provides unlimited final certificates with %i players', (count) => {
        const { state } = start(count)
        expect(TrainDepot1846.remaining(state.trainInventory, '6')).toBe('unlimited')
        expect(TrainDepot1846.remaining(state.trainInventory, '7/8')).toBe('unlimited')
        expect(TrainRules1846.availableDefinitions(state)).toEqual(['2'])
    })
    it.each([
        ['6', 800],
        ['7/8', 900]
    ] as const)(
        'buys %s, applies the final phase, discards and replays/undoes',
        (definitionId, price) => {
            const table = phaseIVReady()
            const before = structuredClone(table.state)
            const buyer = table.state.activePlayerIds[0]
            const decider = controllingOwner(table.state, 'NYC')?.playerId
            const offers = trainBuyingChoices1846(table.hydrated)?.offers
            expect(offers?.find((offer) => offer.definitionId === definitionId)?.price).toBe(price)
            const result = buyTrain(table, definitionId)
            expect(table.state.phaseId).toBe('IV')
            expect(TrainRules1846.trainLimit(table.hydrated, 'IC')).toBe(2)
            expect(trainsCountingForLimit(table.hydrated, TrainRules1846, 'IC')).toHaveLength(1)
            const phase = result.processedActions.find(isAdvancePhase1846)?.metadata
            assertExists(phase)
            expect(phase.event.rustedTrainIds).toHaveLength(5)
            expect(phase.event.pendingRustTrainIds).toHaveLength(2)
            expect(phase.removedRevenueMarkers).toEqual(before.revenueMarkers)
            expect(table.state.revenueMarkers).toEqual([])
            expect(getCompany(table.state, 'MAIL').closed).not.toBe(true)
            const special = (reservation: (typeof before.stationReservations)[number]) =>
                AdditionalReservations.some(
                    (additional) =>
                        additional.companyId === reservation.companyId &&
                        additional.locationId === reservation.locationId
                )
            expect(phase.removedReservations).toEqual(before.stationReservations.filter(special))
            expect(table.state.stationReservations).toEqual(
                before.stationReservations.filter((r) => !special(r))
            )
            expect(
                table.state.stationReservations.some(
                    (r) => r.companyId === 'B&O' && r.locationId === 'G19'
                )
            ).toBe(true)
            for (const train of trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' }))
                if (train.status === 'owned' && ['4', '3/5'].includes(train.definitionId)) {
                    expect(train.rustsAfterOperation).toBe(true)
                    expect(trainCanBeTraded(train)).toBe(false)
                }
            expect(discardableTrains(table.hydrated, 'IC', TrainRules1846)).toEqual([])
            expect(table.state.machineState).toBe('DiscardingTrains')
            expect(table.state.activePlayerIds).toEqual([decider])
            const { result: discarded } = discardTrain(table)
            expect(table.state.machineState).toBe('BuyingTrains')
            expect(table.state.activePlayerIds).toEqual([buyer])
            expect(table.state.trainPurchaseStep?.companyId).toBe('IC')
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
        }
    )
    it('keeps final supply available with unique IDs and resells old permanent faces without regressing phase', () => {
        const table = phaseIVReady()
        buyTrain(table, '7/8')
        const { train } = discardTrain(table)
        expect(TrainRules1846.availableDefinitions(table.hydrated)).toEqual(['6', '7/8'])
        expect(
            trainBuyingChoices1846(table.hydrated)
                ?.offers.filter((o) => o.trainId === train.id)
                .map((o) => [o.definitionId, o.price])
        ).toEqual([
            ['5', 500],
            ['4/6', 450]
        ])
        buyTrain(table, '4/6', train.id)
        expect(table.state.phaseId).toBe('IV')
        expect(table.state.phaseEvents).toHaveLength(2)
        expect(trainBuyingChoices1846(table.hydrated)?.offers).toEqual([])
        const inventory = TrainDepot1846.createInventory()
        const first = TrainDepot1846.nextTrain(inventory, '6')
        assertExists(first)
        TrainDepot1846.purchase(inventory, first.id, '6', { kind: 'company', companyId: 'IC' })
        const second = TrainDepot1846.nextTrain(inventory, '7/8')
        assertExists(second)
        TrainDepot1846.purchase(inventory, second.id, '7/8', { kind: 'company', companyId: 'NYC' })
        expect(first.id).not.toBe(second.id)
        expect(TrainDepot1846.remaining(inventory, '6')).toBe('unlimited')
        TrainDepot1846.validateInventory(inventory, ['IC', 'NYC'], [])
    })
    it('enforces the old train limit before a purchase which would phase trains out', () => {
        const table = phaseIVReady()
        const train = table.state.trainInventory.trains.find((t) => t.status === 'market')
        assertExists(train)
        table.state.trainInventory.trains[table.state.trainInventory.trains.indexOf(train)] = {
            ...train,
            status: 'owned',
            owner: { kind: 'company', companyId: 'IC' }
        }
        expect(trainsCountingForLimit(table.hydrated, TrainRules1846, 'IC')).toHaveLength(3)
        expect(
            new TrainPurchase(table.hydrated, TrainRules1846)
                .offers()
                .every((o) => !o.evaluation.details)
        ).toBe(true)
    })
    it.each([false, true])(
        'retires both Phase II faces after an empty final run, receiver: %s',
        (receiver) => {
            const table = phaseIVReady()
            buyTrain(table, '6')
            discardTrain(table)
            if (receiver) {
                setCompanyInReceivership(table, 'IC')
            }
            table.state.machineState = receiver ? 'RunningReceiver' : 'RunningTrains'
            table.state.routeStep = { companyId: 'IC' }
            delete table.state.trainPurchaseStep
            delete table.state.earningsDistribution
            const old = trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
                .filter((t) => t.status === 'owned' && t.rustsAfterOperation)
                .map((t) => t.id)
            const result = table.act('RunTrains', { companyId: 'IC', routes: [] })
            expect(result.processedActions.find(isRustTrains)?.metadata).toMatchObject({
                trainIds: old
            })
            expect(
                trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' }).map(
                    (t) => t.definitionId
                )
            ).toEqual(['6'])
        }
    )
    it('releases special reservations while retaining remote placement and discounted prices', () => {
        const table = phaseIVReady()
        expect(
            new StationPlacement(table.hydrated, StationRules1846).openSlots('NYC', 'H12', 'city')
        ).toEqual([])
        buyTrain(table, '6')
        discardTrain(table)
        expect(
            new StationPlacement(table.hydrated, StationRules1846).openSlots('NYC', 'H12', 'city')
        ).toEqual([0])
        expect(
            new StationPlacement(table.hydrated, StationRules1846).openSlots('NYC', 'G19', 'city')
        ).toEqual([])
        for (const [companyId, locationId, remoteCost] of [
            ['B&O', 'H12', 100],
            ['PRR', 'E11', 60]
        ] as const) {
            const position = { locationId, nodeId: 'city', slot: 0 }
            expect(
                StationRules1846.allowsDisconnected?.(table.hydrated, {
                    companyId,
                    stationId: 'unused',
                    position
                })
            ).toBe(true)
            expect(
                StationRules1846.placementCost(table.hydrated, 'unused', {
                    companyId,
                    stationId: 'unused',
                    position,
                    connected: false
                })
            ).toBe(remoteCost)
            expect(
                StationRules1846.placementCost(table.hydrated, 'unused', {
                    companyId,
                    stationId: 'unused',
                    position,
                    connected: true
                })
            ).toBe(40)
        }
    })
    it('supports an emergency final train purchase and the receiver’s cheapest final train', () => {
        const table = phaseIVReady()
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === 'IC'
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status === 'market' ? { ...train, status: 'removed' } : train
        )
        const cash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
        )
        assertExists(cash)
        cash.amount = 750
        const plan = emergencyTrainChoices(table.hydrated).find((p) => p.definitionId === '6')
        assertExists(plan)
        expect(plan.price).toBe(800)
        table.act('EmergencyBuyTrain', plan)
        expect(table.state.phaseId).toBe('IV')
        discardTrain(table)
        const owned = trainsOwnedBy(table.state, { kind: 'company', companyId: 'IC' })
        expect(owned.map((t) => t.definitionId)).toEqual(['6'])
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            owned.some((t) => t.id === train.id)
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        setCompanyInReceivership(table, 'IC')
        const receiverCash = table.state.cash.find(
            (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
        )
        assertExists(receiverCash)
        receiverCash.amount = 900
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status === 'market' ? { ...train, status: 'removed' } : train
        )
        expect(receiverTrainPurchase(table.hydrated)).toMatchObject({
            definitionId: '6',
            price: 800
        })
    })
    it('resumes a receiver after its final-train purchase interrupts for another company’s discard', () => {
        const table = phaseIVReady()
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status === 'market' ||
            (train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'IC')
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        setCompanyInReceivership(table, 'IC')
        table.state.machineState = 'BuyingReceiverTrain'
        const before = structuredClone(table.state)
        const result = table.act('BuyReceiverTrain', {
            companyId: 'IC',
            source: ActionSource.System
        })
        expect(table.state.phaseId).toBe('IV')
        expect(table.state.phaseChange?.continuation.machineState).toBe('FinishingReceiverTurn')
        const { result: discarded } = discardTrain(table)
        expect(discarded.processedActions.map((action) => action.type)).toContain(
            'FinishReceiverTurn'
        )
        expect(table.state.machineState).toBe('CorporateFinance')
        const actions = [...result.processedActions, ...discarded.processedActions]
        let replay = before
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
    })
    it('counts seven stops for 7/8 while retaining a station and East–West bonus', () => {
        const stops: RouteRevenueStop[] = [0, 10, 20, 30, 40, 50, 60, 70].map((amount, i) => ({
            locationId: `hex${i}`,
            nodeId: 'city',
            amount,
            bonus: 0,
            companyStation: i === 0
        }))
        stops[1].locationId = 'C5'
        stops[2].locationId = 'C17'
        const paying = RouteRules1846.payingStops?.(TrainDepot1846.trainDefinition('7/8'), stops)
        assertExists(paying)
        expect(paying).toHaveLength(7)
        expect(paying).toContain(stops[0])
        expect(paying).toContain(stops[1])
        expect(paying).toContain(stops[2])
        expect(paying).not.toContain(stops[3])
        expect(RouteRules1846.routeBonuses?.(paying)).toEqual([
            { locationId: 'C17', amount: 30 },
            { locationId: 'C5', amount: 50 }
        ])
    })
})
