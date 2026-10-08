import {
    PowerChoiceKind,
    usableFavor,
    type ExchangeTerms,
    type HydratedOathGameState,
    type LegalChoice,
    type PowerChoice,
    type Suit
} from '@tabletop/oath'

export type PowerChoicePicks = {
    option: Record<number, number>
    count: Record<number, number>
    terms: Record<number, ExchangeTerms>
    several: Record<number, number[]>
    severalCount: Record<string, number>
}

export function emptyPicks(): PowerChoicePicks {
    return { option: {}, count: {}, terms: {}, several: {}, severalCount: {} }
}

export const NO_OPTION = -1

/**
 * R-7.1.2 — an open count (Witch's Bargain) stops at what the player can give: their secrets, or
 * the favor they can use, which Vow of Kinship keeps in a bank. The engine judges the pair.
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

// A required spec defaults to its first legal value; an optional one to none.
export function optionIndexOf(legal: LegalChoice, index: number, picks: PowerChoicePicks): number {
    const picked = picks.option[index]
    if (picked !== undefined) return picked
    return legal.spec.min > 0 && legal.options.length > 0 ? 0 : NO_OPTION
}

export function withOptionPick(
    picks: PowerChoicePicks,
    legal: LegalChoice,
    index: number,
    pick: number
): PowerChoicePicks {
    const count = picks.count[index]
    const option = legal.options[pick]
    return {
        ...picks,
        option: { ...picks.option, [index]: pick },
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
 * counts the option the picker shows picked, as `powerChoicesFrom` sends it.
 */
export function picksComplete(choices: readonly LegalChoice[], picks: PowerChoicePicks): boolean {
    return choices.every((legal, index) => {
        const picked = allowsSeveral(legal)
            ? (picks.several[index] ?? []).filter((option) => legal.options[option] !== undefined)
                  .length
            : legal.options[optionIndexOf(legal, index, picks)] === undefined
              ? 0
              : 1
        return picked >= legal.spec.min
    })
}

export function powerChoicesFrom(
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks
): PowerChoice[] {
    const out: PowerChoice[] = []
    choices.forEach((legal, index) => {
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
                terms: picks.terms[index] ?? {}
            })
        } else if (option.kind === PowerChoiceKind.Count) {
            out.push({ kind: PowerChoiceKind.Count, n: picks.count[index] ?? 0 })
        } else {
            out.push(option)
        }
    })
    return out
}
