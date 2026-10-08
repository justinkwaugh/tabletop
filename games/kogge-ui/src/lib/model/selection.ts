import type { GoodCounts, Good, SailRoute } from '@tabletop/kogge'
import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export enum TurnTool {
    Trade = 'Trade',
    BuyMarkers = 'BuyMarkers',
    ChangeRoute = 'ChangeRoute',
    GuildMaster = 'GuildMaster',
    Raid = 'Raid'
}

export type PaymentItem = { kind: 'good'; good: Good } | { kind: 'marker'; value: number }

export interface TradeDraft {
    give: GoodCounts
    take: GoodCounts
}

export type KoggeSelectionValues = {
    tool: TurnTool
    sailRoute: SailRoute
    routeSlot: number
    offerGroup: number
    trade: TradeDraft
    bid: number[]
    pile: GoodCounts
    payment: PaymentItem[]
}

export type KoggeSelection = StagedSelectionState<KoggeSelectionValues>

export const KoggeStageOrder = [
    'tool',
    'sailRoute',
    'routeSlot',
    'offerGroup',
    'trade',
    'bid',
    'pile',
    'payment'
] as const satisfies readonly (keyof KoggeSelectionValues)[]
type MissingStages = Exclude<keyof KoggeSelectionValues, (typeof KoggeStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function selectStage<TStage extends keyof KoggeSelectionValues>(
    selection: KoggeSelection,
    stage: TStage,
    value: KoggeSelectionValues[TStage]
): KoggeSelection {
    return setStagedSelectionValue<KoggeSelectionValues, TStage>(
        selection,
        KoggeStageOrder,
        stage,
        value,
        'manual'
    )
}

export function clearStage<TStage extends keyof KoggeSelectionValues>(
    selection: KoggeSelection,
    stage: TStage
): KoggeSelection {
    return clearStagedSelectionAtOrAfter<KoggeSelectionValues, TStage>(
        selection,
        KoggeStageOrder,
        stage
    )
}

export function stageValue<TStage extends keyof KoggeSelectionValues>(
    selection: KoggeSelection,
    stage: TStage
): KoggeSelectionValues[TStage] | undefined {
    return getStagedSelectionValue<KoggeSelectionValues, TStage>(selection, stage)
}

export function hasManualSelection(selection: KoggeSelection): boolean {
    return hasManualStagedSelection<KoggeSelectionValues>(selection, KoggeStageOrder)
}

export function popSelection(selection: KoggeSelection): KoggeSelection {
    return popHighestManualStagedSelection<KoggeSelectionValues>(selection, KoggeStageOrder)
        .nextState
}
