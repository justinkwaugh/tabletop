import type { CompletedTrick, HydratedKoenigrufenGameState, TrickPlay } from '@tabletop/koenigrufen'

export type WonTrick = { plays: TrickPlay[]; winnerId: string }

export type ShownTrick = {
    // The trick in play.
    plays: TrickPlay[]
    // The last trick won. It stays on the table, its winning card ringed, until a card is led to
    // the next trick; then its winner takes it.
    won?: WonTrick
}

// The part of a state the trick motion reads: the trick in play and the tricks won so far.
export type TrickTable = {
    readonly trick?: HydratedKoenigrufenGameState['trick']
    readonly tricks: readonly CompletedTrick[]
}

// The won trick still lying on the table: the last one, until a card is led to the next.
export function trickOnTable(state: TrickTable): CompletedTrick | undefined {
    return state.trick?.plays.length ? undefined : state.tricks.at(-1)
}

export function shownTrickOf(state: TrickTable): ShownTrick {
    const plays = state.trick?.plays ?? []
    const won = trickOnTable(state)
    return won ? { plays, won: { plays: won.plays, winnerId: won.winnerId } } : { plays }
}

// Every card on the table, the won trick's first.
export function cardsOnTable(trick: ShownTrick): TrickPlay[] {
    return [...(trick.won?.plays ?? []), ...trick.plays]
}

export type TrickMotion = {
    // Cards on the table after the change that were not before, including a won trick's last.
    arriving: TrickPlay[]
    // The trick the change completed; it stays on the table.
    completed?: WonTrick
    // The won trick the change took off the table, to its winner's pile.
    taken?: WonTrick
    // What the table shows while the change plays out: the trick it ends on, with a trick taken
    // still there until it has gone.
    shown: ShownTrick
}

export function trickMotion(from: TrickTable, to: TrickTable): TrickMotion {
    const before = shownTrickOf(from)
    const after = shownTrickOf(to)
    const beforeIds = new Set(cardsOnTable(before).map((play) => play.cardId))
    const afterIds = new Set(cardsOnTable(after).map((play) => play.cardId))
    const arriving = cardsOnTable(after).filter((play) => !beforeIds.has(play.cardId))
    const completed = to.tricks.length === from.tricks.length + 1 ? after.won : undefined
    const taken =
        before.won && !before.won.plays.some((play) => afterIds.has(play.cardId))
            ? before.won
            : undefined
    return {
        arriving,
        ...(completed ? { completed } : {}),
        ...(taken ? { taken } : {}),
        shown: { plays: after.plays, ...((after.won ?? taken) ? { won: after.won ?? taken } : {}) }
    }
}

// A card's move in a direct step (Undo, history, a correction): to or from the table, from or to
// its winner's pile when the step takes a won trick back or gives it.
export type TrickMove = { play: TrickPlay; pileOf?: string }

export type DirectTrickStep = {
    // Cards that land on the table.
    arriving: TrickMove[]
    // Cards that go back to their players' hands, from the table or from a pile.
    leaving: TrickMove[]
    // The won trick the step took off the table, to its winner's pile.
    taken?: WonTrick
    shown: ShownTrick
}

// The cards in players' piles: every won trick but the one on the table, by its winner.
function piledCards(state: TrickTable): Map<string, string> {
    const onTable = trickOnTable(state)
    return new Map(
        state.tricks
            .filter((trick) => trick !== onTable)
            .flatMap((trick) => trick.plays.map((play) => [play.cardId, trick.winnerId] as const))
    )
}

// What a step that is not a played card moves. A card comes onto the table from its hand, or from
// its winner's pile when the step takes a won trick back; cards leave it for their hands, or, a won
// trick the step gives, for its winner's pile.
export function directTrickStep(from: TrickTable, to: TrickTable): DirectTrickStep {
    const { taken, shown } = trickMotion(from, to)
    const before = cardsOnTable(shownTrickOf(from))
    const after = cardsOnTable(shownTrickOf(to))
    const piledBefore = piledCards(from)
    const piledAfter = piledCards(to)
    const move = (play: TrickPlay): TrickMove => {
        const pile = piledBefore.get(play.cardId)
        return pile === undefined ? { play } : { play, pileOf: pile }
    }
    const beforeIds = new Set(before.map((play) => play.cardId))
    const afterIds = new Set(after.map((play) => play.cardId))
    const unpiled = from.tricks
        .flatMap((trick) => trick.plays)
        .filter((play) => piledBefore.has(play.cardId) && !piledAfter.has(play.cardId))
    return {
        arriving: after.filter((play) => !beforeIds.has(play.cardId)).map(move),
        leaving: [...before, ...unpiled]
            .filter((play) => !afterIds.has(play.cardId) && !piledAfter.has(play.cardId))
            .map(move),
        ...(taken ? { taken } : {}),
        shown
    }
}
