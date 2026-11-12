import type { GameAction, Turn } from '@tabletop/common'
import {
    ActionType,
    isBeginDawn,
    isReplenishGuilds,
    isReplenishMap,
    type BeginDawn,
    type Epoch,
    type ReplenishGuilds,
    type ReplenishMap
} from '@tabletop/feudum'
import { isDecisionPress, turnSeatAt } from '$lib/utils/decisionPress.js'
import { spaceLabel } from './cardFlows.js'

type DawnMetadata = NonNullable<BeginDawn['metadata']>
export type DawnSheetRow = DawnMetadata['sheet'][number]
type LandscapeFilled = DawnMetadata['fills'][number]
type MapGood = NonNullable<ReplenishMap['metadata']>['goods'][number]
type GuildRefill = NonNullable<ReplenishGuilds['metadata']>

export interface DawnSheetView {
    readonly epoch: Epoch
    /** R-4.12.1, R-4.12.2 One per seat, in turn order. */
    readonly rows: readonly DawnSheetRow[]
    /** R-4.12.3 The landscape fills, in the order they filled. */
    readonly fills: readonly string[]
    /** R-4.12.4, R-5 What came after: the map's new goods and the guild refill. */
    readonly notes: readonly string[]
}

/** R-4.11 The roll itself is the history's to tell; the action area keeps only the dawn's sheet. */
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

function refillLine(refill: GuildRefill): string {
    const parts: readonly (readonly [string, number])[] = [
        ['market', refill.market.length],
        ['carts', refill.carts.length],
        ['vessels', refill.vessels.length],
        ['knights', refill.knightRows.reduce((sum, { added }) => sum + added, 0)],
        ['scrolls', refill.scrolls.length],
        ['beads', refill.rosary.length],
        ['chickens', refill.chickens.length],
        ['barn', refill.barn.length]
    ]
    const named = parts.filter(([, count]) => count > 0).map(([name, count]) => `${count} ${name}`)
    return `Guilds refill: ${named.length > 0 ? named.join(', ') : 'nothing'}`
}

/**
 * The actions since the last press that opened a decision. A collection belongs to the dawn, and a
 * writ discarded at any time off the turn (R-4.4-H5) moves no decision on, so neither closes the sheet.
 */
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

/**
 * R-4.12 The dawn the round's end played, read from the Actions on the displayed state, not from
 * `flow`: the flow holds no dawn, and a host's batch publishes only its last state, so no state of the
 * machine ever shows one. It stands from the dawn until the first press of the next decision, the
 * same for every seat.
 */
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
    const notes = recent.flatMap((action) => {
        if (isReplenishMap(action) && action.metadata && action.metadata.goods.length > 0) {
            return [goodsLine(action.metadata.goods)]
        }
        return isReplenishGuilds(action) && action.metadata ? [refillLine(action.metadata)] : []
    })
    return {
        dawn: {
            epoch: metadata.epoch,
            rows: metadata.sheet,
            fills: metadata.fills.map(fillLine),
            notes
        }
    }
}
