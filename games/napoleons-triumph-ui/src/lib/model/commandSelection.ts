import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { CommandKind } from '@tabletop/napoleons-triumph'
import { stagedSelection } from './stagedSelection.js'

export interface PickedUp {
    groupKey: string
    tappedUnitId?: string
}

type CommandSelectionValues = {
    group: PickedUp
    units: string[]
    command: CommandKind
    guardAttack: true
}

export type CommandSelection = StagedSelectionState<CommandSelectionValues>

const commandSelection = stagedSelection<CommandSelectionValues>()([
    'group',
    'units',
    'command',
    'guardAttack'
])

export function noCommandSelection(): CommandSelection {
    return commandSelection.empty()
}

export function setPickedUp(pickedUp: PickedUp): CommandSelection {
    return commandSelection.set(commandSelection.empty(), 'group', pickedUp, 'manual')
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

export function guardAttackAnnounced(selection: CommandSelection): boolean {
    return commandSelection.value(selection, 'guardAttack') === true
}

export function unitsPickedUpWith(
    pickedUp: PickedUp | undefined,
    movableIds: readonly string[],
    isCorps: boolean
): string[] {
    if (isCorps) {
        return [...movableIds]
    }
    const tapped = movableIds.find((id) => id === pickedUp?.tappedUnitId)
    return [tapped ?? movableIds[0]].flatMap((id) => id ?? [])
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
    return wholeCorps
        ? commandSelection.withdraw(selection, 'units')
        : commandSelection.revise(selection, 'units', next, 'manual')
}

export function setDetachedUnit(selection: CommandSelection, unitId: string): CommandSelection {
    return commandSelection.revise(selection, 'units', [unitId], 'manual')
}

export function setCommand(selection: CommandSelection, kind: CommandKind): CommandSelection {
    return commandSelection.revise(selection, 'command', kind, 'manual')
}

export function setGuardAttack(selection: CommandSelection, announced: boolean): CommandSelection {
    return announced
        ? commandSelection.set(selection, 'guardAttack', true, 'manual')
        : commandSelection.clearFrom(selection, 'guardAttack')
}

export function hasManualCommandSelection(selection: CommandSelection): boolean {
    return commandSelection.hasManual(selection)
}

export function undoCommandSelection(selection: CommandSelection): CommandSelection {
    return commandSelection.undo(selection)
}
