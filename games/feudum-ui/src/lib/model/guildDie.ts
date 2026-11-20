import { GuildById, type GuildId, type GuildRank } from '@tabletop/feudum'

/** R-4.5 The rank a pick would give, or none: the track has no place left for it. */
export type DieRank = GuildRank | 'none'

export interface DieArt {
    readonly kind: 'die'
    readonly guild: GuildId
    readonly rank?: DieRank
}

export const RankBadges: Readonly<Record<DieRank, string>> = {
    master: 'M',
    journeyman: 'J',
    apprentice: 'A',
    none: '–'
}

export function dieLabel(guild: GuildId, rank?: DieRank): string {
    const name = GuildById[guild].name
    return rank === undefined ? name : `${name}, ${rank === 'none' ? 'no rank' : rank}`
}

export function rankedDie(
    guild: GuildId,
    rank: GuildRank | undefined
): { readonly label: string; readonly art: DieArt } {
    const badge: DieRank = rank ?? 'none'
    return { label: dieLabel(guild, badge), art: { kind: 'die', guild, rank: badge } }
}
