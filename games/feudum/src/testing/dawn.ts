import { assertExists, type GameAction } from '@tabletop/common'
import { nourishOffer } from '../actions/nourish.js'
import type { SpaceId } from '../data/board.js'
import { ActionType } from '../definition/actions.js'
import type { LandscapeKind, TileId } from '../data/regionTiles.js'
import { MachineState } from '../definition/states.js'
import type { Epoch } from '../data/tracks.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { fillLandscape } from '../model/landscapes.js'
import { placeMarker } from '../model/locationControl.js'
import { collectTopTile } from '../model/regionStacks.js'
import { collectTileOf, spaceOfKind } from './improving.js'
import { firstEpochRegions, playOutCards, showOnStacks, type StackShowing } from './roundEnd.js'
import { epochAt } from './state.js'
import { tableAtPlayingCards, type Table } from './table.js'

/** R-4.11.2 Tops that trigger this epoch with no legal tile for the die, so no roll disturbs them. */
const Triggers: Readonly<
    Record<Exclude<Epoch, 1>, { readonly from: Epoch; readonly tops: readonly StackShowing[] }>
> = {
    2: { from: 1, tops: [2, 2, 2, 2, 2, 2] },
    3: { from: 2, tops: [3, 3, 3, 3, 3, 3] },
    4: { from: 3, tops: [4, 4, 4, 4, 4, 4] },
    5: { from: 4, tops: ['V', 4, 4, 4, 4, 4] }
}

export interface DawnTable {
    readonly table: Table
    readonly order: readonly string[]
    readonly processed: GameAction[]
}

/** R-4.11.2, R-4.12 A round that triggers this epoch; `edit` runs while the early tiles are on the stacks. */
export function playToDawn(
    epoch: Exclude<Epoch, 1>,
    edit: (state: HydratedFeudumGameState, order: readonly string[]) => void = () => undefined,
    numPlayers = 3
): DawnTable {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), numPlayers)
    const { from, tops } = Triggers[epoch]
    const order = [...table.order]
    table.moveTo((state) => {
        edit(state, order)
        showOnStacks(state, tops)
        state.epoch = epochAt(from)
        return MachineState.PlayingCards
    })
    const processed = playOutCards(table)
    while (table.state.machineState === MachineState.Nourishing) {
        const playerId = table.asked
        const offer = nourishOffer(table.hydrated(), playerId)
        assertExists(offer, 'R-4.4-H1 The seat nourishing waits on decides its feeding')
        processed.push(...table.send(playerId, { type: ActionType.Nourish, ...offer.preselected }))
    }
    return { table, order, processed }
}

export interface LandscapePlacing {
    readonly rulerId: string
    readonly serfId?: string
    readonly kind?: LandscapeKind
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
    const [region] = firstEpochRegions(state)
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
