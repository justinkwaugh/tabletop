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

// A card's move in a direct step (Undo, history, a correction): to or from the trick on the table,
// starting from its winner's pile when the step takes a won trick back.
export type TrickMove = { play: TrickPlay; pileOf?: string }

export type DirectTrickStep = {
    // Cards that land in the trick.
    arriving: TrickMove[]
    // Cards that go back to their players' hands, from the trick or from a pile.
    leaving: TrickMove[]
}

// What a step that is not a played card moves. A won trick taken back returns to the table from its
// winner's pile; any of its cards, or the trick's, that the step takes back go to their hands. A
// step that wins a trick moves nothing here: the trick simply goes.
export function directTrickStep(from: TrickTable, to: TrickTable): DirectTrickStep {
    const before = shownTrickOf(from).plays
    const after = shownTrickOf(to).plays
    const unwon = to.tricks.length === from.tricks.length - 1 ? from.tricks.at(-1) : undefined
    const pileOf = new Map((unwon?.plays ?? []).map((play) => [play.cardId, unwon?.winnerId]))
    const move = (play: TrickPlay): TrickMove => {
        const pile = pileOf.get(play.cardId)
        return pile === undefined ? { play } : { play, pileOf: pile }
    }
    const beforeIds = new Set(before.map((play) => play.cardId))
    const afterIds = new Set(after.map((play) => play.cardId))
    const won = new Set(to.tricks.flatMap((trick) => trick.plays.map((play) => play.cardId)))
    return {
        arriving: after.filter((play) => !beforeIds.has(play.cardId)).map(move),
        leaving: [...before, ...(unwon?.plays ?? [])]
            .filter((play) => !afterIds.has(play.cardId) && !won.has(play.cardId))
            .map(move)
    }
}
