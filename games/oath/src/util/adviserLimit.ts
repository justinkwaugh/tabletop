import { HydratedOathGameState } from '../model/gameState.js'
import type { PileDeposit } from '../model/hidden.js'
import { PowerQuestionKind, type QuestionOf } from '../model/question.js'
import { adviserDiscardable } from './cardPlay.js'
import { adviserExcess, shapesAdviserLimit } from './continuous.js'
import { discardCards } from './discard.js'
import { isLockedFor } from './locked.js'
import { regionOfPawn } from './pawn.js'
import { askQuestion, currentQuestion, turnOrderFrom } from './questions.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** A player whose advisers a power changed, and the cards it gave them. */
export interface AdvisersMoved {
    playerId: string
    receivedCardIds: readonly string[]
}

type DiscardAdvisersQuestion = QuestionOf<PowerQuestionKind.DiscardAdvisers>

/**
 * Settle adviser limits after a move (R-7.6.4; Enchantress's Q&A: "They will need to discard a card
 * from their advisers, but not the Enchantress"). Each player whose advisers changed and who now
 * stands over their limit is asked to discard down to it, never a card the move gave them, in turn
 * order from the acting player. From revision 11; before it a move asked nothing.
 */
export function settleAdviserLimitsAfterMove(
    state: HydratedOathGameState,
    actingPlayerId: string,
    sourceCardId: string,
    moved: readonly AdvisersMoved[]
): void {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes7)) return
    for (const playerId of turnOrderFrom(state, actingPlayerId)) {
        const change = moved.find((entry) => entry.playerId === playerId)
        if (!change) continue
        const paths = new AdviserLimitPaths(state, playerId, change.receivedCardIds)
        const count = paths.fewestFrom(START)
        if (count === 0) continue
        askQuestion(state, actingPlayerId, {
            kind: PowerQuestionKind.DiscardAdvisers,
            cardId: sourceCardId,
            askedPlayerId: playerId,
            actingPlayerId,
            count,
            receivedCardIds: [...change.receivedCardIds]
        })
    }
}

/** How far a discard down to the limit has gone: a bit per faceup adviser gone, and how many facedown. */
interface Position {
    faceup: number
    facedown: number
}

const START: Position = { faceup: 0, facedown: 0 }

/**
 * R-7.6.4 — the ways a player over their adviser limit may discard down to it, never a card just
 * received nor a locked one (R-7.2.2). A discard is a step when it lowers the excess, or when it is
 * a limiter (Family Wagon) whose going changes what counts. A step may go only while the excess is
 * above the lowest the discardable advisers can bring it to (none, unless locked or received ones
 * hold it up), and only if that lowest can still be reached after it. The question's count is the
 * fewest steps. Read from the public rows, besides the facedown cards a discard names, so every
 * view of the table asks the same count: facedown advisers are alike to it.
 */
class AdviserLimitPaths {
    /** The faceup advisers that may go, in row order; a position's bit `i` is `faceup[i]` gone. */
    private readonly faceup: string[]
    private readonly facedown: number
    private readonly excesses = new Map<string, number>()
    private readonly fewest = new Map<string, number>()
    readonly lowest: number

    constructor(
        private readonly state: HydratedOathGameState,
        private readonly playerId: string,
        private readonly received: readonly string[]
    ) {
        const player = state.getPlayerState(playerId)
        this.faceup = player
            .faceupAdviserIds()
            .filter((cardId) => !received.includes(cardId) && !isLockedFor(state, playerId, cardId))
        this.facedown = player.advisers.filter((row) => !row.faceUp).length
        this.lowest = this.lowestReachable()
    }

    excess(at: Position): number {
        const key = keyOf(at)
        let excess = this.excesses.get(key)
        if (excess === undefined) {
            const leaving = this.faceup.filter((_, index) => at.faceup & (1 << index))
            excess = adviserExcess(this.state, this.playerId, this.received, leaving, at.facedown)
            this.excesses.set(key, excess)
        }
        return excess
    }

    /** The fewest steps from `at` that bring the excess to its lowest. */
    fewestFrom(at: Position): number {
        if (this.excess(at) <= this.lowest) return 0
        const key = keyOf(at)
        let fewest = this.fewest.get(key)
        if (fewest === undefined) {
            fewest = Math.min(Infinity, ...this.steps(at).map((to) => 1 + this.fewestFrom(to)))
            this.fewest.set(key, fewest)
        }
        return fewest
    }

    /** Where `cardId` going from `at` leads, when it is a discard that may go there. */
    next(at: Position, cardId: string): Position | undefined {
        if (this.excess(at) <= this.lowest) return undefined
        if (this.received.includes(cardId)) return undefined
        if (!adviserDiscardable(this.state, this.playerId, cardId)) return undefined
        const index = this.faceup.indexOf(cardId)
        const to = this.advance(at, index >= 0 ? index : undefined)
        return to && this.fewestFrom(to) < Infinity ? to : undefined
    }

    /** `at` once `cardId`, one of the advisers that may go, is gone, whether or not it is a step. */
    place(at: Position, cardId: string): Position {
        const index = this.faceup.indexOf(cardId)
        return index >= 0
            ? { faceup: at.faceup | (1 << index), facedown: at.facedown }
            : { faceup: at.faceup, facedown: at.facedown + 1 }
    }

    /** A step from `at`: `faceup[index]` going, or a facedown adviser when `index` is undefined. */
    private advance(at: Position, index: number | undefined): Position | undefined {
        if (index === undefined) {
            if (at.facedown >= this.facedown) return undefined
            const to = { faceup: at.faceup, facedown: at.facedown + 1 }
            return this.excess(to) < this.excess(at) ? to : undefined
        }
        if (at.faceup & (1 << index)) return undefined
        const to = { faceup: at.faceup | (1 << index), facedown: at.facedown }
        const limiter = shapesAdviserLimit(this.state, this.faceup[index])
        return limiter || this.excess(to) < this.excess(at) ? to : undefined
    }

    private steps(at: Position): Position[] {
        const steps: Position[] = []
        for (const index of [...this.faceup.keys(), undefined]) {
            const to = this.advance(at, index)
            if (to) steps.push(to)
        }
        return steps
    }

    private lowestReachable(): number {
        const seen = new Set<string>()
        let lowest = Infinity
        const visit = (at: Position) => {
            if (seen.has(keyOf(at))) return
            seen.add(keyOf(at))
            lowest = Math.min(lowest, this.excess(at))
            for (const to of this.steps(at)) visit(to)
        }
        visit(START)
        return lowest
    }
}

function keyOf(at: Position): string {
    return `${at.faceup}:${at.facedown}`
}

/** Where `discarded` leads when each goes as a step in its turn; undefined from the first that may not. */
function walk(paths: AdviserLimitPaths, discarded: readonly string[]): Position | undefined {
    let at: Position | undefined = START
    for (const cardId of discarded) at = at && paths.next(at, cardId)
    return at
}

function openDiscardQuestion(
    state: HydratedOathGameState,
    playerId: string
): DiscardAdvisersQuestion | undefined {
    const question = currentQuestion(state)
    return question?.kind === PowerQuestionKind.DiscardAdvisers &&
        question.askedPlayerId === playerId
        ? question
        : undefined
}

/**
 * The asked player's advisers that may go next toward the limit once `picked` have gone, in their
 * order: none after a pick that may not go.
 */
export function adviserLimitDiscards(
    state: HydratedOathGameState,
    playerId: string,
    picked: readonly string[] = []
): string[] {
    const question = openDiscardQuestion(state, playerId)
    if (!question) return []
    const paths = new AdviserLimitPaths(state, playerId, question.receivedCardIds)
    const at = walk(paths, picked)
    if (!at) return []
    return state
        .getPlayerState(playerId)
        .knownAdviserIds()
        .filter((cardId) => !picked.includes(cardId) && paths.next(at, cardId) !== undefined)
}

/** How many discards meet the limit, `picked` and the fewest after them; `picked` alone after one that may not go. */
export function adviserLimitDiscardCount(
    state: HydratedOathGameState,
    playerId: string,
    picked: readonly string[] = []
): number {
    const question = openDiscardQuestion(state, playerId)
    if (!question) return 0
    const paths = new AdviserLimitPaths(state, playerId, question.receivedCardIds)
    const at = walk(paths, picked)
    return picked.length + (at ? paths.fewestFrom(at) : 0)
}

/** R-7.6.4 — discards that bring the player down to their limit, each a step that may go in its turn. */
export function reasonAdviserLimitDiscardsInvalid(
    state: HydratedOathGameState,
    playerId: string,
    question: DiscardAdvisersQuestion,
    discarded: readonly string[]
): string | undefined {
    const player = state.getPlayerState(playerId)
    const received = question.receivedCardIds
    if (new Set(discarded).size !== discarded.length) return 'an adviser is discarded once'
    for (const cardId of discarded) {
        if (received.includes(cardId)) return `${cardId} was just received, so it is not discarded`
        if (!player.knownAdviser(cardId)) return `${cardId} is not one of your advisers`
        if (!adviserDiscardable(state, playerId, cardId)) {
            return `${cardId} is locked and cannot be discarded`
        }
    }
    const paths = new AdviserLimitPaths(state, playerId, received)
    let at = START
    for (const [needed, cardId] of discarded.entries()) {
        if (paths.excess(at) <= paths.lowest) {
            return `only ${needed} ${needed === 1 ? 'adviser is' : 'advisers are'} discarded to meet the adviser limit`
        }
        at = paths.place(at, cardId)
    }
    const left = paths.excess(at)
    if (left > paths.lowest) return `still over the adviser limit by ${left}`
    let step: Position | undefined = START
    for (const cardId of discarded) {
        step = paths.next(step, cardId)
        if (!step) return `${cardId} does not bring you nearer the adviser limit`
    }
    return undefined
}

/** R-10.5 — the advisers go down from their holder's region, the secrets on them to the acting player. */
export function discardAdvisersToMeetLimit(
    state: HydratedOathGameState,
    playerId: string,
    question: DiscardAdvisersQuestion,
    discarded: readonly string[]
): { summary: string; pileDeposits: PileDeposit[] } {
    const player = state.getPlayerState(playerId)
    // R-9.4 — the record names a faceup card, never a facedown one.
    const faceup = discarded.filter((cardId) => player.isFaceupAdviser(cardId))
    const facedown = discarded.length - faceup.length
    const region = regionOfPawn(state, playerId)
    for (const cardId of discarded) player.removeAdviser(cardId)
    const pileDeposits = discardCards(state, question.actingPlayerId, discarded, region)
    const named = [
        ...faceup,
        ...(facedown > 0 ? [`${facedown} facedown ${facedown === 1 ? 'adviser' : 'advisers'}`] : [])
    ]
    return { summary: `discarded ${named.join(', ')} to meet the adviser limit`, pileDeposits }
}
