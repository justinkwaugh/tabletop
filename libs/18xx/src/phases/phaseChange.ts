import type { MapStateData } from '../map/mapState.js'
import { PrivateEffect } from '../privates/privateRules.js'
import type { StockState } from '../stock/stockState.js'
import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { controllingOwner, getCompany } from '../finance/finance.js'
import { stockMarketOrder } from '../stock/stockMarket.js'
import {
    trainsOwnedBy,
    unownedTrain,
    type Train,
    type TrainState,
    type TrainPurchaseState
} from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
const Id = Type.String({ minLength: 1 })
export const PhaseOccurrence = Type.Object(
    { id: Id, trainId: Id, definitionId: Id, fromPhaseId: Id, toPhaseId: Id },
    { additionalProperties: false }
)
export type PhaseOccurrence = Type.Static<typeof PhaseOccurrence>
export const PhaseEvent = Type.Object(
    {
        ...PhaseOccurrence.properties,
        privateEffects: Type.Array(PrivateEffect),
        rustedTrainIds: Type.Array(Id),
        pendingRustTrainIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type PhaseEvent = Type.Static<typeof PhaseEvent>
/** Where play resumes after a phase change: the operating company's step, or between rounds. */
export const OperatingContinuation = Type.Object(
    { machineState: Id, companyId: Type.Optional(Id) },
    { additionalProperties: false }
)
export type OperatingContinuation = Type.Static<typeof OperatingContinuation>
export const PhaseChange = Type.Object(
    {
        event: PhaseOccurrence,
        continuation: OperatingContinuation,
        discardCompanyIds: Type.Array(Id, { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type PhaseChange = Type.Static<typeof PhaseChange>
export const PhaseFields = {
    phaseEvents: Type.Array(PhaseEvent),
    phaseChange: Type.Optional(PhaseChange)
}
export type PhaseState = Type.Static<Type.TObject<typeof PhaseFields>> & { phaseId: string }
export type PhaseChangeState = StockState & TrainState & PhaseState & MapStateData
export interface PhaseRules {
    rustTiming(state: TrainPurchaseState, train: Train): 'immediate' | 'after-operation' | undefined
    /** Companies in discard order, starting from the operating company when there is one. */
    discardOrder(state: PhaseChangeState, companyId: string | undefined): string[]
    discardDestination: 'market' | 'removed'
}
/** The operating company first, then the open companies in market order and any listed after. */
export function marketDiscardOrder(
    state: PhaseChangeState,
    companyId: string | undefined,
    after: readonly string[] = []
): string[] {
    return [
        ...new Set([
            ...(companyId ? [companyId] : []),
            ...stockMarketOrder(state.stockMarket),
            ...after
        ])
    ].filter((id) => !getCompany(state, id).closed)
}
export function preparePhaseChange(
    state: PhaseState,
    trainId: string,
    definitionId: string,
    toPhaseId: string,
    continuation: OperatingContinuation
): void {
    assert(!state.phaseChange, 'Another phase change is unresolved')
    if (toPhaseId === state.phaseId) return
    state.phaseChange = {
        event: {
            id: `phase:${trainId}`,
            trainId,
            definitionId,
            fromPhaseId: state.phaseId,
            toPhaseId
        },
        continuation: { ...continuation },
        discardCompanyIds: []
    }
}
export function advancePhase(
    state: PhaseChangeState,
    rules: PhaseRules,
    trainRules: TrainRules
): PhaseEvent {
    const change = state.phaseChange
    assertExists(change, 'No pending phase change')
    assert(
        state.phaseId === change.event.fromPhaseId &&
            !state.phaseEvents.some((event) => event.id === change.event.id),
        'This phase occurrence was already applied'
    )
    state.phaseId = change.event.toPhaseId
    const event: PhaseEvent = {
        ...change.event,
        privateEffects: [],
        rustedTrainIds: [],
        pendingRustTrainIds: []
    }
    state.trainInventory.trains = state.trainInventory.trains.map((train) => {
        if (train.status === 'removed') return train
        const rustTiming = rules.rustTiming(state, train)
        if (rustTiming === 'after-operation' && train.status === 'owned') {
            event.pendingRustTrainIds.push(train.id)
            return { ...train, rustsAfterOperation: true }
        }
        if (rustTiming) {
            event.rustedTrainIds.push(train.id)
            return unownedTrain(train, 'removed')
        }
        return train
    })
    state.phaseEvents.push(event)
    change.discardCompanyIds = rules
        .discardOrder(state, change.continuation.companyId)
        .filter(
            (companyId) =>
                trainsOwnedBy(state, { kind: 'company', companyId }).length >
                trainRules.trainLimit(state, companyId)
        )
    return event
}
export function continuePhaseChange(state: PhaseChangeState): string {
    const change = state.phaseChange
    assertExists(change, 'Phase change requires a continuation')
    const companyId = change.discardCompanyIds[0] ?? change.continuation.companyId
    if (companyId) {
        const owner = controllingOwner(state, companyId)
        assertExists(owner, 'The deciding company requires a controlling owner')
        state.activePlayerIds = [owner.playerId]
    }
    if (change.discardCompanyIds.length) return 'DiscardingTrains'
    const next = change.continuation.machineState
    delete state.phaseChange
    return next
}

const PhaseDecisionStates = ['AdvancingPhase', 'DiscardingTrains']
export function validatePhaseChange(
    state: PhaseState & {
        machineState: string
        companies: readonly { id: string }[]
        trainPurchaseStep?: { companyId: string }
        trackStep?: { companyId: string }
        stationStep?: { companyId: string }
        routeStep?: { companyId: string }
    }
): void {
    assert(
        new Set(state.phaseEvents.map((event) => event.id)).size === state.phaseEvents.length,
        'Duplicate phase occurrence'
    )
    const change = state.phaseChange
    if (!change) {
        assert(!PhaseDecisionStates.includes(state.machineState), 'Missing phase change')
        return
    }
    assert(
        PhaseDecisionStates.includes(state.machineState),
        'Pending phase change requires its decision state'
    )
    assert(
        change.continuation.companyId ===
            (state.trainPurchaseStep?.companyId ??
                state.trackStep?.companyId ??
                state.stationStep?.companyId ??
                state.routeStep?.companyId),
        'Phase continuation must preserve the operating company'
    )
    assert(
        change.discardCompanyIds.every((id) =>
            state.companies.some((company) => company.id === id)
        ),
        'Unknown company in discard order'
    )
    assert(
        state.machineState === 'AdvancingPhase'
            ? state.phaseId === change.event.fromPhaseId &&
                  !state.phaseEvents.some((event) => event.id === change.event.id)
            : state.phaseId === change.event.toPhaseId &&
                  change.discardCompanyIds.length > 0 &&
                  state.phaseEvents.some((event) => event.id === change.event.id),
        'Phase effects must match pending decisions'
    )
}
