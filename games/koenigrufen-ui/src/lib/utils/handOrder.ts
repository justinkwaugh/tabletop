import { card, Suits } from '@tabletop/koenigrufen'

// Suits alternate colour; trumps follow.
const SuitBlocks = [Suits[0], Suits[2], Suits[1], Suits[3]]
const TrumpBlock = SuitBlocks.length
const BlockSize = 100

// A hand in blocks, each suit and then the trumps. Within a block the cards run from the weakest to
// the strongest, left to right, or the other way round when `highToLow`.
export function sortHand(cardIds: readonly string[], highToLow: boolean): string[] {
    const key = (cardId: string) => {
        const found = card(cardId)
        const [block, strength] =
            found.kind === 'trump'
                ? [TrumpBlock, found.number]
                : [SuitBlocks.indexOf(found.suit), found.strength]
        return block * BlockSize + (highToLow ? BlockSize - strength : strength)
    }
    return cardIds.toSorted((a, b) => key(a) - key(b))
}
