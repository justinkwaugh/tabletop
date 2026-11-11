import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    isBeginDawn,
    isDiscardWrit,
    isReplenishGuilds,
    isReplenishMap,
    isRollProgressDie,
    type BeginDawn,
    type Epoch,
    type ReplenishGuilds,
    type ReplenishMap
} from '@tabletop/feudum'
import { spaceLabel } from './cardFlows.js'
import { EpochNames, tileName } from './tileName.js'

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

export interface RoundEndView {
    /** R-4.11 What the die took, and the epoch it brought on. */
    readonly lines: readonly string[]
    readonly dawn?: DawnSheetView
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

function removedLine(tileId: Parameters<typeof tileName>[0]): string {
    const [region, epoch] = tileName(tileId).split(' ')
    return `${region}: tile ${epoch} removed`
}

/**
 * The actions since the last press that opened a decision. A collection belongs to the dawn, and a
 * writ discarded at any time (R-4.4-H5) moves no decision on, so neither closes the sheet.
 */
function sinceLastDecision(actions: readonly GameAction[]): readonly GameAction[] {
    const last = actions.findLastIndex(
        (action) =>
            action.source === ActionSource.User &&
            action.type !== ActionType.CollectLandscapes &&
            !isDiscardWrit(action)
    )
    return actions.slice(last + 1)
}

/**
 * R-4.11, R-4.12 What the round's end played, read from the Actions on the displayed state, not from
 * `flow`: the flow holds no dawn, and a host's batch publishes only its last state, so no state of the
 * machine ever shows one. It stands from the roll until the first press of the next decision, the
 * same for every seat.
 */
export function roundEndOf(actions: readonly GameAction[]): RoundEndView | undefined {
    const recent = sinceLastDecision(actions)
    const roll = recent.find((action) => isRollProgressDie(action))
    const dawn = recent.find((action) => isBeginDawn(action))
    const lines = [
        ...(isRollProgressDie(roll) && roll.metadata?.removed
            ? [removedLine(roll.metadata.removed.tileId)]
            : []),
        ...(isRollProgressDie(roll) && roll.metadata?.epochTriggered
            ? [`Epoch ${EpochNames[roll.metadata.epochTriggered]} dawns`]
            : [])
    ]
    const metadata = isBeginDawn(dawn) ? dawn.metadata : undefined
    if (lines.length === 0 && !metadata) {
        return undefined
    }
    const notes = recent.flatMap((action) => {
        if (isReplenishMap(action) && action.metadata && action.metadata.goods.length > 0) {
            return [goodsLine(action.metadata.goods)]
        }
        return isReplenishGuilds(action) && action.metadata ? [refillLine(action.metadata)] : []
    })
    return {
        lines,
        ...(metadata
            ? {
                  dawn: {
                      epoch: metadata.epoch,
                      rows: metadata.sheet,
                      fills: metadata.fills.map(fillLine),
                      notes
                  }
              }
            : {})
    }
}
