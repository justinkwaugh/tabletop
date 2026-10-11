import {
    PowerChoiceKind,
    usableFavor,
    witchsBargainBounds,
    type BargainEntry,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice
} from '@tabletop/oath'

/**
 * Witch's Bargain from revision 7: the players picked at the user's site, in the order picked,
 * each with the secrets and the pairs of favor given them.
 */
export type BargainPick = { playerId: string; secretsGiven: number; pairsGiven: number }

/** A row of the user's own pieces: held, how many the engine lets this player's entry reach, and the count. */
export type BargainRow = { held: number; addable: number; picked: number }

export type BargainRows = {
    /** Absent under Vow of Silence: its holder cannot give anyone secrets. */
    secrets?: BargainRow
    /** In pairs: `held` is favor, `addable` and `picked` count pairs. */
    pairs: BargainRow
}

function entryOf(pick: BargainPick): BargainEntry {
    return { kind: PowerChoiceKind.Bargain, ...pick }
}

/** The entries sent: a player picked with nothing given is no exchange. */
export function bargainChoices(picks: readonly BargainPick[]): PowerChoice[] {
    return picks
        .filter((pick) => pick.secretsGiven + pick.pairsGiven > 0)
        .map((pick) => entryOf(pick))
}

/** The two rows of one picked player, each held to what the engine's bounds leave beside the others. */
export function bargainRows(
    state: HydratedOathGameState,
    playerId: string,
    picks: readonly BargainPick[],
    withId: string
): BargainRows {
    const own = picks.find((pick) => pick.playerId === withId)
    const bounds = witchsBargainBounds(
        state,
        playerId,
        withId,
        picks.map((pick) => entryOf(pick))
    )
    return {
        secrets: bounds.silenced
            ? undefined
            : {
                  held: state.getPlayerState(playerId).secrets,
                  addable: bounds.secrets,
                  picked: own?.secretsGiven ?? 0
              },
        pairs: {
            held: usableFavor(state, playerId),
            addable: bounds.pairs,
            picked: own?.pairsGiven ?? 0
        }
    }
}

/** The players the spec offers, in the engine's order. */
export function bargainPlayers(legal: LegalChoice): string[] {
    return legal.options.flatMap((option) =>
        option.kind === PowerChoiceKind.Bargain ? [option.playerId] : []
    )
}

/** The one player a required pick allows: shown picked from the start, as every one-option pick is. */
function onlyPlayer(legal: LegalChoice): string | undefined {
    const players = bargainPlayers(legal)
    return legal.spec.min > 0 && players.length === 1 ? players[0] : undefined
}

/**
 * The picks the picker shows: those of players the spec offers, or, with nothing picked and one
 * player offered, that player with nothing given. Derived and never stored, so Undo has nothing
 * to take back until a count is tapped.
 */
export function shownBargainPicks(
    legal: LegalChoice,
    picks: readonly BargainPick[]
): BargainPick[] {
    const players = bargainPlayers(legal)
    const shown = picks.filter((pick) => players.includes(pick.playerId))
    const only = onlyPlayer(legal)
    return shown.length === 0 && only !== undefined
        ? [{ playerId: only, secretsGiven: 0, pairsGiven: 0 }]
        : shown
}

/**
 * A tap on a chip picks its player, and a tap on a picked chip drops them and what they were
 * given; the one player a required pick allows is never dropped.
 */
export function withBargainPlayer(
    legal: LegalChoice,
    picks: readonly BargainPick[],
    playerId: string
): BargainPick[] {
    if (onlyPlayer(legal) === playerId) return [...picks]
    return picks.some((pick) => pick.playerId === playerId)
        ? picks.filter((pick) => pick.playerId !== playerId)
        : [...picks, { playerId, secretsGiven: 0, pairsGiven: 0 }]
}

/** A tap on the Nth piece (or pair) sets N, and a tap on the one at the count sets 0. */
export function withBargainCount(
    legal: LegalChoice,
    picks: readonly BargainPick[],
    playerId: string,
    term: 'secretsGiven' | 'pairsGiven',
    count: number
): BargainPick[] {
    return shownBargainPicks(legal, picks).map((pick) =>
        pick.playerId === playerId ? { ...pick, [term]: pick[term] === count ? 0 : count } : pick
    )
}
