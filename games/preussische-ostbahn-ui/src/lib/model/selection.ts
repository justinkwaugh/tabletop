import { setStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'
import type { RailroadId } from '@tabletop/preussische-ostbahn'

export enum TurnIntent {
    Build = 'Build',
    Offer = 'Offer'
}

export type TurnValues = {
    intent: TurnIntent
    railroad: RailroadId
}

export type TurnSelection = StagedSelectionState<TurnValues>

export const TurnStageOrder = [
    'intent',
    'railroad'
] as const satisfies readonly (keyof TurnValues)[]
type MissingStages = Exclude<keyof TurnValues, (typeof TurnStageOrder)[number]>
const coverage: MissingStages extends never ? true : never = true
void coverage

export function chooseIntent(selection: TurnSelection, intent: TurnIntent): TurnSelection {
    return setStagedSelectionValue<TurnValues, 'intent'>(
        selection,
        TurnStageOrder,
        'intent',
        intent,
        'manual'
    )
}

export function chooseRailroad(selection: TurnSelection, railroadId: RailroadId): TurnSelection {
    return setStagedSelectionValue<TurnValues, 'railroad'>(
        selection,
        TurnStageOrder,
        'railroad',
        railroadId,
        'manual'
    )
}
