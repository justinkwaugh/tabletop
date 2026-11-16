import { pushStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'
import type { CapacityPurchase, LocomotiveId } from '@tabletop/locomotive-werks'

// Production Capacity: the units the player means to add or upgrade, one press at a time. Done
// buying submits them. A step without `from` adds a unit; one with `from` moves a unit up.
export type CapacityStep = { locomotiveId: LocomotiveId; from?: LocomotiveId }

export type CapacitySelectionValues = {
    steps: CapacityStep[]
}

export type CapacitySelection = StagedSelectionState<CapacitySelectionValues>

export const CapacityStageOrder = [
    'steps'
] as const satisfies readonly (keyof CapacitySelectionValues)[]

export function addCapacityStep(selection: CapacitySelection, step: CapacityStep) {
    return pushStagedSelectionValue<CapacitySelectionValues, 'steps'>(
        selection,
        CapacityStageOrder,
        'steps',
        [...(selection.steps?.value ?? []), step]
    )
}

// Runs of the same step become one purchase, in the order they were planned.
export function mergeCapacitySteps(steps: readonly CapacityStep[]): CapacityPurchase[] {
    const purchases: CapacityPurchase[] = []
    for (const step of steps) {
        const last = purchases.at(-1)
        if (last && last.locomotiveId === step.locomotiveId && last.from === step.from) {
            last.units += 1
        } else {
            purchases.push({ ...step, units: 1 })
        }
    }
    return purchases
}

// A selling turn: the locomotives the player keeps back, one press at a time.
export type ShipSelectionValues = {
    held: LocomotiveId[]
}

export type ShipSelection = StagedSelectionState<ShipSelectionValues>

export const ShipStageOrder = ['held'] as const satisfies readonly (keyof ShipSelectionValues)[]

export function toggleHeld(selection: ShipSelection, locomotiveId: LocomotiveId) {
    const held = selection.held?.value ?? []
    const next = held.includes(locomotiveId)
        ? held.filter((candidate) => candidate !== locomotiveId)
        : [...held, locomotiveId]
    return pushStagedSelectionValue<ShipSelectionValues, 'held'>(
        selection,
        ShipStageOrder,
        'held',
        next
    )
}
