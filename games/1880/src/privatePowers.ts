import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import {
    allPlayersPassed,
    closePrivate,
    continuePhaseChange,
    controllingOwner,
    getCompany,
    nextOperatingCompany,
    preparePhaseChange,
    privateOwner,
    releaseTrains,
    stepAction,
    titleAction,
    trainsOwnedBy,
    type PhaseChanges,
    type PrivatePowerRules,
    type StepAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { P0Id, P0Payments, P5Id, P7Id } from './companies.js'
import { PhaseRules1880 } from './operating.js'
import {
    ExchangingRocketState,
    requireState1880,
    type HydratedState1880,
    type StateHandler1880
} from './state.js'
import { MajorIds1880, receiveSecondCapital, releaseReservedShares } from './stock.js'
import { TrainRules1880, afterLastOfKind, payP0, trainOnSale } from './trainRules.js'
import { Phases1880, TrainDepot1880 } from './trains.js'

const Id = Type.String({ minLength: 1 })

export const PrivatePowerRules1880: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany: () => undefined
}

/** The open private's owner, when a player holds it. */
function privatePlayer(state: HydratedState1880, privateId: string): string | undefined {
    if (getCompany(state, privateId).closed) return undefined
    const owner = privateOwner(state, privateId)
    return owner?.kind === 'player' ? owner.playerId : undefined
}

/** The majors a player directs. */
export function directedMajors(state: HydratedState1880, playerId: string): string[] {
    return MajorIds1880.filter((companyId) => {
        const company = getCompany(state, companyId)
        return (
            company.started &&
            !company.closed &&
            controllingOwner(state, companyId)?.playerId === playerId
        )
    })
}

// P0, the Woosong Railway (§VI).

/**
 * The payment P0's owner may take in this share round: one brought by the last 2+2-train or the
 * last 3-train, in the share round it brings, before the next kind is bought (§VI). The last
 * 3+3-train pays its ¥100 itself.
 */
export function woosongPayment(state: HydratedState1880): number | undefined {
    if (state.machineState !== 'StockRound' || !privatePlayer(state, P0Id)) return undefined
    return P0Payments.find(
        ({ definitionId }) =>
            definitionId !== '3+3' &&
            TrainDepot1880.remaining(state.trainInventory, definitionId) === 0 &&
            Phases1880.phases.find((phase) => phase.startedBy.includes(definitionId))?.id ===
                state.phaseId
    )?.amount
}

const ClaimWoosongPaymentAction = titleAction('ClaimWoosongPayment', {
    amount: Type.Integer({ minimum: 1 })
})
export const ClaimWoosongPayment = ClaimWoosongPaymentAction.schema
export const isClaimWoosongPayment = ClaimWoosongPaymentAction.is

function canClaimWoosong(state: HydratedState1880, playerId: string): boolean {
    return (
        woosongPayment(state) !== undefined &&
        privatePlayer(state, P0Id) === playerId &&
        !state.stockRound.completed &&
        !allPlayersPassed(state) &&
        state.activePlayerIds.includes(playerId)
    )
}

/** P0's owner takes its payment in their share turn; P0 then closes (§VI). */
export class HydratedClaimWoosongPayment extends ClaimWoosongPaymentAction.Base {
    declare playerId: string
    declare amount: number
    isValid(state: HydratedState1880): boolean {
        return (
            this.source === ActionSource.User &&
            canClaimWoosong(state, this.playerId) &&
            woosongPayment(state) === this.amount
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'No payment is open to claim')
        payP0(state, this.amount)
    }
}

export const ClaimWoosongStep: StepAction<HydratedState1880> = stepAction(
    ClaimWoosongPaymentAction.type,
    (action: HydratedAction): action is HydratedClaimWoosongPayment =>
        action instanceof HydratedClaimWoosongPayment,
    canClaimWoosong
)

// P5, the Jeme Tien Yow Engineer Office (§VI).

/** The company P5's owner may give its phase D permit now: their operating major without one. */
export function engineerCompany(state: HydratedState1880, playerId: string): string | undefined {
    if (privatePlayer(state, P5Id) !== playerId) return undefined
    const companyId = nextOperatingCompany(state)
    if (!companyId || !MajorIds1880.includes(companyId)) return undefined
    if (controllingOwner(state, companyId)?.playerId !== playerId) return undefined
    return (state.permits[companyId] ?? '').includes('D') ? undefined : companyId
}

const AssignEngineerAction = titleAction('AssignEngineer', { companyId: Id })
export const AssignEngineer = AssignEngineerAction.schema
export const isAssignEngineer = AssignEngineerAction.is

/** P5's owner gives one of their majors a phase D permit for good; P5 then closes (§VI). */
export class HydratedAssignEngineer extends AssignEngineerAction.Base {
    declare playerId: string
    declare companyId: string
    isValid(state: HydratedState1880): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            engineerCompany(state, this.playerId) === this.companyId
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'The engineer office cannot be assigned here')
        const permits = state.permits[this.companyId] ?? ''
        state.permits = { ...state.permits, [this.companyId]: `${permits}D` }
        closePrivate(state, P5Id)
    }
}

export const AssignEngineerStep: StepAction<HydratedState1880> = stepAction(
    AssignEngineerAction.type,
    (action: HydratedAction): action is HydratedAssignEngineer =>
        action instanceof HydratedAssignEngineer,
    (state, playerId) =>
        state.activePlayerIds.includes(playerId) && !!engineerCompany(state, playerId)
)

// P7, the Rocket of China (§VI).

const RocketSteps: readonly string[] = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'BuyingTrains'
]

/** The company whose turn the Rocket's owner may exchange it in now, if its train limit allows. */
export function rocketCompany(state: HydratedState1880, playerId: string): string | undefined {
    if (privatePlayer(state, P7Id) !== playerId || !RocketSteps.includes(state.machineState))
        return undefined
    if (state.machineState === 'RunningTrains' && state.routeStep?.result) return undefined
    const companyId = nextOperatingCompany(state)
    if (!companyId || !MajorIds1880.includes(companyId)) return undefined
    if (controllingOwner(state, companyId)?.playerId !== playerId) return undefined
    return hasRoom(state, companyId) ? companyId : undefined
}

function hasRoom(state: HydratedState1880, companyId: string): boolean {
    return (
        trainsOwnedBy(state, { kind: 'company', companyId }).length <
        TrainRules1880.trainLimit(state, companyId)
    )
}

/** The majors the forced exchange may give the second 4-train to, and whether one must make room. */
export function forcedRocketCompanies(state: HydratedState1880): {
    companyIds: string[]
    makesRoom: boolean
} {
    const playerId = state.rocketExchanger
    if (!playerId) return { companyIds: [], makesRoom: false }
    const companies = directedMajors(state, playerId)
    const roomy = companies.filter((companyId) => hasRoom(state, companyId))
    return roomy.length
        ? { companyIds: roomy, makesRoom: false }
        : { companyIds: companies, makesRoom: true }
}

const ExchangeRocketAction = titleAction('ExchangeRocket', {
    companyId: Id,
    /** A train the company gives up to make room, in the forced exchange only (§VI). */
    discardTrainId: Type.Optional(Id),
    metadata: Type.Optional(
        Type.Object(
            { trainId: Id, definitionId: Id, toPhaseId: Type.Optional(Id) },
            { additionalProperties: false }
        )
    )
})
export const ExchangeRocket = ExchangeRocketAction.schema
export type ExchangeRocket = Type.Static<typeof ExchangeRocket>
export const isExchangeRocket = ExchangeRocketAction.is

/**
 * The Rocket's owner exchanges it for the train on sale, free, for one of their majors: in its
 * turn, or forced with the first 4-train. The train marker stays; the last train of a kind brings
 * a share round, the turn resuming where it was (§VI).
 */
export class HydratedExchangeRocket extends ExchangeRocketAction.Base {
    declare playerId: string
    declare companyId: string
    declare discardTrainId?: string
    declare metadata?: ExchangeRocket['metadata']
    private forced(state: HydratedState1880): boolean {
        return state.machineState === ExchangingRocketState
    }
    isValid(state: HydratedState1880): boolean {
        if (this.source !== ActionSource.User) return false
        if (!this.forced(state))
            return !this.discardTrainId && rocketCompany(state, this.playerId) === this.companyId
        if (state.rocketExchanger !== this.playerId) return false
        const { companyIds, makesRoom } = forcedRocketCompanies(state)
        if (!companyIds.includes(this.companyId)) return false
        if (!makesRoom) return !this.discardTrainId
        return trainsOwnedBy(state, { kind: 'company', companyId: this.companyId }).some(
            (train) => train.id === this.discardTrainId
        )
    }
    apply(state: HydratedState1880): void {
        assert(this.isValid(state), 'The Rocket of China cannot be exchanged so')
        const forced = this.forced(state)
        if (this.discardTrainId)
            releaseTrains(state.trainInventory, [this.discardTrainId], 'removed')
        const definitionId = trainOnSale(state)
        const train = TrainDepot1880.nextTrain(state.trainInventory, definitionId)
        assertExists(train, 'The bank has a train on sale')
        const last = TrainDepot1880.remaining(state.trainInventory, definitionId) === 1
        const toPhaseId = Phases1880.phaseAfterPurchase(state.phaseId, definitionId)
        TrainDepot1880.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: this.companyId
        })
        closePrivate(state, P7Id)
        delete state.rocketExchanger
        const operating = nextOperatingCompany(state)
        if (!forced)
            preparePhaseChange(state, train.id, definitionId, toPhaseId, {
                machineState: state.machineState,
                companyId: this.companyId
            })
        // Taking the last of a kind is as its purchase: a share round, and P0's last payment.
        if (last && operating)
            afterLastOfKind(
                state,
                definitionId,
                operating,
                forced
                    ? (state.phaseChange?.continuation.machineState ?? 'BuyingTrains')
                    : state.machineState
            )
        this.metadata = {
            trainId: train.id,
            definitionId,
            ...(toPhaseId !== state.phaseId ? { toPhaseId } : {})
        }
    }
}

export const ExchangeRocketStep: StepAction<HydratedState1880> = stepAction(
    ExchangeRocketAction.type,
    (action: HydratedAction): action is HydratedExchangeRocket =>
        action instanceof HydratedExchangeRocket,
    (state, playerId) => !!rocketCompany(state, playerId)
)

/**
 * The Rocket's exchange in a company's turn may start a phase; play then changes phase before
 * going on (§VI).
 */
export function changesPhaseAfterRocket(handler: StateHandler1880): StateHandler1880 {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            return action instanceof HydratedExchangeRocket && context.gameState.phaseChange
                ? 'AdvancingPhase'
                : next
        }
    }
}

/**
 * The first 3-train releases every major's reserved shares; the first 4-train forces the Rocket's
 * exchange for the second, its owner choosing the company;
 * an owner with no major loses the train, which leaves the game (§VI).
 */
export const PhaseChanges1880: PhaseChanges = {
    schema: Type.Object(
        { rocketExchanger: Type.Optional(Id), rocketTrainRemoved: Type.Optional(Id) },
        { additionalProperties: false }
    ),
    apply(stateObject, event) {
        const state = requireState1880(stateObject)
        // The first 3-train puts every major's second five shares on sale, and pays the second
        // half of its capital to each with no more than five left in the bank (§XI, §XII).
        if (event.toPhaseId === 'B1') {
            releaseReservedShares(state)
            for (const companyId of MajorIds1880) receiveSecondCapital(state, companyId)
        }
        if (event.toPhaseId !== 'B3' || getCompany(state, P7Id).closed) return {}
        const playerId = privatePlayer(state, P7Id)
        if (playerId && directedMajors(state, playerId).length) {
            state.rocketExchanger = playerId
            return { rocketExchanger: playerId }
        }
        const train = TrainDepot1880.export(state.trainInventory, trainOnSale(state))
        closePrivate(state, P7Id)
        return { rocketTrainRemoved: train.id }
    }
}

/** The Rocket's owner chooses where the second 4-train goes; the phase change then goes on. */
export const ExchangingRocketHandler: StateHandler1880 = {
    isValidAction: (action, context) =>
        action instanceof HydratedExchangeRocket && action.isValid(context.gameState),
    validActionsForPlayer: (playerId, context) =>
        context.gameState.rocketExchanger === playerId ? [ExchangeRocketAction.type] : [],
    enter(context) {
        const playerId = context.gameState.rocketExchanger
        if (playerId) context.gameState.activePlayerIds = [playerId]
    },
    onAction: (_action, context) => continuePhaseChange(context.gameState, PhaseRules1880)
}

export const PrivateActions1880 = [
    ClaimWoosongPaymentAction.define((action) => new HydratedClaimWoosongPayment(action)),
    AssignEngineerAction.define((action) => new HydratedAssignEngineer(action)),
    ExchangeRocketAction.define((action) => new HydratedExchangeRocket(action))
]
