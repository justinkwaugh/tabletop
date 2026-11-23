import { pushStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'
import type { CapacityPurchase, LocomotiveId, Plant } from '@tabletop/locomotive-werks'

// Production Capacity: the units the player means to add or upgrade, one press at a time. Done
// buying submits them. A step without `from` adds a unit; one with `from` moves a unit up.
export type CapacityStep = { locomotiveId: LocomotiveId; from?: LocomotiveId }

// The steps and the automatic shipping tick share one stage, so Undo takes back presses of
// either in the order they were made.
export type CapacityPlan = { steps: CapacityStep[]; autoShip: boolean }

export type CapacitySelectionValues = {
    plan: CapacityPlan
}

export type CapacitySelection = StagedSelectionState<CapacitySelectionValues>

export const CapacityStageOrder = [
    'plan'
] as const satisfies readonly (keyof CapacitySelectionValues)[]

const EMPTY_PLAN: CapacityPlan = { steps: [], autoShip: false }

export function capacityPlan(selection: CapacitySelection): CapacityPlan {
    return selection.plan?.value ?? EMPTY_PLAN
}

function pushPlan(selection: CapacitySelection, plan: CapacityPlan) {
    return pushStagedSelectionValue<CapacitySelectionValues, 'plan'>(
        selection,
        CapacityStageOrder,
        'plan',
        plan
    )
}

export function addCapacityStep(selection: CapacitySelection, step: CapacityStep) {
    const plan = capacityPlan(selection)
    return pushPlan(selection, { ...plan, steps: [...plan.steps, step] })
}

export function setAutoShip(selection: CapacitySelection, autoShip: boolean) {
    return pushPlan(selection, { ...capacityPlan(selection), autoShip })
}

// Each werk's units once the planned steps are made.
export function plannedUnits(
    plants: readonly Pick<Plant, 'locomotiveId' | 'units'>[],
    steps: readonly CapacityStep[]
): Map<LocomotiveId, number> {
    const units = new Map(plants.map((plant) => [plant.locomotiveId, plant.units]))
    for (const step of steps) {
        units.set(step.locomotiveId, (units.get(step.locomotiveId) ?? 0) + 1)
        if (step.from) {
            units.set(step.from, (units.get(step.from) ?? 0) - 1)
        }
    }
    return units
}

// A werk whose units have all been planned away closes, so it neither gives nor takes more units.
export function keepsWerksOpen(units: ReadonlyMap<LocomotiveId, number>, step: CapacityStep) {
    const open = (locomotiveId: LocomotiveId) => (units.get(locomotiveId) ?? 0) > 0
    return open(step.locomotiveId) && (step.from === undefined || open(step.from))
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
