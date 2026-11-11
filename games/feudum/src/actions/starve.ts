import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import type { SpaceId } from '../data/board.js'
import { ChickenSpaces } from '../data/guilds.js'
import type { SealId } from '../data/seals.js'
import type { StarveRole } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import type { SpaceState } from '../model/mapState.js'
import { canCoverWithWildTiles, type GoodPrice } from '../model/payments.js'
import { beadToSeal } from '../model/seals.js'
import { SealIdSchema } from '../model/stateSchemas.js'
import { defenderAsked } from './combat.js'

/** R-3.14.2 "Turn in a food." */
export const ImmunityFood: GoodPrice = { food: 1 }

/** R-3.13.2 What a Starve that resolved changed, beyond the marker its input names. */
export type StarveRecord = Type.Static<typeof StarveRecord>
export const StarveRecord = Type.Object({
    /** R-3.13.2 The beads that left the chickens for the pile, public until they went. */
    beads: Type.Array(SealIdSchema),
    /** R-4.5.4 */
    rankChanges: Type.Array(RankChange)
})

/** R-3.13.2 A starvable marker's roles, in the order the offers read them. */
export const StarveRoles: readonly StarveRole[] = ['subject', 'serf']

/** R-3.13.2 The player whose marker lies in this role on the space. */
export function markerPlayerId(space: SpaceState, role: StarveRole): string | undefined {
    if (role === 'serf') {
        return space.serf?.playerId
    }
    return space.ruler?.subject ? space.ruler.playerId : undefined
}

/** R-3.14.2 A seal lies under the marker in this role. */
export function markerImmune(space: SpaceState, role: StarveRole): boolean {
    return (role === 'serf' ? space.serf?.immune : space.ruler?.subjectImmune) === true
}

/**
 * R-3.14-H3, R-3.14-H4 Royal Immunity could be paid for and placed, from what the table can see: a
 * food or a tile to bring one, and a seal in the pile.
 */
function immunityInReach(state: HydratedFeudumGameState, playerId: string): boolean {
    return canCoverWithWildTiles(state, playerId, ImmunityFood) && state.supply.sealPileCount > 0
}

/** R-3.14-H1, D1 Whether a Starve asks: public state cannot rule out Royal Immunity. */
export function starveAsks(state: HydratedFeudumGameState, playerId: string): boolean {
    return defenderAsked(state, playerId) && immunityInReach(state, playerId)
}

/** R-3.13.2 Every chicken bead flips back into the vault, into the pile, which reshuffles. */
function chickenBeadsToPile(state: HydratedFeudumGameState): SealId[] {
    const beads: SealId[] = []
    for (const { id: space } of ChickenSpaces) {
        const bead = state.guilds.farmer.chickens[space]
        if (bead !== null) {
            beadToSeal(state, bead, { kind: 'chicken', space }, { kind: 'pile' })
            beads.push(bead)
        }
    }
    return beads
}

/**
 * R-3.13.2, R-4.9-H1 The marker goes home, unopposed and for no vp; then the chicken beads go to the
 * pile, status is recomputed and the military follow-up queued.
 */
export function resolveStarve(
    state: HydratedFeudumGameState,
    target: {
        readonly actorId: string
        readonly targetPlayerId: string
        readonly spaceId: SpaceId
        readonly role: StarveRole
    }
): StarveRecord {
    const { actorId, targetPlayerId, spaceId, role } = target
    const space = state.spaces[spaceId]
    assert(
        markerPlayerId(space, role) === targetPlayerId,
        `R-3.13.2 ${targetPlayerId} has a ${role} on ${spaceId}`
    )
    if (role === 'serf') {
        space.serf = undefined
    } else {
        assertExists(space.ruler, 'R-3.13.2 A subject has a ruler')
        space.ruler.subject = false
    }
    state.getPlayerState(targetPlayerId).influenceSupply += 1
    const beads = chickenBeadsToPile(state)
    const rankChanges = state.recomputeRanks(actorId)
    queueFollowUp(state, { kind: 'military', playerId: actorId })
    return { beads, rankChanges }
}
