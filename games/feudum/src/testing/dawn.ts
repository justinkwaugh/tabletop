import { assertExists, type GameAction } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import { RegionIds, type LandscapeKind, type TileId } from '../data/regionTiles.js'
import { MachineState } from '../definition/states.js'
import type { TriggeredEpoch } from '../model/flow.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { fillLandscape } from '../model/landscapes.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile, stackTop } from '../model/regionStacks.js'
import { collectTileOf, spaceOfKind } from './improving.js'
import { playOutCards, showOnStacks, type StackShowing } from './roundEnd.js'
import { tableAtPlayingCards, type Table } from './table.js'

/** R-4.11.2 Tops that trigger this epoch with no legal tile for the die, so no roll disturbs them. */
const Triggers: Readonly<
    Record<TriggeredEpoch, { readonly from: 1 | 2 | 3 | 4; readonly tops: readonly StackShowing[] }>
> = {
    2: { from: 1, tops: [2, 2, 2, 2, 2, 2] },
    3: { from: 2, tops: [3, 3, 3, 3, 3, 3] },
    4: { from: 3, tops: [4, 4, 4, 4, 4, 4] },
    5: { from: 4, tops: ['V', 4, 4, 4, 4, 4] }
}

export interface DawnTable {
    readonly table: Table
    /** The turn order the dawn saw; the next round can change the table's. */
    readonly order: readonly string[]
    /** What the last card set off: the roll, the dawn, as far as it runs. */
    readonly processed: GameAction[]
}

/**
 * R-4.11.2, R-4.12 A round of one forfeit each that triggers this epoch. `edit` sets the table while
 * the region stacks still hold their early tiles, so it can take a landscape from one.
 */
export function playToDawn(
    epoch: TriggeredEpoch,
    edit: (state: HydratedFeudumGameState, order: readonly string[]) => void = () => undefined,
    numPlayers = 3
): DawnTable {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), numPlayers)
    const { from, tops } = Triggers[epoch]
    const order = [...table.order]
    table.moveTo((state) => {
        edit(state, order)
        showOnStacks(state, tops)
        state.epoch = from
        return MachineState.PlayingCards
    })
    return { table, order, processed: playOutCards(table) }
}

export interface LandscapePlacing {
    readonly rulerId: string
    /** With none, the landscape is untended. */
    readonly serfId?: string
    /** With none, whichever first-epoch tile is on top: only two of a kind show at once. */
    readonly kind?: LandscapeKind
    /** Whether a first fill lies on it already. */
    readonly filled?: boolean
    readonly except?: readonly SpaceId[]
}

function takeTile(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: LandscapeKind | undefined
): TileId {
    if (kind) {
        return collectTileOf(state, playerId, kind)
    }
    const region = RegionIds.find((id) => stackTop(state, id)?.epoch === 1)
    assertExists(region, 'R-4.3.1 A first-epoch tile is on top')
    return collectTopTile(state, playerId, region).tile.id
}

/** R-4.3.4 A landscape on a farm, under this ruler. Returns its space. */
export function placeLandscape(
    state: HydratedFeudumGameState,
    { rulerId, serfId, kind, filled = false, except = [] }: LandscapePlacing
): SpaceId {
    const spaceId = spaceOfKind(state, 'farm', except)
    placeMarker(state, rulerId, spaceId)
    if (serfId) {
        placeMarker(state, serfId, spaceId)
    }
    const tileId = takeTile(state, rulerId, kind)
    const seat = state.getPlayerState(rulerId)
    seat.regionTiles = seat.regionTiles.filter((held) => held !== tileId)
    state.spaces[spaceId].landscape = { tileId, amount: 0 }
    if (filled) {
        fillLandscape(state, spaceId)
    }
    return spaceId
}
