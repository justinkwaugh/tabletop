import { Color, assertExists, shuffle, type RandomFunction } from '@tabletop/common'

export type ActionCard = {
    id: string
    border: Color
    roads: number
    cities: number
    resupply: number
    turnOrder: Color[]
}

export const RESUPPLY_STEPS = [2, 3, 5, 7] as const

// Seven cards are read from published photos; the Y3, O2, O3, R2 and R3 values are reconstructed.
export const ACTION_CARDS: ActionCard[] = [
    card('Y1', Color.Yellow, 3, 2, 5, [Color.Orange, Color.Brown, Color.Red]),
    card('Y2', Color.Yellow, 1, 2, 3, [Color.Brown, Color.Red, Color.Orange]),
    card('Y3', Color.Yellow, 2, 3, 2, [Color.Red, Color.Orange, Color.Brown]),
    card('O1', Color.Orange, 2, 2, 2, [Color.Yellow, Color.Brown, Color.Red]),
    card('O2', Color.Orange, 3, 1, 3, [Color.Red, Color.Yellow, Color.Brown]),
    card('O3', Color.Orange, 1, 3, 5, [Color.Brown, Color.Red, Color.Yellow]),
    card('R1', Color.Red, 2, 1, 3, [Color.Yellow, Color.Brown, Color.Orange]),
    card('R2', Color.Red, 1, 2, 5, [Color.Orange, Color.Yellow, Color.Brown]),
    card('R3', Color.Red, 3, 2, 2, [Color.Brown, Color.Orange, Color.Yellow]),
    card('B1', Color.Brown, 2, 2, 5, [Color.Orange, Color.Yellow, Color.Red]),
    card('B2', Color.Brown, 2, 3, 2, [Color.Yellow, Color.Red, Color.Orange]),
    card('B3', Color.Brown, 2, 1, 2, [Color.Red, Color.Orange, Color.Yellow])
]

function card(
    id: string,
    border: Color,
    roads: number,
    cities: number,
    resupply: number,
    followers: Color[]
): ActionCard {
    return { id, border, roads, cities, resupply, turnOrder: [border, ...followers] }
}

export function actionCard(id: string): ActionCard {
    const found = ACTION_CARDS.find((candidate) => candidate.id === id)
    assertExists(found, `Unknown action card ${id}`)
    return found
}

export function enhancedResupply(resupply: number): number {
    const index = RESUPPLY_STEPS.findIndex((step) => step === resupply)
    return RESUPPLY_STEPS[Math.min(index + 1, RESUPPLY_STEPS.length - 1)]
}

// Rulebook setup: shuffle each border colour, then build three shuffled layers of one card per colour.
export function buildActionDeck(random: RandomFunction): string[] {
    const stacks = [Color.Yellow, Color.Orange, Color.Red, Color.Brown].map((border) => {
        const stack = ACTION_CARDS.filter((candidate) => candidate.border === border).map(
            (candidate) => candidate.id
        )
        shuffle(stack, random)
        return stack
    })
    const deck: string[] = []
    for (let layer = 0; layer < 3; layer++) {
        const drawn = stacks.map((stack) => stack[layer])
        shuffle(drawn, random)
        deck.push(...drawn)
    }
    return deck
}
