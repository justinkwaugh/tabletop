import {
    SystemActionFirstHandler,
    nextOperatingCompany,
    releaseTrains,
    systemAction,
    titleAction,
    trainsOverLimit,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import { PhaseRules1860, TrainRules1860 } from './operating.js'
import { ReturningTrainsState, type HydratedState1860, type State1860 } from './state.js'

const Id = Type.String({ minLength: 1 })

/**
 * The next company to operate, before its turn begins, while it holds more trains than the
 * phase allows (Buying Trains).
 */
export function companyOverLimit(state: State1860): string | undefined {
    const set = state.operatingSet
    if (!set || set.completed || !set.privateIncomePaid) return undefined
    const companyId = nextOperatingCompany(state)
    if (!companyId || state.trackStep?.companyId === companyId) return undefined
    return trainsOverLimit(state, TrainRules1860, companyId).length ? companyId : undefined
}

function decider(state: HydratedState1860, companyId: string): string | undefined {
    return PhaseRules1860.activePlayers?.(state, companyId)[0]
}

const BeginAction = systemAction('BeginReturningTrains', { companyId: Id })
export const BeginReturningTrains = BeginAction.schema
export const isBeginReturningTrains = BeginAction.is

/** A company over its train limit returns trains before its turn begins. */
export class HydratedBeginReturningTrains extends BeginAction.Base {
    declare companyId: Type.Static<typeof BeginReturningTrains>['companyId']
    apply(state: HydratedState1860): void {
        assert(
            this.source === ActionSource.System && companyOverLimit(state) === this.companyId,
            'The company is over its train limit'
        )
    }
}

const ReturnAction = titleAction('ReturnTrain', {
    companyId: Id,
    trainId: Id,
    metadata: Type.Optional(Type.Object({ definitionId: Id }, { additionalProperties: false }))
})
export const ReturnTrain = ReturnAction.schema
export const isReturnTrain = ReturnAction.is

/**
 * Trains over the limit go back to the bank at the start of the company's next turn, without
 * compensation, for sale again at face value (Buying Trains; TN-8).
 */
export class HydratedReturnTrain extends ReturnAction.Base {
    declare playerId: string
    declare companyId: Type.Static<typeof ReturnTrain>['companyId']
    declare trainId: Type.Static<typeof ReturnTrain>['trainId']
    declare metadata?: Type.Static<typeof ReturnTrain>['metadata']
    isValid(state: HydratedState1860): boolean {
        return (
            this.source === ActionSource.User &&
            companyOverLimit(state) === this.companyId &&
            decider(state, this.companyId) === this.playerId &&
            trainsOverLimit(state, TrainRules1860, this.companyId).some(
                (train) => train.id === this.trainId
            )
        )
    }
    apply(state: HydratedState1860): void {
        assert(this.isValid(state), 'The director returns one of the company’s trains')
        const train = state.trainInventory.trains.find((entry) => entry.id === this.trainId)
        assertExists(train, 'The returned train is in the inventory')
        // The train may later rust out of State; history names it from here.
        this.metadata = { definitionId: train.definitionId }
        releaseTrains(state.trainInventory, [this.trainId], 'market')
    }
}

type Context = MachineContext<HydratedState1860>

/** Waits on the director to return trains until the company is within its limit. */
export class ReturningTrainsHandler implements EighteenXXStateHandler<HydratedState1860> {
    isValidAction(action: HydratedAction, context: Context): boolean {
        return action instanceof HydratedReturnTrain && action.isValid(context.gameState)
    }
    validActionsForPlayer(playerId: string, context: Context): string[] {
        const state = context.gameState
        const companyId = companyOverLimit(state)
        return companyId && decider(state, companyId) === playerId ? [ReturnAction.type] : []
    }
    enter(context: Context): void {
        const state = context.gameState
        const companyId = companyOverLimit(state)
        const playerId = companyId && decider(state, companyId)
        if (playerId) state.activePlayerIds = [playerId]
    }
    onAction(_action: HydratedAction, context: Context): string {
        return companyOverLimit(context.gameState) ? ReturningTrainsState : 'OperatingSet'
    }
}

/** Sends a company over its limit to return trains before its turn begins. */
export function returnsExcessTrains(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(
        handler,
        BeginReturningTrains,
        (state) => {
            const companyId = companyOverLimit(state)
            return companyId ? { companyId } : undefined
        },
        ReturningTrainsState
    )
}

export const ReturnTrainActions = [
    BeginAction.define((action) => new HydratedBeginReturningTrains(action)),
    ReturnAction.define((action) => new HydratedReturnTrain(action))
]
