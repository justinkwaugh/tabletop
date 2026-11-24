import { assertExists } from '@tabletop/common'
import {
    type HydratedFeudumGameState,
    type LandscapeKind,
    placeMarker,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'

/** R-4.2 What a hand arranges for a Move: a vessel, a monster, a landscape to pilfer from. */

/** R-1.1 */
export function giveVessel(state: HydratedFeudumGameState, playerId: string, vessel: VesselType) {
    state.supply.vessels[vessel] -= 1
    state.getPlayerState(playerId).vessels[vessel] += 1
}

/** R-1.1 */
export function abandonVessel(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    vessel: VesselType
) {
    state.supply.vessels[vessel] -= 1
    state.spaces[spaceId].vessels[vessel] += 1
}

/** R-4.2.3 The Alchemist's vessels go back to the supply, so the ferries run. */
export function sellOut(state: HydratedFeudumGameState) {
    for (const vessel of state.guilds.alchemist.vesselsForSale) {
        state.supply.vessels[vessel] += 1
    }
    state.guilds.alchemist.vesselsForSale = []
}

/** R-4.3.4 A tile of this landscape leaves its stack, shown, on the space, holding one. */
export function landscapeOn(state: HydratedFeudumGameState, spaceId: SpaceId, kind: LandscapeKind) {
    const { tileLandscapes } = state.requireVault()
    const stack = Object.values(state.regionStacks).find((tiles) =>
        tiles.some((tile) => tileLandscapes[tile] === kind)
    )
    const tileId = stack?.find((tile) => tileLandscapes[tile] === kind)
    assertExists(stack, `R-1.4 A stack holds a ${kind}`)
    assertExists(tileId, `R-1.4 A stack holds a ${kind}`)
    stack.splice(stack.indexOf(tileId), 1)
    delete tileLandscapes[tileId]
    state.tileLandscapes[tileId] = kind
    state.spaces[spaceId].landscape = { tileId, amount: 1 }
    if (kind === 'archery-butt') {
        state.supply.targets -= 1
    }
}

/** R-4.1.2 The first marker rules; a different seat's marker is the serf. */
export function serfOn(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    ruler: string,
    serf: string
) {
    placeMarker(state, ruler, spaceId)
    placeMarker(state, serf, spaceId)
}
