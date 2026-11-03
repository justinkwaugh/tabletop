import {
    PowerChoiceKind,
    reasonCannotBargainInOrder,
    usableFavor,
    witchsBargainBounds,
    witchsBargainStepBounds,
    type BargainEntry,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice
} from '@tabletop/oath'

/**
 * Witch's Bargain from revision 7: the players picked at the user's site, in the order picked,
 * each with the secrets and the pairs of favor given them. From revision 32 (the spec's
 * `inOrder`) the picks are steps in order, each made with what the user holds after the steps
 * above it: a player may come again after another, never twice in a row.
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

/**
 * From revision 32, the steps the picker shows: those named, up to the first player the spec no
 * longer offers; or, with none named and one player offered, that player with nothing given.
 */
export function shownBargainSteps(
    legal: LegalChoice,
    picks: readonly BargainPick[]
): BargainPick[] {
    const players = bargainPlayers(legal)
    const gone = picks.findIndex((pick) => !players.includes(pick.playerId))
    const shown = gone < 0 ? [...picks] : picks.slice(0, gone)
    const only = onlyPlayer(legal)
    return shown.length === 0 && only !== undefined
        ? [{ playerId: only, secretsGiven: 0, pairsGiven: 0 }]
        : shown
}

/**
 * The open (last) step's two rows, read on what the steps above it leave. Secrets: those held
 * then, before the first step the one the cost places too (drawn, never given). Pairs: the favor
 * held once the step's own secrets are given.
 */
export function bargainStepRows(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainPick[]
): BargainRows {
    const open = steps.length - 1
    const step = steps[open]
    const bounds = witchsBargainStepBounds(
        state,
        playerId,
        steps.slice(0, open),
        step.playerId,
        step.secretsGiven
    )
    return {
        secrets: bounds.silenced
            ? undefined
            : { held: bounds.secretsHeld, addable: bounds.secrets, picked: step.secretsGiven },
        pairs: { held: bounds.favorHeld, addable: bounds.pairs, picked: step.pairsGiven }
    }
}

/** Whether a step with `withId` after `steps` could exchange anything. */
function canExchangeThen(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainPick[],
    withId: string
): boolean {
    const bounds = witchsBargainStepBounds(state, playerId, steps, withId)
    return bounds.secrets + bounds.pairs > 0
}

/**
 * "Then:": the players a next step may name once the open step has a count, and while the spec
 * allows another: never the player just dealt with (twice in a row is one step), nor one with
 * whom nothing can be exchanged then.
 */
export function bargainThenPlayers(
    state: HydratedOathGameState,
    playerId: string,
    legal: LegalChoice,
    steps: readonly BargainPick[]
): string[] {
    const last = steps[steps.length - 1]
    if (!last || last.secretsGiven + last.pairsGiven === 0 || steps.length >= legal.spec.max)
        return []
    return bargainPlayers(legal).filter(
        (id) => id !== last.playerId && canExchangeThen(state, playerId, steps, id)
    )
}

/** The chips of step `k`: "With:" offers every player there, a later step what "Then:" offered it. */
export function bargainStepPlayers(
    state: HydratedOathGameState,
    playerId: string,
    legal: LegalChoice,
    steps: readonly BargainPick[],
    k: number
): string[] {
    return k === 0
        ? bargainPlayers(legal)
        : bargainThenPlayers(state, playerId, legal, steps.slice(0, k))
}

/**
 * A tap on a chip of step `k` names that player for it, and drops the steps after it; a tap on its
 * picked chip drops it and them. The one player a required pick allows is never dropped.
 */
export function withBargainStep(
    legal: LegalChoice,
    picks: readonly BargainPick[],
    k: number,
    playerId: string
): BargainPick[] {
    const shown = shownBargainSteps(legal, picks)
    if (shown[k]?.playerId === playerId)
        return k === 0 && onlyPlayer(legal) === playerId ? [...picks] : shown.slice(0, k)
    return [...shown.slice(0, k), { playerId, secretsGiven: 0, pairsGiven: 0 }]
}

/**
 * A tap on the Nth piece (or pair) of the open step sets N, and a tap on the one at the count sets
 * 0; its pairs then drop to what its secrets leave the user.
 */
export function withBargainStepCount(
    state: HydratedOathGameState,
    playerId: string,
    legal: LegalChoice,
    picks: readonly BargainPick[],
    term: 'secretsGiven' | 'pairsGiven',
    count: number
): BargainPick[] {
    const shown = shownBargainSteps(legal, picks)
    const open = shown.length - 1
    const step = shown[open]
    const next = { ...step, [term]: step[term] === count ? 0 : count }
    const before = shown.slice(0, open)
    const { pairs } = bargainStepRows(state, playerId, [...before, next])
    return [...before, { ...next, pairsGiven: Math.min(next.pairsGiven, pairs.addable) }]
}

/** Favor and secrets: what the user holds, or what a step takes from the other player. */
type FavorAndSecrets = { favor: number; secrets: number }

/**
 * What the user holds once the steps are made, as the engine counts them: the secrets and the
 * favor a step after them starts with. That step's player is read only for its own bounds, so the
 * user's own seat stands in.
 */
function heldAfter(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainPick[]
): FavorAndSecrets {
    const bounds = witchsBargainStepBounds(state, playerId, steps, playerId)
    return { favor: bounds.favorHeld, secrets: bounds.secretsHeld }
}

/**
 * From revision 32, what the step after `before` takes, read on the engine's counts after the
 * steps above it (from revision 33 as many as the other player holds then, down to 0; at 32 all it
 * names, as a short step is refused there): the favor its secrets bring the user, then the secrets
 * its pairs do. Vow of Kinship, Vow of Silence and a secret this step gave first are counted as the
 * engine counts them. A step the engine refuses takes nothing, and its words name what it asks, as
 * before: the pieces the rows do not let the count reach.
 */
function stepTaken(
    state: HydratedOathGameState,
    playerId: string,
    before: readonly BargainPick[],
    step: BargainPick
): FavorAndSecrets {
    const asked = { favor: 2 * step.secretsGiven, secrets: step.pairsGiven }
    if (reasonCannotBargainInOrder(state, playerId, [...before, step]) !== undefined) return asked
    const none = heldAfter(state, playerId, [
        ...before,
        { ...step, secretsGiven: 0, pairsGiven: 0 }
    ])
    const secretsOnly = heldAfter(state, playerId, [...before, { ...step, pairsGiven: 0 }])
    const all = heldAfter(state, playerId, [...before, step])
    return { favor: secretsOnly.favor - none.favor, secrets: all.secrets - secretsOnly.secrets }
}

/**
 * The spoken name of the open (last) step's Nth piece or pair: what it gives and what the step
 * would take with that count, the secrets first, then the pairs once those secrets are given.
 */
export function bargainCountLabel(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainPick[],
    name: string,
    term: 'secretsGiven' | 'pairsGiven',
    n: number
): string {
    const open = steps.length - 1
    const step = steps[open]
    const before = steps.slice(0, open)
    if (term === 'secretsGiven') {
        const { favor } = stepTaken(state, playerId, before, {
            ...step,
            secretsGiven: n,
            pairsGiven: 0
        })
        return `give ${name} ${n} ${n === 1 ? 'secret' : 'secrets'} for ${favor} favor`
    }
    const { secrets } = stepTaken(state, playerId, before, { ...step, pairsGiven: n })
    return `give ${name} ${2 * n} favor for ${secrets} ${secrets === 1 ? 'secret' : 'secrets'}`
}

/**
 * Step `k`, finished, as its one line reads: its secrets given, then its pairs, with their tokens,
 * each with what it takes after the steps above it.
 */
export function bargainStepLine(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainPick[],
    k: number
): string {
    const step = steps[k]
    const taken = stepTaken(state, playerId, steps.slice(0, k), step)
    return [
        ...(step.secretsGiven > 0
            ? [`give ${step.secretsGiven} secret for ${taken.favor} favor`]
            : []),
        ...(step.pairsGiven > 0
            ? [`give ${2 * step.pairsGiven} favor for ${taken.secrets} secret`]
            : [])
    ].join(', then ')
}
