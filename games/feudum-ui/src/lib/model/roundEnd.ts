import type { GameAction, Turn } from '@tabletop/common'
import {
    ActionType,
    isBeginDawn,
    type BeginDawn,
    type Epoch,
    type ReplenishMap
} from '@tabletop/feudum'
import { isDecisionPress, turnSeatAt } from '$lib/utils/decisionPress.js'
import { spaceLabel } from './cardFlows.js'

type DawnMetadata = NonNullable<BeginDawn['metadata']>
export type DawnSheetRow = DawnMetadata['sheet'][number]
type LandscapeFilled = DawnMetadata['fills'][number]
type MapGood = NonNullable<ReplenishMap['metadata']>['goods'][number]

export interface DawnSheetView {
    readonly epoch: Epoch
    /** R-4.12.1, R-4.12.2 One per seat, in turn order. */
    readonly rows: readonly DawnSheetRow[]
    /** R-4.12.3 The landscape fills, in the order they filled. */
    readonly fills: readonly string[]
}

/** R-4.11 The roll, the map's new goods and the guild refill are the history's to tell. */
export interface RoundEndView {
    readonly dawn: DawnSheetView
}

export function fillLine({ spaceId, landscape, added }: LandscapeFilled): string {
    return `${spaceLabel(spaceId)}: ${landscape} +${added}`
}

export function goodsLine(goods: readonly MapGood[]): string {
    const named = goods.map(({ spaceId, good }) => `${good} at ${spaceLabel(spaceId)}`)
    return `New goods: ${named.join(', ')}`
}

/** R-4.4-H5 An off-turn writ discard moves no decision on, nor does a dawn collection. */
function sinceLastDecision(
    actions: readonly GameAction[],
    turns: readonly Turn[]
): readonly GameAction[] {
    const last = actions.findLastIndex(
        (action) =>
            isDecisionPress(action, turnSeatAt(turns, action)) &&
            action.type !== ActionType.CollectLandscapes
    )
    return actions.slice(last + 1)
}

/** R-4.12 From the Actions, not `flow`: a host's batch publishes only its last state. */
export function roundEndOf(
    actions: readonly GameAction[],
    turns: readonly Turn[]
): RoundEndView | undefined {
    const recent = sinceLastDecision(actions, turns)
    const dawn = recent.find((action) => isBeginDawn(action))
    const metadata = isBeginDawn(dawn) ? dawn.metadata : undefined
    if (!metadata) {
        return undefined
    }
    return {
        dawn: {
            epoch: metadata.epoch,
            rows: metadata.sheet,
            fills: metadata.fills.map(fillLine)
        }
    }
}
