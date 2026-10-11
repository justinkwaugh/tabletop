import {
    PowerChoiceKind,
    usableFavor,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice,
    type Suit
} from '@tabletop/oath'
import { bargainChoices, type BargainPick } from './bargainPicks.js'
import { exchangeComplete, noExchangePicks, type ExchangePicks } from './exchangeTerms.js'
import type { MovePick } from './powerMoves.js'

export type PowerChoicePicks = {
    option: Record<number, number>
    count: Record<number, number>
    terms: Record<number, ExchangePicks>
    several: Record<number, number[]>
    severalCount: Record<string, number>
    /** Witch's Bargain from revision 7: the players picked, in order, and what each is given. */
    bargain: Record<number, BargainPick[]>
    /** A power's moves (Messenger), each keyed by the place, owner and site picked. */
    moves: MovePick[]
}

export function emptyPicks(): PowerChoicePicks {
    return { option: {}, count: {}, terms: {}, several: {}, severalCount: {}, bargain: {}, moves: [] }
}

export const NO_OPTION = -1

/**
 * R-7.1.2 — in a game created before revision 7, an open count (Witch's Bargain) stops at what the
 * player can give: their secrets, or the favor they can use, which Vow of Kinship keeps in a bank.
 * The engine judges the pair.
 */
export function openCountCeiling(
    state: HydratedOathGameState,
    playerId: string | undefined
): number {
    if (playerId === undefined) return 0
    return Math.max(usableFavor(state, playerId), state.getPlayerState(playerId).secrets)
}

/** The favor banks among a choice's options, in option order. */
export function favorBankSuits(options: readonly PowerChoice[]): Suit[] {
    return options.flatMap((option) =>
        option.kind === PowerChoiceKind.FavorBank ? [option.suit] : []
    )
}

/** R-10.8 — the players an exchange may be negotiated with, in option order. */
export function exchangePartners(options: readonly PowerChoice[]): string[] {
    return options.flatMap((option) =>
        option.kind === PowerChoiceKind.Exchange ? [option.withPlayerId] : []
    )
}

export function allowsSeveral(legal: LegalChoice): boolean {
    return legal.spec.max > 1
}

export function severalCountKey(index: number, optionIndex: number): string {
    return `${index}:${optionIndex}`
}

// A warband count is kept within what the group carries as it is picked, so the send reads it as is.
function warbandsUpTo(option: PowerChoice, requested: number | undefined): PowerChoice {
    if (option.kind !== PowerChoiceKind.Warbands) return option
    return {
        kind: PowerChoiceKind.Warbands,
        group: { ...option.group, count: requested ?? option.group.count }
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

function boundedCount(option: PowerChoice | undefined, count: number): number {
    return option?.kind === PowerChoiceKind.Warbands
        ? clamp(count, 1, option.group.count)
        : Math.max(0, count)
}

// No default where the player has a choice: a required spec with one legal value starts on it.
export function optionIndexOf(legal: LegalChoice, index: number, picks: PowerChoicePicks): number {
    const picked = picks.option[index]
    if (picked !== undefined) return picked
    return legal.spec.min > 0 && legal.options.length === 1 ? 0 : NO_OPTION
}

export function withOptionPick(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    index: number,
    pick: number
): PowerChoicePicks {
    const count = picks.count[index]
    const option = legal.options[pick]
    // R-10.8 — terms are written for one player.
    const terms =
        pick === optionIndexOf(legal, index, picks)
            ? picks.terms
            : Object.fromEntries(
                  Object.entries(picks.terms).filter(([key]) => Number(key) !== index)
              )
    return {
        ...picks,
        option: { ...picks.option, [index]: pick },
        terms,
        count:
            count === undefined || option?.kind !== PowerChoiceKind.Warbands
                ? picks.count
                : { ...picks.count, [index]: boundedCount(option, count) }
    }
}

export function withCount(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    index: number,
    count: number
): PowerChoicePicks {
    const option = legal.options[optionIndexOf(legal, index, picks)]
    return { ...picks, count: { ...picks.count, [index]: boundedCount(option, count) } }
}

export function withSeveralCount(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    index: number,
    optionIndex: number,
    count: number
): PowerChoicePicks {
    const option = legal.options[optionIndex]
    return {
        ...picks,
        severalCount: {
            ...picks.severalCount,
            [severalCountKey(index, optionIndex)]: boundedCount(option, count)
        }
    }
}

/**
 * A confirm waits until every spec has at least its least picks. A required single pick
 * counts the option the picker shows picked, as `powerChoicesFrom` sends it; an exchange also
 * waits for terms that move something, every picked site counted (R-10.8).
 */
export function picksComplete(choices: readonly LegalChoice[], picks: PowerChoicePicks): boolean {
    return choices.every((legal, index) => {
        // Witch's Bargain: a player picked with nothing given is no entry yet.
        if (legal.spec.kind === PowerChoiceKind.Bargain) {
            return bargainChoices(picks.bargain[index] ?? []).length >= legal.spec.min
        }
        if (allowsSeveral(legal)) {
            const picked = (picks.several[index] ?? []).filter(
                (option) => legal.options[option] !== undefined
            )
            return picked.length >= legal.spec.min
        }
        const option = legal.options[optionIndexOf(legal, index, picks)]
        if (option?.kind === PowerChoiceKind.Exchange) {
            return exchangeComplete(picks.terms[index] ?? noExchangePicks())
        }
        return (option === undefined ? 0 : 1) >= legal.spec.min
    })
}

export function powerChoicesFrom(
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks
): PowerChoice[] {
    const out: PowerChoice[] = []
    choices.forEach((legal, index) => {
        if (legal.spec.kind === PowerChoiceKind.Bargain) {
            out.push(...bargainChoices(picks.bargain[index] ?? []))
            return
        }
        if (allowsSeveral(legal)) {
            for (const optionIndex of picks.several[index] ?? []) {
                const option = legal.options[optionIndex]
                if (!option) continue
                const requested = picks.severalCount[severalCountKey(index, optionIndex)]
                out.push(warbandsUpTo(option, requested))
            }
            return
        }
        const option = legal.options[optionIndexOf(legal, index, picks)]
        if (!option) return
        if (option.kind === PowerChoiceKind.Warbands) {
            out.push(warbandsUpTo(option, picks.count[index]))
        } else if (option.kind === PowerChoiceKind.Exchange) {
            out.push({
                kind: PowerChoiceKind.Exchange,
                withPlayerId: option.withPlayerId,
                terms: picks.terms[index]?.terms ?? {}
            })
        } else if (option.kind === PowerChoiceKind.Count) {
            out.push({ kind: PowerChoiceKind.Count, n: picks.count[index] ?? 0 })
        } else {
            out.push(option)
        }
    })
    return out
}
