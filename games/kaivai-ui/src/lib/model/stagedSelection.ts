import type { AxialCoordinates } from '@tabletop/common'
import type { Delivery, HutType } from '@tabletop/kaivai'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type KaivaiSelectionValues = {
    action: string
    boat: string
    destination: AxialCoordinates
    hut: HutType
    deliveries: Delivery[]
    deliveryLocation: AxialCoordinates
}

export type KaivaiSelection = StagedSelectionState<KaivaiSelectionValues>

const STAGE_ORDER = [
    'action',
    'boat',
    'destination',
    'hut',
    'deliveries',
    'deliveryLocation'
] as const satisfies readonly (keyof KaivaiSelectionValues)[]
type MissingStages = Exclude<keyof KaivaiSelectionValues, (typeof STAGE_ORDER)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setKaivaiSelection<TStage extends keyof KaivaiSelectionValues>(
    selection: KaivaiSelection,
    stage: TStage,
    value: KaivaiSelectionValues[TStage] | undefined
): KaivaiSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<KaivaiSelectionValues, TStage>(
              selection,
              STAGE_ORDER,
              stage
          )
        : setStagedSelectionValue<KaivaiSelectionValues, TStage>(
              selection,
              STAGE_ORDER,
              stage,
              value,
              'manual'
          )
}

export function hasManualKaivaiSelection(selection: KaivaiSelection): boolean {
    return hasManualStagedSelection<KaivaiSelectionValues>(selection, STAGE_ORDER)
}

export function popKaivaiSelection(selection: KaivaiSelection): KaivaiSelection {
    return popHighestManualStagedSelection<KaivaiSelectionValues>(selection, STAGE_ORDER).nextState
}
