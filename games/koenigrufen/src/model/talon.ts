import { isKing, isTrull, isTrump } from '../components/cards.js'
import { LayAwayRule } from '../components/contracts.js'

export const TalonSize = 6
export const TalonHalfSize = 3

export function talonHalves(talon: readonly string[]): string[][] {
    return [talon.slice(0, TalonHalfSize), talon.slice(TalonHalfSize, TalonSize)]
}

// Wikipedia (Königrufen, Solo Rufer): the untouched talon counts for the opponents unless the called
// King is in it; then that half of the talon belongs to the declarer.
export function untouchedTalonHalfForDeclarer(
    talon: readonly string[],
    isCalledKing: (cardId: string) => boolean
): string[] {
    return talonHalves(talon).find((half) => half.some(isCalledKing)) ?? []
}

function mayNeverLayAway(cardId: string): boolean {
    return isKing(cardId) || isTrull(cardId)
}

// The cards that must go first: suit cards, or in Farbendreier trumps.
function goesFirst(rule: LayAwayRule): (cardId: string) => boolean {
    return rule === LayAwayRule.TrumpsFirstSuitCardsShown ? isTrump : (cardId) => !isTrump(cardId)
}

// Kings and the Trull may never be laid away. Any other card that does not go first may be laid away
// only once every card that goes first is.
export function canLayAway(
    hand: readonly string[],
    cardIds: readonly string[],
    count: number,
    rule: LayAwayRule
): boolean {
    if (cardIds.length !== count || new Set(cardIds).size !== count) {
        return false
    }
    if (cardIds.some((cardId) => !hand.includes(cardId) || mayNeverLayAway(cardId))) {
        return false
    }
    const first = goesFirst(rule)
    if (cardIds.every(first)) {
        return true
    }
    return hand
        .filter((cardId) => first(cardId) && !mayNeverLayAway(cardId))
        .every((cardId) => cardIds.includes(cardId))
}

// The cards laid away face up, for every viewer: trumps, or in Farbendreier suit cards.
export function shownDiscards(cardIds: readonly string[], rule: LayAwayRule): string[] {
    return cardIds.filter(
        rule === LayAwayRule.TrumpsFirstSuitCardsShown ? (cardId) => !isTrump(cardId) : isTrump
    )
}

// Cards still choosable while picking `count` to lay away: the others only once the cards that go
// first cannot fill the places left.
export function layAwayCandidates(
    hand: readonly string[],
    chosen: readonly string[],
    count: number,
    rule: LayAwayRule
): string[] {
    const placesLeft = count - chosen.length
    if (placesLeft <= 0) {
        return []
    }
    const open = hand.filter((cardId) => !chosen.includes(cardId) && !mayNeverLayAway(cardId))
    const first = open.filter(goesFirst(rule))
    return first.length >= placesLeft ? first : open
}
