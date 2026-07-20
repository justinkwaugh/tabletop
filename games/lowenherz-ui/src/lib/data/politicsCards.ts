// Data for the Löwenherz politics card deck.
// 13 cards: 3 alliance, 3 renegade, 3 parchment (power points), 4 treasure (ducats)

export type PoliticsCard =
    | { id: string; type: 'alliance' }
    | { id: string; type: 'renegade' }
    | { id: string; type: 'parchment'; value: 3 | 4 | 5 }
    | { id: string; type: 'treasure'; value: 8 | 10 | 12 | 15 }

let nextId = 0
const alliance = (): PoliticsCard => ({ id: `politics-${nextId++}`, type: 'alliance' })
const renegade = (): PoliticsCard => ({ id: `politics-${nextId++}`, type: 'renegade' })
const parchment = (value: 3 | 4 | 5): PoliticsCard => ({ id: `politics-${nextId++}`, type: 'parchment', value })
const treasure = (value: 8 | 10 | 12 | 15): PoliticsCard => ({ id: `politics-${nextId++}`, type: 'treasure', value })

export const politicsCardDeck: PoliticsCard[] = [
    alliance(),
    alliance(),
    alliance(),

    renegade(),
    renegade(),
    renegade(),

    parchment(5),
    parchment(4),
    parchment(3),

    treasure(15),
    treasure(12),
    treasure(10),
    treasure(8)
]

function shuffle<T>(items: T[]): T[] {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

// Setup: shuffle the politics deck and deal it into two piles. Since the deck
// has an odd count, one pile ends up with one extra card - doesn't matter which.
export function dealPoliticsPiles(deck: PoliticsCard[]): [PoliticsCard[], PoliticsCard[]] {
    const shuffled = shuffle(deck)
    const half = Math.ceil(shuffled.length / 2)
    const pileA = shuffled.slice(0, half)
    const pileB = shuffled.slice(half)
    return Math.random() < 0.5 ? [pileA, pileB] : [pileB, pileA]
}
