import * as Type from 'typebox'

// Data for the Löwenherz action card deck. Each physical card has a face (top/middle/
// bottom bands, or a unique special design) and a back (one of five card-back designs,
// A-E). The A cards are only used with the variable construction rules, not the basic
// game - see assembleActionDeck().

export enum CardBack {
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D',
    E = 'E'
}

export enum ActionCardType {
    Standard = 'standard',
    Mining = 'mining',
    KingIsDead = 'kingIsDead'
}

export type TopBand = Type.Static<typeof TopBand>
export const TopBand = Type.Union([
    Type.Object({
        kind: Type.Literal('income'),
        value: Type.Union([Type.Literal(4), Type.Literal(6), Type.Literal(8)])
    }),
    Type.Object({ kind: Type.Literal('politics') })
])

export type MidBottomBand = Type.Static<typeof MidBottomBand>
export const MidBottomBand = Type.Object({
    kind: Type.Union([Type.Literal('border'), Type.Literal('knight')]),
    count: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])
})

export type SlotKind = Type.Static<typeof SlotKind>
export const SlotKind = Type.Union([
    Type.Literal('income'),
    Type.Literal('politics'),
    Type.Literal('border'),
    Type.Literal('knight')
])

export type StandardActionCard = Type.Static<typeof StandardActionCard>
export const StandardActionCard = Type.Object({
    id: Type.String(),
    back: Type.Enum(CardBack),
    type: Type.Literal(ActionCardType.Standard),
    top: TopBand,
    middle: MidBottomBand,
    bottom: MidBottomBand
})

export type MiningActionCard = Type.Static<typeof MiningActionCard>
export const MiningActionCard = Type.Object({
    id: Type.String(),
    back: Type.Enum(CardBack),
    type: Type.Literal(ActionCardType.Mining)
})

export type KingIsDeadActionCard = Type.Static<typeof KingIsDeadActionCard>
export const KingIsDeadActionCard = Type.Object({
    id: Type.String(),
    back: Type.Enum(CardBack),
    type: Type.Literal(ActionCardType.KingIsDead)
})

export type ActionCard = Type.Static<typeof ActionCard>
export const ActionCard = Type.Union([StandardActionCard, MiningActionCard, KingIsDeadActionCard])

export function slotKindForCard(card: StandardActionCard, slot: 1 | 2 | 3): SlotKind {
    return slot === 1 ? card.top.kind : slot === 2 ? card.middle.kind : card.bottom.kind
}

const income = (value: 4 | 6 | 8): TopBand => ({ kind: 'income', value })
const politics: TopBand = { kind: 'politics' }
const border = (count: 1 | 2 | 3): MidBottomBand => ({ kind: 'border', count })
const knight = (count: 1 | 2 | 3): MidBottomBand => ({ kind: 'knight', count })

let nextId = 0
const standard = (
    back: CardBack,
    top: TopBand,
    middle: MidBottomBand,
    bottom: MidBottomBand
): StandardActionCard => ({
    id: `action-${nextId++}`,
    back,
    type: ActionCardType.Standard,
    top,
    middle,
    bottom
})
const mining = (back: CardBack): MiningActionCard => ({
    id: `action-${nextId++}`,
    back,
    type: ActionCardType.Mining
})
const kingIsDead = (back: CardBack): KingIsDeadActionCard => ({
    id: `action-${nextId++}`,
    back,
    type: ActionCardType.KingIsDead
})

// 31 cards total: 6 back-A, 7 back-B, 7 back-C, 7 back-D, 4 back-E
export const ActionCardDeck: ActionCard[] = [
    // Back A
    standard(CardBack.A, income(4), border(2), knight(1)),
    standard(CardBack.A, income(6), border(2), knight(1)),
    standard(CardBack.A, politics, border(3), knight(1)),
    standard(CardBack.A, politics, border(2), border(3)),
    standard(CardBack.A, income(8), border(2), border(3)),
    standard(CardBack.A, income(6), border(3), knight(1)),

    // Back B
    standard(CardBack.B, income(8), border(2), knight(2)),
    standard(CardBack.B, income(6), border(2), knight(1)),
    mining(CardBack.B),
    standard(CardBack.B, politics, border(2), knight(2)),
    standard(CardBack.B, politics, border(3), knight(1)),
    standard(CardBack.B, politics, border(2), border(3)),
    standard(CardBack.B, income(4), border(2), knight(1)),

    // Back C
    mining(CardBack.C),
    standard(CardBack.C, income(4), border(2), knight(2)),
    standard(CardBack.C, income(6), border(2), knight(1)),
    standard(CardBack.C, politics, border(2), knight(1)),
    standard(CardBack.C, income(8), border(3), knight(2)),
    standard(CardBack.C, politics, knight(1), knight(2)),
    standard(CardBack.C, politics, border(1), border(2)),

    // Back D
    standard(CardBack.D, income(4), border(2), knight(2)),
    standard(CardBack.D, income(8), knight(1), knight(2)),
    standard(CardBack.D, income(6), knight(1), knight(2)),
    mining(CardBack.D),
    standard(CardBack.D, politics, border(2), knight(1)),
    standard(CardBack.D, politics, border(3), knight(2)),
    standard(CardBack.D, politics, border(1), border(2)),

    // Back E
    standard(CardBack.E, politics, border(2), knight(2)),
    standard(CardBack.E, politics, knight(1), knight(2)),
    standard(CardBack.E, income(8), knight(1), knight(2)),
    kingIsDead(CardBack.E)
]
