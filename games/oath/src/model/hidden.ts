import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { CardKind, Region } from './oathEnums.js'

/** The server resolves this onto the action as `reveal`. */
export type HiddenRequest =
    | { kind: 'relicDraw'; count: number }
    | { kind: 'discardPeek'; region: Region; count?: number }
    | { kind: 'relicAtSlot'; slotId: string }
    /** Skeleton Key, Ivory Eye — a facedown relic's identity, seen and left where it is. */
    | { kind: 'relicPeekAtSlot'; slotId: string }
    /** Inquisitor, Ivory Eye — another player's facedown adviser, seen and left facedown. */
    | { kind: 'facedownAdviser'; playerId: string; index: number }
    | { kind: 'worldDeckVision' }
    /** Oracular Pig — the top cards of the world deck, seen and left where they are. */
    | { kind: 'worldDeckPeek'; count: number }
    /** Ivory Eye — a facedown site's identity, seen and left facedown. */
    | { kind: 'siteAtSlot'; slotId: string }
    /** Palanquin — a facedown site travelled to is revealed (R-5.6.2). */
    | { kind: 'siteFlip'; siteId: string }
    /** Pilgrimage — these cards go into the Dispossessed, it is shuffled, and as many are drawn. */
    | { kind: 'dispossessedExchange'; cardIds: string[] }

export type HiddenReveal = Type.Static<typeof HiddenReveal>
export const HiddenReveal = Type.Union([
    Type.Object({
        kind: Type.Literal('relics'),
        relicCardIds: Type.Array(Type.String(), { maxItems: 8 })
    }),
    Type.Object({
        kind: Type.Literal('peek'),
        cardIds: Type.Array(Type.String(), { maxItems: 64 })
    }),
    Type.Object({ kind: Type.Literal('relic'), relicCardId: Type.String() }),
    Type.Object({
        kind: Type.Literal('vision'),
        cardId: Type.Optional(Type.String()),
        /** R-9.4 — the world deck's public top back and emptiness once the Vision is out. */
        topCardBackType: Type.Optional(Type.Enum(CardKind)),
        worldDeckExhausted: Type.Boolean()
    }),
    Type.Object({ kind: Type.Literal('site'), siteCardId: Type.Optional(Type.String()) })
])

/** R-9.4 — last id on top; `commitHiddenOutputs` replays them into the vault. */
export type PileDeposit = Type.Static<typeof PileDeposit>
export const PileDeposit = Type.Object({
    region: Type.Enum(Region),
    cardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 64 }), {
        policy: Visibility.Policy.Actor
    }),
    bottom: Type.Optional(Type.Boolean())
})
