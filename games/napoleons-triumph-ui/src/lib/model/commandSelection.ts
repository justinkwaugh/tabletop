import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { CommandKind } from '@tabletop/napoleons-triumph'
import { RideChoice } from './moveCommands.js'
import { stagedSelection } from './stagedSelection.js'

export interface PickedUp {
    groupKey: string
    tappedUnitId?: string
}

type CommandSelectionValues = {
    aim: number
    group: PickedUp
    units: string[]
    ride: RideChoice
    command: CommandKind
    destination: string
    way: string[]
    threat: number
    guard: string
}

export type CommandSelection = StagedSelectionState<CommandSelectionValues>

const commandSelection = stagedSelection<CommandSelectionValues>()([
    'aim',
    'group',
    'units',
    'ride',
    'command',
    'destination',
    'way',
    'threat',
    'guard'
])

function withoutDestination(selection: CommandSelection): CommandSelection {
    return commandSelection.clearFrom(selection, 'destination')
}

function withoutRideOrDestination(selection: CommandSelection): CommandSelection {
    return commandSelection.withdraw(withoutDestination(selection), 'ride')
}

export function noCommandSelection(): CommandSelection {
    return commandSelection.empty()
}

export function setPickedUp(pickedUp: PickedUp): CommandSelection {
    return commandSelection.set(commandSelection.empty(), 'group', pickedUp, 'manual')
}

export function setAim(locale: number): CommandSelection {
    return commandSelection.set(commandSelection.empty(), 'aim', locale, 'manual')
}

export function aimOf(selection: CommandSelection): number | undefined {
    return commandSelection.value(selection, 'aim')
}

export function pickedUpOf(selection: CommandSelection): PickedUp | undefined {
    return commandSelection.value(selection, 'group')
}

export function chosenUnitsOf(selection: CommandSelection): string[] | undefined {
    return commandSelection.value(selection, 'units')
}

export function chosenCommandOf(selection: CommandSelection): CommandKind | undefined {
    return commandSelection.value(selection, 'command')
}

export function threatOf(selection: CommandSelection): number | undefined {
    return commandSelection.value(selection, 'threat')
}

export function setThreat(selection: CommandSelection, approach: number): CommandSelection {
    return commandSelection.set(selection, 'threat', approach, 'manual')
}

export function guardUnitOf(selection: CommandSelection): string | undefined {
    return commandSelection.value(selection, 'guard')
}

export function setGuardUnit(selection: CommandSelection, unitId: string): CommandSelection {
    return commandSelection.set(selection, 'guard', unitId, 'manual')
}

export function withoutGuardUnit(selection: CommandSelection): CommandSelection {
    return commandSelection.clearFrom(selection, 'guard')
}

export function unitsPickedUpWith(
    pickedUp: PickedUp | undefined,
    movableIds: readonly string[],
    isCorps: boolean,
    riderIds: readonly string[]
): string[] {
    const tappedMovable = movableIds.find((id) => id === pickedUp?.tappedUnitId)
    const ridersStayInHand = riderIds.length > 0 && tappedMovable === undefined
    if (ridersStayInHand) {
        return [...riderIds]
    }
    if (isCorps) {
        return [...movableIds]
    }
    return [tappedMovable ?? movableIds[0]].flatMap((id) => id ?? [])
}

export function chooseCorpsUnit(
    selection: CommandSelection,
    unitId: string,
    movableIds: readonly string[]
): CommandSelection {
    const chosen = chosenUnitsOf(selection) ?? []
    const next = chosen.includes(unitId)
        ? chosen.filter((id) => id !== unitId)
        : [...chosen, unitId]
    const wholeCorps = next.length === 0 || movableIds.every((id) => next.includes(id))
    return withoutRideOrDestination(
        wholeCorps
            ? commandSelection.withdraw(selection, 'units')
            : commandSelection.revise(selection, 'units', next, 'manual')
    )
}

/** Detached units are commanded one at a time, so tapping another takes its place, unless the two may be commanded together; tapping the last one chosen puts the group down. */
export function chooseDetachedUnit(
    selection: CommandSelection,
    unitId: string,
    chosen: readonly string[],
    mayJoinTheChosen: boolean
): CommandSelection {
    if (!chosen.includes(unitId)) {
        const next = mayJoinTheChosen ? [...chosen, unitId] : [unitId]
        return withoutRideOrDestination(commandSelection.revise(selection, 'units', next, 'manual'))
    }
    const rest = chosen.filter((id) => id !== unitId)
    return rest.length === 0
        ? commandSelection.empty()
        : withoutRideOrDestination(commandSelection.revise(selection, 'units', rest, 'manual'))
}

// Deliberate: riding on is in force with no choice made, so choosing it takes the choice back and leaves Undo no step that changes nothing.
export function setRide(selection: CommandSelection, ride: RideChoice): CommandSelection {
    return ride === RideChoice.NewCommand
        ? commandSelection.set(selection, 'ride', ride, 'manual')
        : commandSelection.clearFrom(selection, 'ride')
}

export function rideOf(selection: CommandSelection): RideChoice {
    return commandSelection.value(selection, 'ride') ?? RideChoice.RidingOn
}

export function setCommand(selection: CommandSelection, kind: CommandKind): CommandSelection {
    return withoutDestination(commandSelection.revise(selection, 'command', kind, 'manual'))
}

export function setDestination(selection: CommandSelection, targetKey: string): CommandSelection {
    return commandSelection.set(selection, 'destination', targetKey, 'manual')
}

export function destinationOf(selection: CommandSelection): string | undefined {
    return commandSelection.value(selection, 'destination')
}

export function wayStepsOf(selection: CommandSelection): string[] {
    return commandSelection.value(selection, 'way') ?? []
}

export function addWayStep(selection: CommandSelection, stepKey: string): CommandSelection {
    const steps = [...wayStepsOf(selection), stepKey]
    return commandSelection.set(selection, 'way', steps, 'manual')
}

export function hasManualCommandSelection(selection: CommandSelection): boolean {
    return commandSelection.hasManual(selection)
}

export function undoCommandSelection(selection: CommandSelection): CommandSelection {
    const earlierSteps = wayStepsOf(selection).slice(0, -1)
    return earlierSteps.length > 0
        ? commandSelection.set(selection, 'way', earlierSteps, 'manual')
        : commandSelection.undo(selection)
}
