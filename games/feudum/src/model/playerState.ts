import { assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { ActionCardKind } from '../data/cards.js'
import { StartingSupply, WineBarrelCapacity } from '../data/components.js'
import type { GuildId } from '../data/components.js'
import type { TileId } from '../data/regionTiles.js'
import type { SealId } from '../data/seals.js'
import type { WritId } from '../data/writs.js'
import {
    ActionCardKindSchema,
    ComponentCount,
    goodCounts,
    GoodCounts,
    GuildIdSchema,
    PawnNumberSchema,
    SealIdSchema,
    SpaceIdSchema,
    TileIdSchema,
    vesselCounts,
    VesselCounts,
    VesselTypeSchema,
    WritIdSchema
} from './stateSchemas.js'

export const PawnNumbers = [1, 2, 3] as const

const OwnerKnown = { policy: Visibility.Policy.Owner }

/** R-1.1, R-4.10.2 A pawn is (playerId, n); off the board it has no space and no character. */
export type PawnState = Type.Static<typeof PawnState>
export const PawnState = Type.Object({
    n: PawnNumberSchema,
    spaceId: Type.Optional(SpaceIdSchema),
    character: Type.Optional(GuildIdSchema),
    vessel: Type.Optional(VesselTypeSchema),
    /** R-4.10.2 One barrel sulfur stands on the pawn, fed this round or drunk the next. */
    wine: Type.Optional(Type.Union([Type.Literal('fed'), Type.Literal('drunk')]))
})

/** R-3.2, R-3.4, R-3.15 A card is (playerId, kind); this is how it was used this round. */
export type PlayedCard = Type.Static<typeof PlayedCard>
export const PlayedCard = Type.Object({
    kind: ActionCardKindSchema,
    use: Type.Union([
        Type.Literal('regular'),
        Type.Literal('special'),
        Type.Literal('forfeited'),
        Type.Literal('defend-flip')
    ]),
    replayedKind: Type.Optional(ActionCardKindSchema),
    dejaVu: Type.Optional(Type.Literal(true))
})

/** R-4.4.1 A writ whose place under the deck someone knows; in the deck while slot >= top. */
export type KnownDeckWrit = Type.Static<typeof KnownDeckWrit>
export const KnownDeckWrit = Type.Object({
    slot: ComponentCount,
    writId: WritIdSchema
})

export type FeudumPlayerState = Type.Static<typeof FeudumPlayerState>
export const FeudumPlayerState = Type.Object({
    ...PlayerState.properties,
    /** R-6 Uncapped; the printed track's wrap is presentation. */
    score: Type.Integer(),
    shillings: ComponentCount,
    /** R-5.3 */
    goods: GoodCounts,
    /** R-4.10.2 */
    barrel: Type.Integer({ minimum: 0, maximum: WineBarrelCapacity }),
    influenceSupply: ComponentCount,
    vessels: VesselCounts,
    pawns: Type.Array(PawnState, {
        minItems: StartingSupply.pawns,
        maxItems: StartingSupply.pawns
    }),
    /** R-4.3.3 Collected, so wild. */
    regionTiles: Type.Array(TileIdSchema),
    /** R-3.11.1 Beads are public; their values follow from the seal's id. */
    beads: Type.Array(SealIdSchema),
    /** R-5-H1 The identities are in the vault. */
    sealCount: ComponentCount,
    /** R-4.4.4 Includes sealed charters. */
    writCount: ComponentCount,
    /** R-4.4.4 Owner-known: unsealed writs. */
    writs: Visibility.protect(Type.Array(WritIdSchema), OwnerKnown),
    sealedCharterCount: ComponentCount,
    /** R-4.4.3, R-4.4.4 Owner-known; `ScoreGame` reveals them in its metadata. */
    sealedCharters: Visibility.protect(Type.Array(WritIdSchema), OwnerKnown),
    /** R-4.4.1 Owner-known: writs this player put under the deck unseen. */
    deckKnowledge: Visibility.protect(Type.Array(KnownDeckWrit), OwnerKnown),
    handCount: ComponentCount,
    /** R-3.1, R-5.1 Owner-known: chosen cards not yet played. */
    hand: Visibility.protect(Type.Array(ActionCardKindSchema), OwnerKnown),
    /** R-3.2 In play order. */
    played: Type.Array(PlayedCard),
    /**
     * R-3.1-H1, R-3.3 Owner-known: the good committed when the hand is finalised, still in `goods`,
     * until every seat has finalised and `RevealPouches` moves it to `pouch`.
     */
    committedPouch: Visibility.protect(
        Type.Optional(Type.Union([Type.Literal('saltpeter'), Type.Literal('sulfur')])),
        OwnerKnown
    ),
    /** R-3.1-H1, R-3.3 Set when the pouch goods are revealed; the good has left `goods`. */
    pouch: Type.Optional(Type.Union([Type.Literal('saltpeter'), Type.Literal('sulfur')])),
    /** R-3.3 */
    sequentialUsed: Type.Boolean(),
    /** R-3.15.1 */
    repeatUsed: Type.Boolean(),
    /** R-3.16.2 This round, feasts included. */
    guildsUsed: Type.Array(GuildIdSchema),
    /** R-3.7.5 This round. */
    successfulMoves: ComponentCount,
    /** R-6.2 The monster-defeat charter asks for it. */
    defeatedMonster: Type.Boolean()
})

export const FeudumPlayerStateValidator = Compile(FeudumPlayerState)

export const FeudumProjectedPlayerState = Visibility.createProjectionSchema(FeudumPlayerState)
export type FeudumProjectedPlayerState = Type.Static<typeof FeudumProjectedPlayerState>
const FeudumProjectedPlayerStateValidator = Compile(FeudumProjectedPlayerState)

export class HydratedFeudumPlayerState
    extends Hydratable<typeof FeudumProjectedPlayerState>
    implements FeudumProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare score: number
    declare shillings: number
    declare goods: GoodCounts
    declare barrel: number
    declare influenceSupply: number
    declare vessels: VesselCounts
    declare pawns: PawnState[]
    declare regionTiles: TileId[]
    declare beads: SealId[]
    declare sealCount: number
    declare writCount: number
    declare writs?: WritId[]
    declare sealedCharterCount: number
    declare sealedCharters?: WritId[]
    declare deckKnowledge?: KnownDeckWrit[]
    declare handCount: number
    declare hand?: ActionCardKind[]
    declare played: PlayedCard[]
    declare committedPouch?: 'saltpeter' | 'sulfur'
    declare pouch?: 'saltpeter' | 'sulfur'
    declare sequentialUsed: boolean
    declare repeatUsed: boolean
    declare guildsUsed: GuildId[]
    declare successfulMoves: number
    declare defeatedMonster: boolean

    constructor(data: FeudumProjectedPlayerState) {
        super(data, FeudumProjectedPlayerStateValidator)
    }

    /** R-3.1, R-5.1 */
    requireHand(): ActionCardKind[] {
        assertExists(this.hand, 'A hand is owner-known')
        return this.hand
    }

    /** R-4.4.4 */
    requireWrits(): WritId[] {
        assertExists(this.writs, 'Unsealed writs are owner-known')
        return this.writs
    }

    /** R-4.4.3, R-4.4.4 */
    requireSealedCharters(): WritId[] {
        assertExists(this.sealedCharters, 'Sealed charters are owner-known')
        return this.sealedCharters
    }

    /** R-4.4.1 */
    requireDeckKnowledge(): KnownDeckWrit[] {
        assertExists(this.deckKnowledge, 'Deck knowledge is owner-known')
        return this.deckKnowledge
    }
}

/** R-1.4.1 A row before setup hands the seat its supply: everything is still in the box. */
export function emptyPlayerRow(playerId: string, color: Color): FeudumPlayerState {
    return {
        playerId,
        color,
        score: 0,
        shillings: 0,
        goods: goodCounts(),
        barrel: 0,
        influenceSupply: 0,
        vessels: vesselCounts(),
        pawns: PawnNumbers.map((n) => ({ n })),
        regionTiles: [],
        beads: [],
        sealCount: 0,
        writCount: 0,
        writs: [],
        sealedCharterCount: 0,
        sealedCharters: [],
        deckKnowledge: [],
        handCount: 0,
        hand: [],
        played: [],
        sequentialUsed: false,
        repeatUsed: false,
        guildsUsed: [],
        successfulMoves: 0,
        defeatedMonster: false
    }
}
