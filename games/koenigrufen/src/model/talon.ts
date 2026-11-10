import { isKing, isTrull, isTrump } from '../components/cards.js'

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

// Kings and the Trull may never be laid away; other trumps only when no suit card can be.
export function canLayAway(
    hand: readonly string[],
    cardIds: readonly string[],
    count: number
): boolean {
    if (cardIds.length !== count || new Set(cardIds).size !== count) {
        return false
    }
    if (cardIds.some((cardId) => !hand.includes(cardId) || mayNeverLayAway(cardId))) {
        return false
    }
    if (!cardIds.some(isTrump)) {
        return true
    }
    return hand
        .filter((cardId) => !isTrump(cardId) && !mayNeverLayAway(cardId))
        .every((cardId) => cardIds.includes(cardId))
}

export function shownDiscards(cardIds: readonly string[]): string[] {
    return cardIds.filter(isTrump)
}

// Cards still choosable while picking `count` to lay away: trumps only once the remaining suit cards
// cannot fill the places left.
export function layAwayCandidates(
    hand: readonly string[],
    chosen: readonly string[],
    count: number
): string[] {
    const placesLeft = count - chosen.length
    if (placesLeft <= 0) {
        return []
    }
    const open = hand.filter((cardId) => !chosen.includes(cardId) && !mayNeverLayAway(cardId))
    const suitCards = open.filter((cardId) => !isTrump(cardId))
    return suitCards.length >= placesLeft ? suitCards : open
}
