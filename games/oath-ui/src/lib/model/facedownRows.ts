import { assertExists } from '@tabletop/common'
import {
    PowerChoiceKind,
    type LegalChoice,
    type OathProjectedPlayerState,
    type PowerChoice
} from '@tabletop/oath'
import type { CardChoice } from './cardChoice.js'
import { cardName } from './names.js'
import { NO_OPTION, optionIndexOf, withOptionPick, type PowerChoicePicks } from './powerChoices.js'
import { seatAdvisers } from './seatAdvisers.js'

type SeatState = Pick<OathProjectedPlayerState, 'playerId' | 'advisers' | 'adviserIds'>

/** One seat's facedown advisers a power offers, in the engine's option order; `key` is the option's index. */
export type FacedownSeatRow = { playerId: string; cards: CardChoice[] }

/**
 * R-2.2.2, R-9.4 — a facedown adviser choice as a row per holder, in the engine's option order. A
 * card is drawn face up only where the viewer's own view names it (their own facedown advisers, or
 * one they were let peek at); every other is its back, labelled by holder and place. Nothing when
 * any option is not a facedown adviser.
 */
export function facedownSeatRows(
    options: readonly PowerChoice[],
    seatOf: (playerId: string) => SeatState,
    viewerId: string | undefined,
    backLabel: (playerId: string, index: number) => string
): FacedownSeatRow[] | undefined {
    if (options.length === 0) return undefined
    const rows: FacedownSeatRow[] = []
    for (const [option, choice] of options.entries()) {
        if (choice.kind !== PowerChoiceKind.FacedownAdviser) return undefined
        const adviser = seatAdvisers(seatOf(choice.playerId), viewerId)[choice.index]
        assertExists(adviser, `${choice.playerId} has no adviser at ${choice.index}`)
        const key = String(option)
        const card: CardChoice =
            adviser.cardId !== undefined
                ? { key, cardId: adviser.cardId, label: cardName(adviser.cardId) }
                : { key, back: adviser.back, label: backLabel(choice.playerId, choice.index) }
        const row = rows.find((r) => r.playerId === choice.playerId)
        if (row) row.cards.push(card)
        else rows.push({ playerId: choice.playerId, cards: [card] })
    }
    return rows
}

/**
 * Two single facedown adviser picks over the same advisers ("Swap any two facedown advisers"),
 * answered in one area: the first spec of each such pair, and the one after it.
 */
export type AdviserPair = { specs: [number, number] }

export function adviserPairs(choices: readonly LegalChoice[]): AdviserPair[] {
    const pairs: AdviserPair[] = []
    for (let index = 0; index + 1 < choices.length; index += 1) {
        const one = choices[index]
        const other = choices[index + 1]
        if (
            single(one) &&
            single(other) &&
            JSON.stringify(one.options) === JSON.stringify(other.options)
        ) {
            pairs.push({ specs: [index, index + 1] })
            index += 1
        }
    }
    return pairs
}

function single(legal: LegalChoice | undefined): legal is LegalChoice {
    return (
        legal !== undefined &&
        legal.spec.kind === PowerChoiceKind.FacedownAdviser &&
        legal.spec.max === 1
    )
}

export function pairAt(pairs: readonly AdviserPair[], index: number): AdviserPair | undefined {
    return pairs.find((pair) => pair.specs.includes(index))
}

/** The options a pair holds picked, first pick first; none where a spec is empty. */
export function pairPicked(
    pair: AdviserPair,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks
): number[] {
    return pair.specs
        .map((spec) => optionIndexOf(choices[spec], spec, picks))
        .filter((option) => option !== NO_OPTION)
}

/**
 * A tap in a pair's area: a picked card is let go (a second pick left alone moves up to first);
 * an unpicked card fills the first empty pick, and with both made it does nothing. So one card is
 * never both picks.
 */
export function withPairTap(
    pair: AdviserPair,
    choices: readonly LegalChoice[],
    picks: PowerChoicePicks,
    option: number
): PowerChoicePicks {
    const [firstSpec, secondSpec] = pair.specs
    const first = optionIndexOf(choices[firstSpec], firstSpec, picks)
    const second = optionIndexOf(choices[secondSpec], secondSpec, picks)
    const set = (at: PowerChoicePicks, spec: number, value: number) =>
        withOptionPick(at, choices[spec], spec, value)
    if (option === first) {
        return set(set(picks, firstSpec, second), secondSpec, NO_OPTION)
    }
    if (option === second) return set(picks, secondSpec, NO_OPTION)
    if (first === NO_OPTION) return set(picks, firstSpec, option)
    if (second === NO_OPTION) return set(picks, secondSpec, option)
    return picks
}
