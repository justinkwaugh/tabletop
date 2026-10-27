import type { Resource } from '@tabletop/power-grid'
import {
    clearStagedSelectionAtOrAfter,
    getHighestManualStagedSelectionStage,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type PowerChoice = { plants: number[]; hybridCoal?: number }

export type PowerGridSelectionValues = {
    plant: number
    bid: number
    scrap: number
    dropOilFirst: boolean
    cart: Resource[]
    cities: string[]
    power: PowerChoice
}

export type PowerGridSelection = StagedSelectionState<PowerGridSelectionValues>

export const PowerGridStageOrder = [
    'plant',
    'bid',
    'scrap',
    'dropOilFirst',
    'cart',
    'cities',
    'power'
] as const satisfies readonly (keyof PowerGridSelectionValues)[]
type MissingStages = Exclude<keyof PowerGridSelectionValues, (typeof PowerGridStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setPowerGridSelection<TStage extends keyof PowerGridSelectionValues>(
    selection: PowerGridSelection,
    stage: TStage,
    value: PowerGridSelectionValues[TStage] | undefined
): PowerGridSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<PowerGridSelectionValues, TStage>(
              selection,
              PowerGridStageOrder,
              stage
          )
        : setStagedSelectionValue<PowerGridSelectionValues, TStage>(
              selection,
              PowerGridStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualPowerGridSelection(selection: PowerGridSelection): boolean {
    return hasManualStagedSelection<PowerGridSelectionValues>(selection, PowerGridStageOrder)
}

/** Undo takes back one token or city at a time, and any other stage whole. */
export function popPowerGridSelection(selection: PowerGridSelection): PowerGridSelection {
    const stage = getHighestManualStagedSelectionStage<PowerGridSelectionValues>(
        selection,
        PowerGridStageOrder
    )
    const cart = selection.cart?.value ?? []
    if (stage === 'cart' && cart.length > 1) {
        return setPowerGridSelection(selection, 'cart', cart.slice(0, -1))
    }
    const cities = selection.cities?.value ?? []
    if (stage === 'cities' && cities.length > 1) {
        return setPowerGridSelection(selection, 'cities', cities.slice(0, -1))
    }
    return popHighestManualStagedSelection<PowerGridSelectionValues>(selection, PowerGridStageOrder)
        .nextState
}
