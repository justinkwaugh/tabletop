import { ActionSource, assert, assertExists, type HydratedAction } from '@tabletop/common'
import {
    SystemActionFirstHandler,
    StepActionsHandler,
    controllingOwner,
    hasTurnMark,
    markTurn,
    nextOperatingCompany,
    systemAction,
    titleAction,
    type StepAction,
    type Train
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { directorStepAction } from './directorStep.js'
import { requireState1828, type HydratedState1828, type StateHandler1828 } from './state.js'
import {
    ShellsClosedMark,
    TrainShellMarks,
    arrangedShellTrainIds,
    clearNamedTrainShell,
    constituents,
    trainShells,
    unplacedShellTrains
} from './systems.js'
import { phaseTrainLimit } from './trains.js'

const Id = Type.String({ minLength: 1 })

function systemsWithUnplacedTrains(state: HydratedState1828): string[] {
    return Object.keys(state.systems).filter(
        (systemId) => unplacedShellTrains(state, systemId).length > 0
    )
}

const PlaceShellTrainsAction = systemAction('PlaceShellTrains', {
    companyId: Id,
    metadata: Type.Optional(
        Type.Object(
            { trainIds: Type.Tuple([Type.Array(Id), Type.Array(Id)]) },
            { additionalProperties: false }
        )
    )
})
export const PlaceShellTrains = PlaceShellTrainsAction.schema
export type PlaceShellTrains = Type.Static<typeof PlaceShellTrains>
export const isPlaceShellTrains = PlaceShellTrainsAction.is

/**
 * A train a system acquires goes into the shell its director named, or else the one with fewer
 * trains (§8.3.5.1).
 */
class HydratedPlaceShellTrains extends PlaceShellTrainsAction.Base implements PlaceShellTrains {
    declare type: 'PlaceShellTrains'
    declare companyId: string
    declare metadata?: PlaceShellTrains['metadata']
    apply(state: HydratedState1828): void {
        assert(
            this.source === ActionSource.System &&
                systemsWithUnplacedTrains(state).includes(this.companyId),
            'This system has no train to place'
        )
        const system = state.systems[this.companyId]
        const arranged = arrangedShellTrainIds(state, this.companyId)
        const [first, second] = system.shellTrainIds
        this.metadata = {
            trainIds: [
                arranged[0].filter((id) => !first.includes(id)),
                arranged[1].filter((id) => !second.includes(id))
            ]
        }
        system.shellTrainIds = arranged
    }
}

/** Places a system's new trains before anything else happens. */
export function placesShellTrains(handler: StateHandler1828): StateHandler1828 {
    return new SystemActionFirstHandler(handler, PlaceShellTrains, (state) => {
        const companyId = systemsWithUnplacedTrains(state)[0]
        return companyId ? { companyId } : undefined
    })
}

export function shellsOpen(state: HydratedState1828, companyId: string): boolean {
    return (
        companyId in state.systems &&
        state.machineState === 'BuyingTrains' &&
        state.trainPurchaseStep?.companyId === companyId &&
        state.trainPurchaseStep.purchasedTrainIds.length === 0 &&
        !hasTurnMark(state, ShellsClosedMark) &&
        nextOperatingCompany(state) === companyId
    )
}

export function movableShellTrainIds(state: HydratedState1828, companyId: string): string[] {
    if (!shellsOpen(state, companyId)) return []
    const shells = trainShells(state, companyId)
    const limit = phaseTrainLimit(state)
    return shells.flatMap((shell, index) =>
        shells[1 - index].length < limit ? shell.map((train) => train.id) : []
    )
}

/** The operating system's two shells, when both stand at the limit and trains can only swap. */
export function shellsFull(state: HydratedState1828, companyId: string): boolean {
    if (!shellsOpen(state, companyId)) return false
    const limit = phaseTrainLimit(state)
    return trainShells(state, companyId).every((shell) => shell.length >= limit)
}

const MoveShellTrainAction = titleAction('MoveShellTrain', { companyId: Id, trainId: Id })
export const MoveShellTrain = MoveShellTrainAction.schema
export type MoveShellTrain = Type.Static<typeof MoveShellTrain>
export const isMoveShellTrain = MoveShellTrainAction.is

/**
 * At the start of its train step, before it buys, a system moves trains freely between its
 * shells, none holding more than the limit (§8.3.5.1).
 */
class HydratedMoveShellTrain extends MoveShellTrainAction.Base implements MoveShellTrain {
    declare type: 'MoveShellTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    isValid(state: HydratedState1828): boolean {
        if (
            this.source !== ActionSource.User ||
            controllingOwner(state, this.companyId)?.playerId !== this.playerId ||
            !shellsOpen(state, this.companyId)
        )
            return false
        return movableShellTrainIds(state, this.companyId).includes(this.trainId)
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'This train cannot move between shells now')
        const system = requireState1828(state).systems[this.companyId]
        assertExists(system, 'Only a system has shells')
        const [first, second] = system.shellTrainIds
        system.shellTrainIds = second.includes(this.trainId)
            ? [[...first, this.trainId], second.filter((id) => id !== this.trainId)]
            : [first.filter((id) => id !== this.trainId), [...second, this.trainId]]
    }
}

/** Emergency buying fills the empty shell, whichever shell was named (§8.3.5.1). */
export function fundsEmptyShell(handler: StateHandler1828): StateHandler1828 {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter(context) {
            clearNamedTrainShell(context.gameState)
            handler.enter(context)
        },
        onAction: (action, context) => handler.onAction(action, context)
    }
}

export function trainShellChoiceOpen(state: HydratedState1828, companyId: string): boolean {
    if (
        !(companyId in state.systems) ||
        state.machineState !== 'BuyingTrains' ||
        state.trainPurchaseStep?.companyId !== companyId ||
        nextOperatingCompany(state) !== companyId
    )
        return false
    const limit = phaseTrainLimit(state)
    return trainShells(state, companyId).every((shell) => shell.length < limit)
}

const ChooseTrainShellAction = titleAction('ChooseTrainShell', {
    companyId: Id,
    shellCompanyId: Id
})
export const ChooseTrainShell = ChooseTrainShellAction.schema
export type ChooseTrainShell = Type.Static<typeof ChooseTrainShell>
export const isChooseTrainShell = ChooseTrainShellAction.is

/** Either shell below the limit may buy, so the director names the one (§8.3.5.1, §15.4). */
class HydratedChooseTrainShell extends ChooseTrainShellAction.Base implements ChooseTrainShell {
    declare type: 'ChooseTrainShell'
    declare playerId: string
    declare companyId: string
    declare shellCompanyId: string
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            trainShellChoiceOpen(state, this.companyId) &&
            constituents(state, this.companyId).includes(this.shellCompanyId)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'The shell for the next train cannot be chosen now')
        clearNamedTrainShell(state)
        markTurn(state, TrainShellMarks[this.shellCompanyId === this.companyId ? 0 : 1])
    }
}

export const ChooseTrainShellStep: StepAction<HydratedState1828> = directorStepAction(
    'ChooseTrainShell',
    (action: HydratedAction): action is HydratedChooseTrainShell =>
        action instanceof HydratedChooseTrainShell,
    trainShellChoiceOpen
)

const SwapShellTrainsAction = titleAction('SwapShellTrains', {
    companyId: Id,
    trainId: Id,
    otherTrainId: Id
})
export const SwapShellTrains = SwapShellTrainsAction.schema
export type SwapShellTrains = Type.Static<typeof SwapShellTrains>
export const isSwapShellTrains = SwapShellTrainsAction.is

/** Trains arrange freely between shells, so two full shells may exchange them (§8.3.5.1). */
class HydratedSwapShellTrains extends SwapShellTrainsAction.Base implements SwapShellTrains {
    declare type: 'SwapShellTrains'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare otherTrainId: string
    isValid(state: HydratedState1828): boolean {
        if (
            this.source !== ActionSource.User ||
            controllingOwner(state, this.companyId)?.playerId !== this.playerId ||
            !shellsFull(state, this.companyId)
        )
            return false
        const holds = (ids: readonly Train[], trainId: string) =>
            ids.some((train) => train.id === trainId)
        const [first, second] = trainShells(state, this.companyId)
        return (
            (holds(first, this.trainId) && holds(second, this.otherTrainId)) ||
            (holds(second, this.trainId) && holds(first, this.otherTrainId))
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'These trains cannot swap shells now')
        const system = state.systems[this.companyId]
        const swapped = (id: string) =>
            id === this.trainId ? this.otherTrainId : id === this.otherTrainId ? this.trainId : id
        system.shellTrainIds = [
            system.shellTrainIds[0].map(swapped),
            system.shellTrainIds[1].map(swapped)
        ]
    }
}

export const SwapShellTrainsStep: StepAction<HydratedState1828> = directorStepAction(
    'SwapShellTrains',
    (action: HydratedAction): action is HydratedSwapShellTrains =>
        action instanceof HydratedSwapShellTrains,
    shellsFull
)

export const MoveShellTrainStep: StepAction<HydratedState1828> = directorStepAction(
    'MoveShellTrain',
    (action: HydratedAction): action is HydratedMoveShellTrain =>
        action instanceof HydratedMoveShellTrain,
    shellsOpen
)

export function arrangesShells(handler: StateHandler1828): StateHandler1828 {
    return new StepActionsHandler(handler, [
        MoveShellTrainStep,
        SwapShellTrainsStep,
        ChooseTrainShellStep
    ])
}

export const ShellActions1828 = [
    PlaceShellTrainsAction.define((action) => new HydratedPlaceShellTrains(action)),
    MoveShellTrainAction.define((action) => new HydratedMoveShellTrain(action)),
    SwapShellTrainsAction.define((action) => new HydratedSwapShellTrains(action)),
    ChooseTrainShellAction.define((action) => new HydratedChooseTrainShell(action))
]
