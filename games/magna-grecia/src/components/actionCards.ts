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

const { Red, Yellow, Gray, Blue } = Color

export const ACTION_CARDS: ActionCard[] = [
    card('R1', [Red, Gray, Blue, Yellow], 2, 3, 5),
    card('R2', [Red, Yellow, Gray, Blue], 2, 1, 3),
    card('R3', [Red, Blue, Yellow, Gray], 2, 2, 3),
    card('Y1', [Yellow, Red, Blue, Gray], 3, 1, 2),
    card('Y2', [Yellow, Blue, Gray, Red], 3, 2, 5),
    card('Y3', [Yellow, Gray, Red, Blue], 1, 2, 3),
    card('G1', [Gray, Yellow, Red, Blue], 2, 3, 2),
    card('G2', [Gray, Blue, Yellow, Red], 2, 2, 5),
    card('G3', [Gray, Red, Blue, Yellow], 2, 1, 2),
    card('B1', [Blue, Yellow, Gray, Red], 2, 2, 2),
    card('B2', [Blue, Red, Yellow, Gray], 2, 3, 3),
    card('B3', [Blue, Gray, Red, Yellow], 2, 1, 5)
]

function card(
    id: string,
    turnOrder: Color[],
    roads: number,
    cities: number,
    resupply: number
): ActionCard {
    const border = turnOrder[0]
    assertExists(border, `Action card ${id} has no turn order`)
    return { id, border, roads, cities, resupply, turnOrder }
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
    const stacks = [Red, Yellow, Gray, Blue].map((border) => {
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
