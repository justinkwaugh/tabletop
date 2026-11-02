import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit, TOTAL_FAVOR } from '../model/oathEnums.js'
import type { PowerChoice, PowerChoiceKind } from '../model/powerChoice.js'
import { cardPower, powerIndexOf, PowerTiming, type CardPower } from '../data/cardPowers.js'
import { favorHomeBankOf, usableFavor } from './favor.js'
import { reasonPersistentForbidsGivingSecrets } from './persistent.js'
import { secretsNeeded } from './powerCost.js'

// "Action: Give [secret] to a player whose pawn is at your site to take [favor][favor] from them,
//  or give [favor][favor] for [secret], any number of times." Cost: place 1 secret.
export const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'

/** One player's exchanges in a use from revision 7: its Q&A lets one use deal with several. */
export type BargainEntry = Extract<PowerChoice, { kind: PowerChoiceKind.Bargain }>

function witchsBargainPower(): CardPower {
    const power = cardPower(WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action))
    assertExists(power, `${WITCHS_BARGAIN} prints no Action power`)
    return power
}

/** R-7.1.2 — the cost is paid before the power resolves, so its secrets cannot also be given. */
export function secretsToGiveAfterCost(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower = witchsBargainPower()
): number {
    return Math.max(0, state.getPlayerState(playerId).secrets - secretsNeeded(power.cost))
}

export interface WitchsBargainBounds {
    /** Secrets the entry may give, two of their favor taken for each: none under Vow of Silence. */
    secrets: number
    /** Pairs of favor the entry may give, one of their secrets taken for each. */
    pairs: number
    /** Vow of Silence: "You cannot … give anyone [secret]." */
    silenced: boolean
}

/**
 * The most one entry with `withId` may give beside the other entries named, which share what the
 * user holds after the cost. Their last secret can be taken (its Q&A: "Yup!"). Read-only: the
 * effect's own check is the rule, and this agrees with it.
 */
export function witchsBargainBounds(
    state: HydratedOathGameState,
    playerId: string,
    withId: string,
    others: readonly BargainEntry[] = []
): WitchsBargainBounds {
    const rest = others.filter((entry) => entry.playerId !== withId)
    const them = state.getPlayerState(withId)
    const silenced = reasonPersistentForbidsGivingSecrets(state, playerId) !== undefined
    const secretsLeft =
        secretsToGiveAfterCost(state, playerId) -
        rest.reduce((n, entry) => n + entry.secretsGiven, 0)
    const pairsLeft =
        Math.floor(usableFavor(state, playerId) / 2) -
        rest.reduce((n, entry) => n + entry.pairsGiven, 0)
    return {
        secrets: silenced ? 0 : Math.max(0, Math.min(secretsLeft, Math.floor(them.favor / 2))),
        pairs: Math.max(0, Math.min(pairsLeft, them.secrets)),
        silenced
    }
}

/**
 * From revision 32 each exchange uses what the user holds at that moment (Law 9.1: no unwritten
 * limit), so a token taken in one exchange may be given in a later one: the entries are steps in
 * order, and a player may come again after another. Each step makes one exchange at least, each
 * moving two favor: twice the favor in the game is more steps than any reachable result needs.
 */
export const BARGAIN_MAX_STEPS = 2 * TOTAL_FAVOR

/** One step: with one player, the secrets given first, then the pairs of favor. */
export type BargainStep = Pick<BargainEntry, 'playerId' | 'secretsGiven' | 'pairsGiven'>

/** One seat's favor: on their board, and the bank Vow of Kinship keeps it in (`favorHomeBankOf`). */
type FavorHeld = { board: number; home?: Suit }

/**
 * What the steps work with, in counts read from public holdings: every seat's secrets (the user's
 * after the cost) and favor, and the banks. Each step moves them as `bargainWith` moves the state.
 */
interface BargainCounts {
    secrets: Map<string, number>
    favor: Map<string, FavorHeld>
    banks: Record<Suit, number>
}

function countsOf(state: HydratedOathGameState, playerId: string, power: CardPower): BargainCounts {
    return {
        secrets: new Map(
            state.players.map((p) => [
                p.playerId,
                p.playerId === playerId ? secretsToGiveAfterCost(state, playerId, power) : p.secrets
            ])
        ),
        favor: new Map(
            state.players.map((p) => [
                p.playerId,
                { board: p.favor, home: favorHomeBankOf(state, p.playerId) }
            ])
        ),
        banks: { ...state.favorBank }
    }
}

function secretsOf(c: BargainCounts, playerId: string): number {
    const held = c.secrets.get(playerId)
    assertExists(held, `${playerId} has no seat`)
    return held
}

function favorOf(c: BargainCounts, playerId: string): FavorHeld {
    const held = c.favor.get(playerId)
    assertExists(held, `${playerId} has no seat`)
    return held
}

/** As `usableFavor`: the board, and the bank Vow of Kinship lets its holder use. */
function usableOf(c: BargainCounts, playerId: string): number {
    const { board, home } = favorOf(c, playerId)
    return board + (home ? c.banks[home] : 0)
}

/** As `receiveFavor`: into the bank under Vow of Kinship, else onto the board. */
function receive(c: BargainCounts, playerId: string, count: number): void {
    const held = favorOf(c, playerId)
    if (held.home) c.banks[held.home] += count
    else held.board += count
}

/** As `spendFavor`: from the board first, then the bank. */
function spend(c: BargainCounts, playerId: string, count: number): void {
    const held = favorOf(c, playerId)
    const fromBoard = Math.min(count, held.board)
    held.board -= fromBoard
    if (held.home) c.banks[held.home] -= count - fromBoard
}

function moveSecrets(c: BargainCounts, fromId: string, toId: string, count: number): void {
    c.secrets.set(fromId, secretsOf(c, fromId) - count)
    c.secrets.set(toId, secretsOf(c, toId) + count)
}

/**
 * One step on the counts, as `bargainWith` makes it on the state: why it cannot be made with what
 * is held then, or undefined once it is made. Their last secret can be taken (its Q&A: "Yup!"),
 * and the favor taken comes off their board alone (`removeFavorFromBoard`).
 */
function reasonStepCannot(
    c: BargainCounts,
    playerId: string,
    step: BargainStep,
    first: boolean,
    silenced: string | undefined
): string | undefined {
    const { playerId: themId, secretsGiven: give, pairsGiven: pairs } = step
    if (give > 0) {
        if (silenced) return silenced
        const mine = secretsOf(c, playerId)
        if (mine < give)
            return `you have ${mine} secrets to give${first ? ' after the cost' : ''}, not ${give}`
        const theirs = favorOf(c, themId)
        if (theirs.board < 2 * give)
            return `${themId} has ${theirs.board} favor, not the ${2 * give} you would take`
        moveSecrets(c, playerId, themId, give)
        theirs.board -= 2 * give
        receive(c, playerId, 2 * give)
    }
    if (pairs > 0) {
        const usable = usableOf(c, playerId)
        if (usable < 2 * pairs) return `you have ${usable} favor to give, not ${2 * pairs}`
        const theirs = secretsOf(c, themId)
        if (theirs < pairs)
            return `${themId} has ${theirs} secrets, not the ${pairs} you would take`
        spend(c, playerId, 2 * pairs)
        receive(c, themId, 2 * pairs)
        moveSecrets(c, themId, playerId, pairs)
    }
    return undefined
}

/** The steps in order on the counts: why the first that cannot be made cannot, naming it. */
function reasonStepsCannot(
    c: BargainCounts,
    playerId: string,
    steps: readonly BargainStep[],
    silenced: string | undefined
): string | undefined {
    for (const [i, step] of steps.entries()) {
        const reason = reasonStepCannot(c, playerId, step, i === 0, silenced)
        if (reason !== undefined) return i === 0 ? reason : `at step ${i + 1}, ${reason}`
    }
    return undefined
}

/**
 * From revision 32: whether the steps can be made in order, each on what the steps before it
 * leave, beginning with what the user holds after the cost. Vow of Silence bars a step giving a
 * secret, as before.
 */
export function reasonCannotBargainInOrder(
    state: HydratedOathGameState,
    playerId: string,
    steps: readonly BargainStep[],
    power: CardPower = witchsBargainPower()
): string | undefined {
    return reasonStepsCannot(
        countsOf(state, playerId, power),
        playerId,
        steps,
        reasonPersistentForbidsGivingSecrets(state, playerId)
    )
}

export interface WitchsBargainStepBounds {
    /** The user's secrets at this step; before the first, the one the cost places too, never given. */
    secretsHeld: number
    /** Secrets this step may give, two of their favor taken for each: none under Vow of Silence. */
    secrets: number
    /** The favor the user may give in this step, once its own secrets are given. */
    favorHeld: number
    /** Pairs of favor this step may give, one of their secrets taken for each. */
    pairs: number
    silenced: boolean
}

/**
 * From revision 32, the open step with `withId` after the steps `before`, its pairs read once its
 * `secretsGiven` are given. Read-only: `reasonCannotBargainInOrder` is the rule, and this agrees.
 */
export function witchsBargainStepBounds(
    state: HydratedOathGameState,
    playerId: string,
    before: readonly BargainStep[],
    withId: string,
    secretsGiven = 0
): WitchsBargainStepBounds {
    const silencedBy = reasonPersistentForbidsGivingSecrets(state, playerId)
    const silenced = silencedBy !== undefined
    const c = countsOf(state, playerId, witchsBargainPower())
    if (reasonStepsCannot(c, playerId, before, silencedBy) !== undefined)
        return { secretsHeld: 0, secrets: 0, favorHeld: 0, pairs: 0, silenced }
    const mine = secretsOf(c, playerId)
    const cost = before.length === 0 ? state.getPlayerState(playerId).secrets - mine : 0
    const secrets = silenced ? 0 : Math.min(mine, Math.floor(favorOf(c, withId).board / 2))
    const give = Math.min(secretsGiven, secrets)
    if (give > 0) {
        const step = { playerId: withId, secretsGiven: give, pairsGiven: 0 }
        reasonStepCannot(c, playerId, step, false, silencedBy)
    }
    const favorHeld = usableOf(c, playerId)
    return {
        secretsHeld: mine + cost,
        secrets,
        favorHeld,
        pairs: Math.min(Math.floor(favorHeld / 2), secretsOf(c, withId)),
        silenced
    }
}
