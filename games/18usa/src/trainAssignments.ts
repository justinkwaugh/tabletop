import * as Type from 'typebox'
import { ActionSource, assert, type HydratedGameState } from '@tabletop/common'
import {
    controllingOwner,
    titleAction,
    trainsOwnedBy,
    type ActingCompanyAction,
    type ActionDefinition,
    type OperatingState,
    type Train,
    type TrainDefinition,
    type TrainState
} from '@tabletop/18xx'
import type { EighteenUSAState, HydratedEighteenUSAState, TrainAssignments } from './state.js'
import { DoubleHeadingId, UnionSwitchId, companyHolding } from './privateHolders.js'
import { EighteenUSATrainDepot, PullmanTrainId } from './trains.js'

type State = OperatingState & TrainState & EighteenUSAState

export const SwitcherSuffix = '+S'
export type TrainPower = 'double-heading' | 'switcher'

/** The powers' assignments for the company's current run, if they were made for it. */
function currentAssignments(state: State, companyId: string): TrainAssignments | undefined {
    const assignments = state.trainAssignments
    const set = state.operatingSet
    return assignments &&
        set &&
        assignments.companyId === companyId &&
        assignments.setNumber === set.number &&
        assignments.roundNumber === set.roundNumber
        ? assignments
        : undefined
}

/** Whether P30 may double-head the train: one of the company's non-permanent trains (P30). */
function doubleHeadable(train: Train): boolean {
    return !!EighteenUSATrainDepot.trainDefinition(train.definitionId).rustsOn
}

function powerPrivate(power: TrainPower): string {
    return power === 'double-heading' ? DoubleHeadingId : UnionSwitchId
}

/** The trains the power may be given to for the company's run now. */
export function assignableTrains(state: State, companyId: string, power: TrainPower): Train[] {
    if (state.machineState !== 'RunningTrains' || state.routeStep?.companyId !== companyId)
        return []
    if (companyHolding(state, powerPrivate(power)) !== companyId) return []
    const assigned = currentAssignments(state, companyId)
    if (power === 'double-heading' ? assigned?.doubleHeadedTrainId : assigned?.switchedTrainId)
        return []
    return trainsOwnedBy(state, { kind: 'company', companyId }).filter(
        (train) =>
            train.definitionId !== PullmanTrainId && (power === 'switcher' || doubleHeadable(train))
    )
}

/**
 * The train's run with the powers given to it: one more city for P30's, and for P19's one more
 * city that it passes without counting or earning, a city treated as plain track (P19, P30).
 */
export function assignedDefinition(
    state: State,
    companyId: string,
    train: Train,
    definition: TrainDefinition
): TrainDefinition {
    const assigned = currentAssignments(state, companyId)
    const doubled = assigned?.doubleHeadedTrainId === train.id
    const switched = assigned?.switchedTrainId === train.id
    const { maximum } = definition.distance
    if ((!doubled && !switched) || maximum === 'unlimited') return definition
    return {
        ...definition,
        ...(switched ? { id: `${definition.id}${SwitcherSuffix}` } : {}),
        distance: {
            ...definition.distance,
            maximum: maximum + (doubled ? 1 : 0) + (switched ? 1 : 0)
        }
    }
}

/** How many of a switched train's stops pay: all but the one it treats as plain track (P19). */
export function switcherPayingStops(definition: TrainDefinition): number | undefined {
    const { maximum } = definition.distance
    return definition.id.includes(SwitcherSuffix) && maximum !== 'unlimited'
        ? maximum - 1
        : undefined
}

const AssignTrainPowerAction = titleAction('AssignTrainPower', {
    companyId: Type.String(),
    trainId: Type.String(),
    power: Type.Union([Type.Literal('double-heading'), Type.Literal('switcher')])
})
export const AssignTrainPower = AssignTrainPowerAction.schema
export type AssignTrainPower = Type.Static<typeof AssignTrainPower>
export const isAssignTrainPower = AssignTrainPowerAction.is

function presides(state: State, playerId: string, companyId: string): boolean {
    return controllingOwner(state, companyId)?.playerId === playerId
}

function assignmentValid(state: State, action: AssignTrainPower): boolean {
    return (
        presides(state, action.playerId, action.companyId) &&
        assignableTrains(state, action.companyId, action.power).some(
            (train) => train.id === action.trainId
        )
    )
}

class HydratedAssignTrainPower extends AssignTrainPowerAction.Base implements AssignTrainPower {
    declare type: 'AssignTrainPower'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare power: TrainPower
    apply(state: HydratedGameState & State): void {
        assert(
            this.source === ActionSource.User && assignmentValid(state, this),
            'The train cannot take this power now'
        )
        const set = state.operatingSet
        assert(!!set, 'Trains run in an operating round')
        const assigned = currentAssignments(state, this.companyId) ?? {
            companyId: this.companyId,
            setNumber: set.number,
            roundNumber: set.roundNumber
        }
        state.trainAssignments =
            this.power === 'double-heading'
                ? { ...assigned, doubleHeadedTrainId: this.trainId }
                : { ...assigned, switchedTrainId: this.trainId }
    }
}

export const TrainAssignmentActions: readonly ActionDefinition[] = [
    AssignTrainPowerAction.define((action) => new HydratedAssignTrainPower(action))
]

/** Giving P30's or P19's power to one of the company's trains before it runs (P19, P30). */
export const AssignTrainPowerCompanyAction: ActingCompanyAction<HydratedEighteenUSAState> = {
    type: 'AssignTrainPower',
    available: (state, playerId, companyId) =>
        presides(state, playerId, companyId) &&
        (assignableTrains(state, companyId, 'double-heading').length > 0 ||
            assignableTrains(state, companyId, 'switcher').length > 0),
    isValid: (action, state, companyId) =>
        isAssignTrainPower(action) &&
        action.companyId === companyId &&
        assignmentValid(state, action)
}
