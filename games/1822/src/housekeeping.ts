import {
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    homeStationId,
    markTurn,
    nextOperatingCompany,
    settleCashPayments,
    stepAction,
    titleAction,
    trainsCountingForLimit,
    type StepAction
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import * as Type from 'typebox'
import {
    LondonLocationId,
    MetropolitanHomeCost1822,
    MetropolitanId,
    londonHomeCompanyIds1822,
    major1822
} from './companies.js'
import { setupOf1822 } from './scenarios.js'
import { stationsAt1822 } from './tokens.js'
import { TrainRules1822 } from './operating.js'
import type { HydratedState1822 } from './state.js'
import { trackCompany1822 } from './turn.js'
import { LocalTrainId, TrainDepot1822 } from './trains.js'

/** The operating turn's mark that a minor bought its first-turn L train (§5.6.5). */
const FirstTrainMark = 'first-train'

/** The Metropolitan Railway on its first turn, its home station still to be placed (§5.6.7). */
export function metropolitanHomeDue1822(state: HydratedState1822): boolean {
    return (
        nextOperatingCompany(state) === MetropolitanId &&
        state.stations.some(
            (station) =>
                station.id === homeStationId(MetropolitanId) && station.status === 'available'
        )
    )
}

/**
 * The L train a minor company may buy as its first operating turn begins, from the bank or the
 * bank pool, so that it can run it that turn (§3.3.7, §5.6.5).
 */
export function firstTrainOffer1822(
    state: HydratedState1822,
    playerId: string
): { companyId: string; trainId: string; price: number } | undefined {
    const companyId = trackCompany1822(state, playerId)
    if (
        !companyId ||
        getCompany(state, companyId).kind !== 'minor' ||
        !state.debutCompanyIds.includes(companyId) ||
        hasTurnMark(state, FirstTrainMark) ||
        state.trackStep?.lays.length ||
        metropolitanHomeDue1822(state)
    )
        return undefined
    const pooled = state.trainInventory.trains.find(
        (train) => train.status === 'market' && train.definitionId === LocalTrainId
    )
    const train =
        pooled ??
        (TrainRules1822.availableDefinitions(state).includes(LocalTrainId)
            ? TrainDepot1822.nextTrain(state.trainInventory, LocalTrainId)
            : undefined)
    // A scenario takes £10 off this train (§6.2.1; scenario pack, Train Mix sheet).
    const price =
        TrainDepot1822.trainDefinition(LocalTrainId).price - setupOf1822(state).firstTrainDiscount
    if (
        !train ||
        finiteCashOwnedBy(state, { kind: 'company', companyId }) < price ||
        trainsCountingForLimit(state, TrainRules1822, companyId).length >=
            TrainRules1822.trainLimit(state, companyId)
    )
        return undefined
    return { companyId, trainId: train.id, price }
}

const BuyLocalTrainAction = titleAction('BuyLocalTrain', {
    companyId: Type.String({ minLength: 1 }),
    trainId: Type.String({ minLength: 1 }),
    expectedPrice: Type.Integer({ minimum: 0 })
})
export const BuyLocalTrain = BuyLocalTrainAction.schema
export type BuyLocalTrain = Type.Static<typeof BuyLocalTrain>
export const isBuyLocalTrain = BuyLocalTrainAction.is

/** A minor company buys an L train as its first operating turn begins (§5.6.5). */
export class HydratedBuyLocalTrain extends BuyLocalTrainAction.Base {
    declare playerId: string
    declare companyId: BuyLocalTrain['companyId']
    declare trainId: BuyLocalTrain['trainId']
    declare expectedPrice: BuyLocalTrain['expectedPrice']
    isValid(state: HydratedState1822): boolean {
        const offer = firstTrainOffer1822(state, this.playerId)
        return (
            this.source === ActionSource.User &&
            offer?.companyId === this.companyId &&
            offer.trainId === this.trainId &&
            offer.price === this.expectedPrice
        )
    }
    apply(state: HydratedState1822): void {
        assert(this.isValid(state), 'A minor buys an L train as its first turn begins')
        const owner = { kind: 'company' as const, companyId: this.companyId }
        settleCashPayments(state, [
            { from: owner, to: { kind: 'bank' }, amount: this.expectedPrice }
        ])
        TrainDepot1822.purchase(state.trainInventory, this.trainId, LocalTrainId, owner)
        markTurn(state, FirstTrainMark)
    }
}

const PlaceMetropolitanHomeAction = titleAction('PlaceMetropolitanHome', {
    companyId: Type.Literal(MetropolitanId),
    nodeId: Type.Union([
        Type.Literal('s'),
        Type.Literal('sw'),
        Type.Literal('nw'),
        Type.Literal('n'),
        Type.Literal('ne'),
        Type.Literal('se')
    ]),
    metadata: Type.Optional(
        Type.Object(
            { slot: Type.Integer({ minimum: 0 }), cost: Type.Integer({ minimum: 0 }) },
            { additionalProperties: false }
        )
    )
})
export const PlaceMetropolitanHome = PlaceMetropolitanHomeAction.schema
export type PlaceMetropolitanHome = Type.Static<typeof PlaceMetropolitanHome>
export const isPlaceMetropolitanHome = PlaceMetropolitanHomeAction.is

/**
 * The space of the London roundel beside each London station, which only the Metropolitan
 * Railway or the major company that acquires it takes: the space after the station's own
 * (§5.10.3, §5.10.4).
 */
export const RoundelSlot1822 = 1
/** A London station's own space, which its home company's token takes (§5.10.2). */
const StationSlot1822 = 0

/**
 * The space the Metropolitan Railway's home takes at a London station: the roundel's, beside the
 * station; or, in the scenarios that say so, the station's own where the major company whose home
 * it was is not in the game (§5.10.3; scenario pack, General sheet).
 */
export function metropolitanHomeSlot1822(
    state: Pick<HydratedState1822, 'variants' | 'removedCompanyIds' | 'stations'>,
    nodeId: string
): number {
    const vacated =
        setupOf1822(state).metropolitanTakesLondonHome &&
        londonHomeCompanyIds1822(nodeId).some(
            (companyId) => major1822(companyId) && state.removedCompanyIds?.includes(companyId)
        ) &&
        !stationsAt1822(state, { locationId: LondonLocationId, nodeId }).some(
            (station) => station.position.slot === StationSlot1822
        )
    return vacated ? StationSlot1822 : RoundelSlot1822
}

/**
 * The Metropolitan Railway places its home on the London roundel, beside the London station it
 * chooses, for £20; this is its track lay for the turn (§5.6.7, §5.10.3).
 */
export class HydratedPlaceMetropolitanHome extends PlaceMetropolitanHomeAction.Base {
    declare playerId: string
    declare companyId: PlaceMetropolitanHome['companyId']
    declare nodeId: PlaceMetropolitanHome['nodeId']
    declare metadata?: PlaceMetropolitanHome['metadata']
    isValid(state: HydratedState1822): boolean {
        return (
            this.source === ActionSource.User &&
            trackCompany1822(state, this.playerId) === MetropolitanId &&
            metropolitanHomeDue1822(state) &&
            finiteCashOwnedBy(state, { kind: 'company', companyId: MetropolitanId }) >=
                MetropolitanHomeCost1822
        )
    }
    apply(state: HydratedState1822): void {
        assert(
            this.isValid(state),
            'The Metropolitan Railway places its home as its first turn begins'
        )
        const station = state.stations.find((entry) => entry.id === homeStationId(MetropolitanId))
        assertExists(station, 'The Metropolitan Railway has its home token')
        const slot = metropolitanHomeSlot1822(state, this.nodeId)
        settleCashPayments(state, [
            {
                from: { kind: 'company', companyId: MetropolitanId },
                to: { kind: 'bank' },
                amount: MetropolitanHomeCost1822
            }
        ])
        state.stations = state.stations.map((entry) =>
            entry.id === station.id
                ? {
                      id: entry.id,
                      companyId: MetropolitanId,
                      status: 'placed' as const,
                      position: { locationId: LondonLocationId, nodeId: this.nodeId, slot }
                  }
                : entry
        )
        this.metadata = { slot, cost: MetropolitanHomeCost1822 }
    }
}

export const HousekeepingSteps: readonly StepAction<HydratedState1822>[] = [
    stepAction(
        BuyLocalTrainAction.type,
        (action: HydratedAction): action is HydratedBuyLocalTrain =>
            action instanceof HydratedBuyLocalTrain,
        (state, playerId) => !!firstTrainOffer1822(state, playerId)
    ),
    stepAction(
        PlaceMetropolitanHomeAction.type,
        (action: HydratedAction): action is HydratedPlaceMetropolitanHome =>
            action instanceof HydratedPlaceMetropolitanHome,
        (state, playerId) =>
            trackCompany1822(state, playerId) === MetropolitanId && metropolitanHomeDue1822(state)
    )
]

export const HousekeepingActions = [
    BuyLocalTrainAction.define((action) => new HydratedBuyLocalTrain(action)),
    PlaceMetropolitanHomeAction.define((action) => new HydratedPlaceMetropolitanHome(action))
]
