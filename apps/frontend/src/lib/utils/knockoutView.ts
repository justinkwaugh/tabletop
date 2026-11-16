import {
    knockoutBracket,
    knockoutResultsOf,
    knockoutRoundName,
    type KnockoutBracket,
    type KnockoutMatch,
    type TournamentDetail,
    type TournamentSchedule
} from '@tabletop/common'

/** Fields above this size show the Bracket a round at a time. */
export const KNOCKOUT_ROUND_VIEW_ABOVE = 16

/** The Bracket as the page shows it, from the results the tournament detail carries. */
export function knockoutBracketOf(
    detail: TournamentDetail,
    schedule: TournamentSchedule
): KnockoutBracket | undefined {
    if (!schedule.bracket) return undefined
    const links = new Map((detail.games ?? []).map((game) => [game.tableId, game]))
    return knockoutBracket(
        schedule,
        knockoutResultsOf(detail.tournament, (tableId) => links.get(tableId)?.winningUserIds)
    )
}

/** The earliest round still being played, or the final once the Bracket is decided. */
export function knockoutCurrentRound(bracket: KnockoutBracket): number {
    const open = bracket.rounds.find((matches) =>
        matches.some((match) => match.winnerId === undefined)
    )
    return open?.[0].round ?? bracket.rounds.length
}

/** The Match an Entrant is playing or waiting for, if they are still in. */
export function knockoutCurrentMatch(
    bracket: KnockoutBracket,
    userId: string
): KnockoutMatch | undefined {
    return bracket.rounds
        .flat()
        .find((match) => match.winnerId === undefined && match.sides.includes(userId))
}

export interface KnockoutPlayerStatus {
    text: string
    out: boolean
}

function roundPhrase(round: number, rounds: number): string {
    const name = knockoutRoundName(round, rounds)
    return round >= rounds - 2 ? `the ${name.toLowerCase()}` : name.toLowerCase()
}

/** Where an Entrant stands: through to a round, or out in one. */
export function knockoutPlayerStatus(
    bracket: KnockoutBracket,
    userId: string
): KnockoutPlayerStatus {
    const rounds = bracket.rounds.length
    if (bracket.championId === userId) return { text: 'Champion', out: false }
    let reached: KnockoutMatch | undefined
    for (const match of bracket.rounds.flat()) if (match.sides.includes(userId)) reached = match
    if (!reached) return { text: '', out: true }
    const lost = reached.winnerId !== undefined && reached.winnerId !== userId
    if (lost && reached.round === rounds) return { text: 'Runner-up', out: true }
    if (lost) return { text: `Out in ${roundPhrase(reached.round, rounds)}`, out: true }
    return { text: `In ${roundPhrase(reached.round, rounds)}`, out: false }
}
