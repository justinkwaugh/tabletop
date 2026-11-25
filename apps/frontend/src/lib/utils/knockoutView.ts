import {
    knockoutBracket,
    knockoutGameSlot,
    knockoutResultsOf,
    knockoutStage,
    type KnockoutBracket,
    type KnockoutGameSlot,
    type KnockoutMatch,
    type KnockoutStage,
    type TournamentDetail,
    type TournamentMatchGame,
    type TournamentSchedule
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'

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

type StageTexts = {
    round: (round: number) => string
    match: (round: number, match: number) => string
    reached: (round: number) => string
    knockedOut: (round: number) => string
}

const STAGE_TEXTS: Record<KnockoutStage, StageTexts> = {
    final: {
        round: () => m.tournaments_knockout_final(),
        match: () => m.tournaments_knockout_final(),
        reached: () => m.tournaments_knockout_in_final(),
        knockedOut: () => m.tournaments_knockout_runner_up()
    },
    semiFinals: {
        round: () => m.tournaments_knockout_semi_finals(),
        match: (_round, match) => m.tournaments_knockout_semi_final_match({ match }),
        reached: () => m.tournaments_knockout_in_semi_finals(),
        knockedOut: () => m.tournaments_knockout_out_in_semi_finals()
    },
    quarterFinals: {
        round: () => m.tournaments_knockout_quarter_finals(),
        match: (_round, match) => m.tournaments_knockout_quarter_final_match({ match }),
        reached: () => m.tournaments_knockout_in_quarter_finals(),
        knockedOut: () => m.tournaments_knockout_out_in_quarter_finals()
    },
    numbered: {
        round: (round) => m.tournaments_knockout_round({ round }),
        match: (round, match) => m.tournaments_knockout_round_match({ round, match }),
        reached: (round) => m.tournaments_knockout_in_round({ round }),
        knockedOut: (round) => m.tournaments_knockout_out_in_round({ round })
    }
}

function stageTexts(round: number, rounds: number): StageTexts {
    return STAGE_TEXTS[knockoutStage(round, rounds)]
}

export function knockoutRoundText(round: number, rounds: number): string {
    return stageTexts(round, rounds).round(round)
}

export function knockoutMatchText(
    match: Pick<TournamentMatchGame, 'round' | 'index'>,
    rounds: number
): string {
    return stageTexts(match.round, rounds).match(match.round, match.index + 1)
}

type GameSlotTexts = { name: (number: number) => string; label: (number: number) => string }

const GAME_SLOT_TEXTS: Record<KnockoutGameSlot['kind'], GameSlotTexts> = {
    game: {
        name: (game) => m.tournaments_knockout_game({ game }),
        label: (game) => m.tournaments_knockout_game_label({ game })
    },
    decider: {
        name: (number) =>
            number === 1
                ? m.tournaments_knockout_decider()
                : m.tournaments_knockout_decider_numbered({ number }),
        label: (number) =>
            number === 1
                ? m.tournaments_knockout_decider_label()
                : m.tournaments_knockout_decider_label_numbered({ number })
    }
}

export function knockoutGameText(game: number): string {
    const slot = knockoutGameSlot(game)
    return GAME_SLOT_TEXTS[slot.kind].name(slot.number)
}

export function knockoutGameLabelText(game: number): string {
    const slot = knockoutGameSlot(game)
    return GAME_SLOT_TEXTS[slot.kind].label(slot.number)
}

/** Where an Entrant stands: through to a round, or out in one. */
export function knockoutPlayerStatus(
    bracket: KnockoutBracket,
    userId: string
): KnockoutPlayerStatus {
    const rounds = bracket.rounds.length
    if (bracket.championId === userId)
        return { text: m.tournaments_knockout_champion(), out: false }
    let reached: KnockoutMatch | undefined
    for (const match of bracket.rounds.flat()) if (match.sides.includes(userId)) reached = match
    if (!reached) return { text: '', out: true }
    const lost = reached.winnerId !== undefined && reached.winnerId !== userId
    const texts = stageTexts(reached.round, rounds)
    if (lost) return { text: texts.knockedOut(reached.round), out: true }
    return { text: texts.reached(reached.round), out: false }
}
