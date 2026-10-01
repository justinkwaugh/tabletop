import * as Type from 'typebox'
import { Region, Suit } from './oathEnums.js'
import { WarbandGroup } from './campaign.js'
import { ExchangeTerms } from './question.js'

// R-7.1.3, R-X.1 — the engine never infers a choice, so every choice a power opens arrives on the action.

export enum PowerChoiceKind {
    /** R-7.1.3 — the bare "may". */
    Yes = 'yes',
    FavorBank = 'favorBank',
    Player = 'player',
    Card = 'card',
    Site = 'site',
    Warbands = 'warbands',
    Region = 'region',
    RelicSlot = 'relicSlot',
    /** R-9.4 */
    FacedownAdviser = 'facedownAdviser',
    /** R-7.6.3 — the card's effect validates the terms. */
    Exchange = 'exchange',
    /** The card's effect bounds the number. */
    Count = 'count'
}

export type PowerChoice = Type.Static<typeof PowerChoice>
export const PowerChoice = Type.Union([
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Yes) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.FavorBank), suit: Type.Enum(Suit) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Player), playerId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Card), cardId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Site), siteId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Warbands), group: WarbandGroup }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Region), region: Type.Enum(Region) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.RelicSlot), slotId: Type.String() }),
    Type.Object({
        kind: Type.Literal(PowerChoiceKind.FacedownAdviser),
        playerId: Type.String(),
        index: Type.Integer({ minimum: 0, maximum: 15 })
    }),
    Type.Object({
        kind: Type.Literal(PowerChoiceKind.Exchange),
        withPlayerId: Type.String(),
        terms: ExchangeTerms
    }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Count), n: Type.Number() })
])
