import type {
    TournamentMatchGame,
    TournamentSchedule,
    TournamentTable
} from './tournamentSchedule.js'
import type { Tournament } from './tournament.js'

/** The Games of a Match before a Decider: one from each Starting Position. */
export const KNOCKOUT_MATCH_GAMES = 2

/** A Match's place: an Entrant, empty (`null`), or not decided yet (`undefined`). */
export type KnockoutSide = string | null | undefined

export interface KnockoutMatchGame {
    game: number
    table?: Pick<TournamentTable, 'id' | 'entrantIds'>
    // The Entrants credited with the win; absent until the Game has a counted result.
    winnerIds?: readonly string[]
}

export interface KnockoutMatch {
    round: number
    index: number
    sides: [KnockoutSide, KnockoutSide]
    games: KnockoutMatchGame[]
    score: [number, number]
    // The Entrant who advances, `null` when nobody does, `undefined` while undecided.
    winnerId?: string | null
    decidedBy?: 'play' | 'bye' | 'walkover'
}

export interface KnockoutTableDue {
    match: TournamentMatchGame
    entrantIds: [string, string]
}

export interface KnockoutBracket {
    rounds: KnockoutMatch[][]
    // The final's winner, `null` when nobody won it, `undefined` while it is undecided.
    championId?: string | null
    finished: boolean
    // Tables the Bracket needs that the Schedule does not hold yet, in Bracket order.
    due: KnockoutTableDue[]
}

export interface KnockoutResults {
    // Winners, by Entrant, of each Table with a counted result.
    winners: ReadonlyMap<string, readonly string[]>
    voided: ReadonlySet<string>
    withdrawn: ReadonlySet<string>
}

/**
 * A Knockout's results from its Stage's dispatch and each Table's credited winners. A Table
 * dispatch has finished but whose winners are not known yet is listed as unsettled.
 */
export function knockoutResultsOf(
    tournament: Pick<Tournament, 'stages' | 'entrants'>,
    winnersOf: (tableId: string) => readonly string[] | undefined
): KnockoutResults & { unsettled: string[] } {
    const dispatch = tournament.stages[0]?.dispatch
    const winners = new Map<string, readonly string[]>()
    const unsettled: string[] = []
    for (const tableId of dispatch?.finished ?? []) {
        const winnerIds = winnersOf(tableId)
        if (winnerIds?.length) winners.set(tableId, winnerIds)
        else unsettled.push(tableId)
    }
    return {
        winners,
        unsettled,
        voided: new Set(dispatch?.voided ?? []),
        withdrawn: new Set(
            tournament.entrants
                .filter((entrant) => entrant.withdrawn)
                .map((entrant) => entrant.userId)
        )
    }
}

export function knockoutBracketSize(entrants: number): number {
    let size = 2
    while (size < entrants) size *= 2
    return size
}

/** Standard seeding: seed 1 meets the last seed, and the top two seeds can meet only in the final. */
export function knockoutSeedPositions(size: number): number[] {
    let order = [1]
    while (order.length < size) {
        const next = order.length * 2 + 1
        order = order.flatMap((seed) => [seed, next - seed])
    }
    return order
}

/** Places Entrants, in seed order, into a Bracket's first round; the missing seeds are Byes. */
export function knockoutSlots(seedOrder: readonly string[]): (string | null)[] {
    return knockoutSeedPositions(knockoutBracketSize(seedOrder.length)).map(
        (seed) => seedOrder[seed - 1] ?? null
    )
}

export function knockoutRoundCount(slots: readonly unknown[]): number {
    return Math.log2(slots.length)
}

export function knockoutRoundName(round: number, rounds: number): string {
    if (round === rounds) return 'Final'
    if (round === rounds - 1) return 'Semi-finals'
    if (round === rounds - 2) return 'Quarter-finals'
    return `Round ${round}`
}

/** A Game's short label in a Match: G1, G2, then D for the Decider and D2 on. */
export function knockoutGameLabel(game: number): string {
    if (game <= KNOCKOUT_MATCH_GAMES) return `G${game}`
    return game === KNOCKOUT_MATCH_GAMES + 1 ? 'D' : `D${game - KNOCKOUT_MATCH_GAMES}`
}

export function knockoutGameName(game: number): string {
    if (game <= KNOCKOUT_MATCH_GAMES) return `Game ${game}`
    return game === KNOCKOUT_MATCH_GAMES + 1 ? 'Decider' : `Decider ${game - KNOCKOUT_MATCH_GAMES}`
}

export function knockoutDecider(match: Pick<TournamentMatchGame, 'game'>): boolean {
    return match.game > KNOCKOUT_MATCH_GAMES
}

export function knockoutTableName(match: TournamentMatchGame, rounds: number): string {
    return `${knockoutMatchName(match, rounds)} · ${knockoutGameName(match.game)}`
}

export function knockoutMatchName(
    match: Pick<TournamentMatchGame, 'round' | 'index'>,
    rounds: number
): string {
    const round = knockoutRoundName(match.round, rounds)
    if (match.round === rounds) return round
    // Semi-finals → Semi-final 1; numbered rounds keep their name and number the Match.
    return round.endsWith('s')
        ? `${round.slice(0, -1)} ${match.index + 1}`
        : `${round} · Match ${match.index + 1}`
}

/**
 * Plays out a Knockout's Bracket from its draw and the results so far: who has met whom, who
 * advanced, and which Tables are due. A withdrawn Entrant's place counts as empty from their
 * current Match on, so their opponent advances by Walkover.
 */
export function knockoutBracket(
    schedule: Pick<TournamentSchedule, 'bracket' | 'tables'>,
    results: KnockoutResults
): KnockoutBracket {
    const slots = schedule.bracket?.slots
    if (!slots) throw new Error('A knockout schedule needs its draw')
    const rounds = knockoutRoundCount(slots)
    if (!Number.isInteger(rounds) || rounds < 1) throw new Error('A bracket is a power of two')
    const tablesByMatch = new Map<string, TournamentTable[]>()
    for (const table of schedule.tables) {
        if (!table.match) continue
        const key = matchKey(table.match.round, table.match.index)
        tablesByMatch.set(key, [...(tablesByMatch.get(key) ?? []), table])
    }
    const due: KnockoutTableDue[] = []
    const played: KnockoutMatch[][] = []
    let previous: KnockoutMatch[] | undefined
    for (let round = 1; round <= rounds; round++) {
        const count = 2 ** (rounds - round)
        const matches: KnockoutMatch[] = []
        for (let index = 0; index < count; index++) {
            const sides: [KnockoutSide, KnockoutSide] = previous
                ? [previous[2 * index].winnerId, previous[2 * index + 1].winnerId]
                : [slots[2 * index], slots[2 * index + 1]]
            matches.push(
                playMatch(
                    round,
                    index,
                    sides,
                    tablesByMatch.get(matchKey(round, index)) ?? [],
                    results,
                    due
                )
            )
        }
        played.push(matches)
        previous = matches
    }
    const championId = played[rounds - 1][0].winnerId
    return { rounds: played, championId, finished: championId !== undefined, due }
}

function matchKey(round: number, index: number) {
    return `${round}:${index}`
}

function playMatch(
    round: number,
    index: number,
    sides: [KnockoutSide, KnockoutSide],
    tables: TournamentTable[],
    results: KnockoutResults,
    due: KnockoutTableDue[]
): KnockoutMatch {
    const match: KnockoutMatch = { round, index, sides, games: [], score: [0, 0] }
    const [first, second] = sides
    // An empty place against one still to be decided: whoever arrives advances.
    if (first === undefined || second === undefined) return match
    if (first === null || second === null) {
        const entrantId = first ?? second
        const withdrawn = entrantId !== null && results.withdrawn.has(entrantId)
        match.winnerId = withdrawn ? null : entrantId
        // Only the draw leaves Byes; a later empty place is a feeding Match nobody won.
        match.decidedBy = round === 1 && !withdrawn ? 'bye' : 'walkover'
        return match
    }
    const pending: KnockoutTableDue[] = []
    playGames(match, [first, second], tables, results, pending)
    // A Match already won stands; a withdrawal forfeits only the Match still being played.
    if (match.winnerId !== undefined) return match
    const firstIn = !results.withdrawn.has(first)
    const secondIn = !results.withdrawn.has(second)
    if (!firstIn || !secondIn) {
        match.winnerId = firstIn ? first : secondIn ? second : null
        match.decidedBy = 'walkover'
        match.games = match.games.filter((game) => game.table)
        return match
    }
    due.push(...pending)
    return match
}

function playGames(
    match: KnockoutMatch,
    [first, second]: [string, string],
    tables: TournamentTable[],
    results: KnockoutResults,
    due: KnockoutTableDue[]
) {
    const { round, index } = match
    const seats = (game: number): [string, string] =>
        game <= KNOCKOUT_MATCH_GAMES && game % 2 === 0 ? [second, first] : [first, second]
    const games = new Map(countedGames(tables, results).map((game) => [game.game, game]))
    const award = (winnerIds: readonly string[]) => {
        ;[first, second].forEach((side, position) => {
            if (winnerIds.includes(side)) match.score[position] += 1 / winnerIds.length
        })
    }
    let level = true
    let open = false
    for (let game = 1; level; game++) {
        const played = games.get(game)
        match.games.push(played ?? { game })
        if (!played?.table) {
            due.push({ match: { round, index, game }, entrantIds: seats(game) })
            open = true
        } else if (played.winnerIds) {
            award(played.winnerIds)
        } else {
            open = true
        }
        // The first two Games are played together, then one Decider at a time.
        if (game < KNOCKOUT_MATCH_GAMES) continue
        if (open) break
        level = match.score[0] === match.score[1]
    }
    if (!open) {
        match.winnerId = match.score[0] > match.score[1] ? first : second
        match.decidedBy = 'play'
    }
}

/** Each Game of a Match by number, at its latest Table that is not void. */
function countedGames(tables: TournamentTable[], results: KnockoutResults): KnockoutMatchGame[] {
    const byGame = new Map<number, KnockoutMatchGame>()
    for (const table of tables) {
        if (!table.match || results.voided.has(table.id)) continue
        const winnerIds = results.winners.get(table.id)
        byGame.set(table.match.game, {
            game: table.match.game,
            table,
            ...(winnerIds?.length ? { winnerIds } : {})
        })
    }
    return [...byGame.values()].sort((a, b) => a.game - b.game)
}

/**
 * Ranks the Entrants still ranked by the round they reached: the champion first, then the
 * runner-up, then each round's losers together. Entrants still in play rank ahead of those who
 * went out in the same round.
 */
export function knockoutPlacings(bracket: KnockoutBracket, entrantIds: readonly string[]) {
    const rounds = bracket.rounds.length
    const reach = new Map<string, { round: number; alive: boolean }>()
    for (const matches of bracket.rounds) {
        for (const match of matches) {
            for (const side of match.sides) {
                if (!side) continue
                const out = match.winnerId !== undefined && match.winnerId !== side
                reach.set(side, { round: match.round, alive: !out })
            }
        }
    }
    if (bracket.championId) reach.set(bracket.championId, { round: rounds + 1, alive: true })
    const key = (id: string) => {
        const value = reach.get(id) ?? { round: 0, alive: false }
        return value.round * 2 + (value.alive ? 1 : 0)
    }
    const groups = new Map<number, string[]>()
    for (const id of entrantIds) groups.set(key(id), [...(groups.get(key(id)) ?? []), id])
    return [...groups.entries()].sort(([a], [b]) => b - a).map(([, ids]) => ids.sort())
}
