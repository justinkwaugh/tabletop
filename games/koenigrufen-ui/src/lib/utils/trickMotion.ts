import type { HydratedKoenigrufenGameState, TrickPlay } from '@tabletop/koenigrufen'

export type ShownTrick = { plays: TrickPlay[]; winnerId?: string }
export type WonTrick = ShownTrick & { winnerId: string }

// The part of a state the trick motion reads: the trick in play and the tricks won so far.
export type TrickTable = Pick<HydratedKoenigrufenGameState, 'trick' | 'tricks'>

// The trick on the table. A won trick is not on it: its winner has taken it.
export function shownTrickOf(state: TrickTable): ShownTrick {
    return { plays: state.trick?.plays ?? [] }
}

export type TrickMotion = {
    // Cards on the table after the change that were not before, including a won trick's last.
    arriving: TrickPlay[]
    // The trick the change completed, shown briefly before it goes to its winner.
    won?: WonTrick
}

export function trickMotion(from: TrickTable, to: TrickTable): TrickMotion {
    const before = new Set(shownTrickOf(from).plays.map((play) => play.cardId))
    const completed = to.tricks.length === from.tricks.length + 1 ? to.tricks.at(-1) : undefined
    const arriving = (completed ?? shownTrickOf(to)).plays.filter(
        (play) => !before.has(play.cardId)
    )
    return completed
        ? { arriving, won: { plays: completed.plays, winnerId: completed.winnerId } }
        : { arriving }
}
