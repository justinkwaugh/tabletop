import type { Point } from '@tabletop/common'
import type { HydratedKoggeGameState } from '@tabletop/kogge'
import type { BoardGeometry } from '$lib/board/geometry.js'
import { dockOffset } from './lanes.js'

const COG_DRAFT = 16

// Cogs moored at one harbour line up along the quay in seat order.
export function cogPosition(
    geometry: BoardGeometry,
    state: HydratedKoggeGameState,
    playerId: string
): Point | undefined {
    const city = state.findPlayerState(playerId)?.city
    if (city === undefined) {
        return undefined
    }
    const moored = state.players.filter((player) => player.city === city)
    const index = moored.findIndex((player) => player.playerId === playerId)
    const harbour = geometry.harbour(city)
    const offset = dockOffset(index, moored.length)
    return { x: harbour.x + offset.x, y: harbour.y + offset.y + COG_DRAFT }
}
