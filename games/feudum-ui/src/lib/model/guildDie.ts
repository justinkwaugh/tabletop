import { GuildById, type GuildId, type GuildRank } from '@tabletop/feudum'

/** R-4.5 The rank a pick would give, or none: the track has no place left for it. */
export type DieRank = GuildRank | 'none'

/**
 * A guild as its progress-die face. `rank`, when present, is the badge on the die's corner: the
 * rank this pick would give. A choice that gives no rank of its own carries no badge.
 */
export interface DieArt {
    readonly kind: 'die'
    readonly guild: GuildId
    readonly rank?: DieRank
}

/** The die's corner badge: M, J or A, and a dash for no rank. */
export const RankBadges: Readonly<Record<DieRank, string>> = {
    master: 'M',
    journeyman: 'J',
    apprentice: 'A',
    none: '–'
}

/** What a die choice is called: its accessible name and tooltip, "Farmer, journeyman". */
export function dieLabel(guild: GuildId, rank?: DieRank): string {
    const name = GuildById[guild].name
    return rank === undefined ? name : `${name}, ${rank === 'none' ? 'no rank' : rank}`
}

/** A guild choice that gives a rank: its label and its die, badged with that rank or none. */
export function rankedDie(
    guild: GuildId,
    rank: GuildRank | undefined
): { readonly label: string; readonly art: DieArt } {
    const badge: DieRank = rank ?? 'none'
    return { label: dieLabel(guild, badge), art: { kind: 'die', guild, rank: badge } }
}
