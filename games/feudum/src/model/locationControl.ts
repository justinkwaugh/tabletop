import { assert } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { SpaceState } from './mapState.js'
import { immunitySealFollowsMarker } from './seals.js'

export type MarkerRole = 'ruler' | 'serf' | 'subject'

/** R-3.6.1, R-4.6.3 The seat's pawns and markers on the map; a monster is neither (FAQ official). */
export function presenceSpaceIds(state: HydratedFeudumGameState, playerId: string): SpaceId[] {
    const stood = new Set(
        state.getPlayerState(playerId).pawns.flatMap((pawn) => pawn.spaceId ?? [])
    )
    return Spaces.map((space) => space.id).filter((spaceId) => {
        const { ruler, serf } = state.spaces[spaceId]
        return stood.has(spaceId) || ruler?.playerId === playerId || serf?.playerId === playerId
    })
}

/**
 * R-4.1.1, R-4.1.2 The role this player would take by adding a marker, or none when the space
 * refuses it: at most 3 markers, from at most 2 players, at most 2 from one player.
 */
export function nextMarkerRole(space: SpaceState, playerId: string): MarkerRole | undefined {
    const { ruler, serf } = space
    if (!ruler) {
        return 'ruler'
    }
    if (ruler.playerId === playerId) {
        return ruler.subject ? undefined : 'subject'
    }
    if (!serf) {
        return 'serf'
    }
    return serf.playerId === playerId && !ruler.subject ? 'ruler' : undefined
}

/** R-4.1.1, R-4.5.2 */
export function canPlaceMarker(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): boolean {
    return (
        state.getPlayerState(playerId).influenceSupply > 0 &&
        nextMarkerRole(state.spaces[spaceId], playerId) !== undefined
    )
}

/**
 * R-4.1.2 Adds a marker from the player's supply and returns the role it gives them. A change of
 * ruler moves status stars: the caller recomputes ranks (R-4.5.4).
 */
export function placeMarker(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId
): MarkerRole {
    const space = state.spaces[spaceId]
    const role = nextMarkerRole(space, playerId)
    assert(role, `R-4.1.1 ${spaceId} takes no marker from ${playerId}`)
    const player = state.getPlayerState(playerId)
    assert(player.influenceSupply > 0, `R-4.1 ${playerId} has no marker in supply`)
    player.influenceSupply -= 1

    const { ruler, serf } = space
    if (role === 'serf') {
        space.serf = { playerId }
    } else if (ruler && role === 'subject') {
        ruler.subject = true
    } else if (ruler && serf) {
        // R-4.1.2, R-4.1-H1 The serf's marker becomes the subject, with any seal under it.
        if (serf.immune) {
            immunitySealFollowsMarker(state, spaceId)
        }
        space.ruler = {
            playerId,
            subject: true,
            ...(serf.immune ? { subjectImmune: true } : {})
        }
        space.serf = { playerId: ruler.playerId }
    } else {
        space.ruler = { playerId, subject: false }
    }
    return role
}

/** R-4.1.3 Derived: a landscape belongs to the current serf; with no serf it is untended. */
export function landscapeTender(space: SpaceState): string | undefined {
    return space.landscape ? space.serf?.playerId : undefined
}
