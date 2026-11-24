import {
    GuildById,
    GuildIds,
    rankOf,
    ranksInPlay,
    type GuildId,
    type GuildRank,
    type HydratedFeudumGameState
} from '@tabletop/feudum'
import { seatOrder } from './seatPanel.js'

/** Contract, Guild standings: no rank is recomputed; the track holds the places (R-4.5-H1). */

export interface StandingHolder {
    readonly playerId: string
    readonly name: string
    readonly stars: number
    readonly reeve: boolean
}

export interface StandingPlace {
    readonly rank: GuildRank
    readonly holder: StandingHolder | undefined
    readonly label: string
}

/** R-4.5.2 With no marker in supply a seat cannot join; with one, it is outranked off the track. */
export type PlacelessReason = 'no marker' | 'outranked'

export interface StandingOther {
    readonly playerId: string
    readonly name: string
    readonly stars: number
    readonly reason: PlacelessReason
    readonly label: string
}

export interface StandingRow {
    readonly guild: GuildId
    readonly name: string
    readonly places: readonly StandingPlace[]
    readonly others: readonly StandingOther[]
    readonly othersLabel: string
}

export interface GuildStandingsView {
    /** R-4.5.3 An apprentice only at four or five seats. */
    readonly ranks: readonly GuildRank[]
    readonly rows: readonly StandingRow[]
}

function starsSaid(stars: number): string {
    return `${stars} ${stars === 1 ? 'star' : 'stars'}`
}

export function guildStandingsOf(
    state: HydratedFeudumGameState,
    nameOf: (playerId: string) => string
): GuildStandingsView {
    const seats = seatOrder(state)
    const ranks = ranksInPlay(seats.length)
    const rows = GuildIds.map((guild): StandingRow => {
        const track = state.guilds.tracks[guild]
        const guildName = GuildById[guild].name
        const places = ranks.map((rank): StandingPlace => {
            const held = track[rank]
            if (!held) {
                return { rank, holder: undefined, label: `${guildName} ${rank}: vacant` }
            }
            const holder = {
                playerId: held.playerId,
                name: nameOf(held.playerId),
                stars: state.statusStars(held.playerId, guild),
                reeve: held.reeve
            }
            const reeve = holder.reeve ? ', reeve' : ''
            return {
                rank,
                holder,
                label: `${guildName} ${rank}: ${holder.name}, ${starsSaid(holder.stars)}${reeve}`
            }
        })
        const others = seats.flatMap((playerId): StandingOther[] => {
            const stars = state.statusStars(playerId, guild)
            if (stars === 0 || rankOf(track, playerId) !== undefined) {
                return []
            }
            const name = nameOf(playerId)
            const reason: PlacelessReason =
                state.getPlayerState(playerId).influenceSupply > 0 ? 'outranked' : 'no marker'
            return [
                { playerId, name, stars, reason, label: `${name}, ${starsSaid(stars)}, ${reason}` }
            ]
        })
        const othersSaid = others.map(({ label }) => label).join('; ') || 'none'
        return {
            guild,
            name: guildName,
            places,
            others,
            othersLabel: `${guildName}, no place: ${othersSaid}`
        }
    })
    return { ranks, rows }
}
