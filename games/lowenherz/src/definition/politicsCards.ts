import * as Type from 'typebox'

// Data for the Löwenherz politics card deck (13 cards: 3 Alliance, 3 Renegade,
// 3 Parchment, 4 Treasure). Effects for each type aren't built yet - this is just
// the deck/pile model behind the "Crown and Scepter" action (take a politics card).

export enum PoliticsCardType {
    Alliance = 'alliance',
    Renegade = 'renegade',
    Parchment = 'parchment',
    Treasure = 'treasure'
}

export type PoliticsCard = Type.Static<typeof PoliticsCard>
export const PoliticsCard = Type.Object({
    id: Type.String(),
    type: Type.Enum(PoliticsCardType),
    // Power points (Parchment) or ducats (Treasure) printed on the card - unset for
    // Alliance/Renegade, which have no number.
    value: Type.Optional(Type.Number())
})

function alliance(id: string): PoliticsCard {
    return { id, type: PoliticsCardType.Alliance }
}
function renegade(id: string): PoliticsCard {
    return { id, type: PoliticsCardType.Renegade }
}
function parchment(id: string, value: 3 | 4 | 5): PoliticsCard {
    return { id, type: PoliticsCardType.Parchment, value }
}
function treasure(id: string, value: 8 | 10 | 12 | 15): PoliticsCard {
    return { id, type: PoliticsCardType.Treasure, value }
}

export const PoliticsCardDeck: PoliticsCard[] = [
    alliance('politics-alliance-1'),
    alliance('politics-alliance-2'),
    alliance('politics-alliance-3'),

    renegade('politics-renegade-1'),
    renegade('politics-renegade-2'),
    renegade('politics-renegade-3'),

    parchment('politics-parchment-3', 3),
    parchment('politics-parchment-4', 4),
    parchment('politics-parchment-5', 5),

    treasure('politics-treasure-8', 8),
    treasure('politics-treasure-10', 10),
    treasure('politics-treasure-12', 12),
    treasure('politics-treasure-15', 15)
]
