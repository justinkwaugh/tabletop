import * as Type from 'typebox'
import { GuildIds, type GuildId } from '../data/components.js'
import {
    GuildById,
    GuildRanks,
    GuildTrackSpaces,
    StatusStarValues,
    type GuildRank
} from '../data/guilds.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { GuildTrack } from './guildsState.js'
import { feudumGuildOf, locationKindOf } from './locationDiscs.js'
import { GuildIdSchema } from './stateSchemas.js'

/** R-4.5 What one recompute did to one player in one guild, for an Action's metadata. */
export type RankChange = Type.Static<typeof RankChange>
export const RankChange = Type.Object({
    guildId: GuildIdSchema,
    playerId: Type.String(),
    from: Type.Optional(Type.Enum(GuildRanks)),
    to: Type.Optional(Type.Enum(GuildRanks)),
    /** R-4.7 */
    reeveReturned: Type.Optional(Type.Literal(true))
})

/** R-1.3 Best rank first. */
const RanksFromTop: readonly GuildRank[] = [...GuildRanks].reverse()

/** R-4.5.1 Derived: only a primary star lets related locations count; monsters give none. */
export function statusStars(
    state: HydratedFeudumGameState,
    playerId: string,
    guildId: GuildId
): number {
    const pawns = state
        .getPlayerState(playerId)
        .pawns.filter((pawn) => pawn.spaceId !== undefined && pawn.character === guildId)
    const ruled = state.ruledSpaceIds(playerId).map((spaceId) => state.spaces[spaceId].location)
    const feudums = ruled.filter((location) => feudumGuildOf(location) === guildId)
    const primary = pawns.length * StatusStarValues.pawn + feudums.length * StatusStarValues.feudum
    if (primary === 0) {
        return 0
    }
    const { relatedLocation } = GuildById[guildId]
    const related = ruled.filter((location) => locationKindOf(location) === relatedLocation)
    return primary + related.length * StatusStarValues.relatedLocation
}

/** R-4.5.2 A marker on the track is membership. */
export function rankOf(track: GuildTrack, playerId: string): GuildRank | undefined {
    return RanksFromTop.find((rank) => track[rank]?.playerId === playerId)
}

/** R-4.5.3 The ranks a guild's track uses at this player count, best first. */
export function ranksInPlay(numPlayers: number): GuildRank[] {
    return RanksFromTop.filter((rank) =>
        GuildTrackSpaces.some((space) => space.rank === rank && numPlayers >= space.minPlayers)
    )
}

/** R-4.5-H2 The acting player first, then turn order from them; with none, from the start. */
function tieOrder(state: HydratedFeudumGameState, actingPlayerId?: string): string[] {
    const order = state.turnManager.turnOrder
    const start = actingPlayerId === undefined ? 0 : Math.max(order.indexOf(actingPlayerId), 0)
    return [...order.slice(start), ...order.slice(0, start)]
}

/** R-4.5.3, R-4.5-H1, R-4.5-H2, R-4.7 Returns whether the track changed. */
function rankGuild(state: HydratedFeudumGameState, guildId: GuildId, order: string[]): boolean {
    const previous = state.guilds.tracks[guildId]
    const heldIndex = (playerId: string): number => {
        const rank = rankOf(previous, playerId)
        return rank ? RanksFromTop.indexOf(rank) : RanksFromTop.length
    }
    const stars = new Map(
        order.map((playerId) => [playerId, statusStars(state, playerId, guildId)])
    )
    const starsOf = (playerId: string): number => stars.get(playerId) ?? 0

    const ranks = ranksInPlay(state.players.length)
    const ranked = order
        .filter(
            (playerId) =>
                starsOf(playerId) > 0 &&
                (rankOf(previous, playerId) !== undefined ||
                    state.getPlayerState(playerId).influenceSupply > 0)
        )
        .sort((a, b) => starsOf(b) - starsOf(a) || heldIndex(a) - heldIndex(b))
        .slice(0, ranks.length)
    if (ranks.every((rank, index) => previous[rank]?.playerId === ranked[index])) {
        return false
    }

    const next: GuildTrack = {}
    ranked.forEach((playerId, index) => {
        const rank = ranks[index]
        const held = rankOf(previous, playerId)
        next[rank] = {
            playerId,
            reeve: rank !== 'apprentice' && held !== undefined && (previous[held]?.reeve ?? false)
        }
    })
    state.guilds.tracks[guildId] = next
    for (const playerId of order) {
        const wasMember = rankOf(previous, playerId) !== undefined
        const isMember = rankOf(next, playerId) !== undefined
        state.getPlayerState(playerId).influenceSupply += Number(wasMember) - Number(isMember)
    }
    return true
}

/** R-4.5 */
function trackChanges(
    guildId: GuildId,
    before: GuildTrack,
    after: GuildTrack,
    order: string[]
): RankChange[] {
    return order.flatMap((playerId): RankChange[] => {
        const from = rankOf(before, playerId)
        const to = rankOf(after, playerId)
        if (from === to) {
            return []
        }
        const reeveReturned = from && before[from]?.reeve && !(to && after[to]?.reeve)
        return [
            {
                guildId,
                playerId,
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
                ...(reeveReturned ? { reeveReturned: true } : {})
            }
        ]
    })
}

/** R-4.5.4, R-4.5-H1, R-4.5.2, R-4.5-H3 Starts over after each change. Returns the net changes. */
export function recomputeRanks(
    state: HydratedFeudumGameState,
    actingPlayerId?: string
): RankChange[] {
    const order = tieOrder(state, actingPlayerId)
    const before = GuildIds.map((guildId) => state.guilds.tracks[guildId])
    for (let changed = true; changed;) {
        changed = GuildIds.some((guildId) => rankGuild(state, guildId, order))
    }
    return GuildIds.flatMap((guildId, index) =>
        trackChanges(guildId, before[index], state.guilds.tracks[guildId], order)
    )
}
