import { Hydratable, PlayerState, Visibility, assert, assertExists, Color } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CardKind, PlayerStatus, Region } from './oathEnums.js'
import { WarbandCounts } from './warbandCounts.js'
import { AdviserShownPolicy, HandShownPolicy } from './question.js'
import { isVision } from '../data/cardRegistry.js'

/** R-2.2.2 — one adviser in play order; a facedown one names no card here (R-9.4). */
export type AdviserRow = Type.Static<typeof AdviserRow>
export const AdviserRow = Type.Object({
    cardId: Type.Optional(Type.String()),
    faceUp: Type.Boolean(),
    /** R-9.4 — the players other than its holder who know it while it is facedown; everyone sees a card was shown. */
    shownTo: Type.Optional(Type.Array(Type.String())),
    /** R-9.4 — the card, to those players alone, for as long as it stays here facedown. */
    shownCardId: Type.Optional(Visibility.protect(Type.String(), { policy: AdviserShownPolicy })),
    /** R-9.4 — a Vision's back differs from a denizen's, so a facedown Vision shows as one. */
    vision: Type.Optional(Type.Literal(true)),
    /** The table saw this card go down facedown (Truthful Harp, False Prophet), so `shownCardId` is everyone's. */
    seen: Type.Optional(Type.Literal(true)),
    /** Inquisitor — everyone saw the favor given: this card is not the Conspiracy. */
    notConspiracy: Type.Optional(Type.Literal(true))
})

/** R-9.4 — known to its holder, or to the host. */
export interface KnownAdviser {
    cardId: string
    faceUp: boolean
    shownTo?: string[]
    seen?: boolean
    notConspiracy?: boolean
}

/** R-9.4 — a facedown card handed to another row stays known to its viewers, and to the player who gave it. */
export function handedOver(
    adviser: KnownAdviser,
    fromPlayerId: string,
    toPlayerId: string
): KnownAdviser {
    if (adviser.faceUp) return { cardId: adviser.cardId, faceUp: true }
    const shownTo = [...new Set([...(adviser.shownTo ?? []), fromPlayerId])].filter(
        (playerId) => playerId !== toPlayerId
    )
    return { ...adviser, shownTo }
}

/** A run of cards in a stack, `null` where this player does not know the card. */
export type KnownPositions = Type.Static<typeof KnownPositions>
export const KnownPositions = Type.Array(Type.Union([Type.String(), Type.Null()]))

/** Truthful Harp — the table knows these cards lie here, in an order only their player saw. */
export type SeenSet = Type.Static<typeof SeenSet>
export const SeenSet = Type.Object(
    {
        among: Type.Array(Type.String(), { maxItems: 16 }),
        /** R-9.4 — the back the table saw at this place. */
        back: Type.Optional(Type.Enum(CardKind))
    },
    { additionalProperties: false }
)

/** R-9.4 — a card whose back, but not its face, the table saw go to this place. */
export type SeenBack = Type.Static<typeof SeenBack>
export const SeenBack = Type.Object({ back: Type.Enum(CardKind) }, { additionalProperties: false })

/** What the whole table knows of a stack, by position: a card, one of a set, a back, or `null`. */
export type TablePositions = Type.Static<typeof TablePositions>
export const TablePositions = Type.Array(
    Type.Union([Type.String(), Type.Null(), SeenSet, SeenBack])
)

/** Wild Allies, Captains — "as if your pawn is there". */
export type CampaignAsIf = Type.Static<typeof CampaignAsIf>
export const CampaignAsIf = Type.Object({ siteId: Type.String(), atAction: Type.Number() })

export type OathPlayerState = Type.Static<typeof OathPlayerState>
export const OathPlayerState = Type.Object({
    ...PlayerState.properties,
    status: Type.Enum(PlayerStatus),

    /** R-4.2.a — leftmost is full. */
    supply: Type.Number(),
    /** R-4.3.4 refunds Supply not spent, which the marker alone cannot say. */
    supplySpentThisTurn: Type.Number(),
    /** R-4.3.4's baseline: a mid-turn refresh (R-6.6.2, R-6.7, R-6.8) moves the marker without un-spending. */
    supplyAtTurnStart: Type.Number(),

    favor: Type.Number(),
    secrets: Type.Number(),
    /** R-7.1.2.a — flipped facedown by paying outside your turn; cannot be spent. */
    secretsFacedown: Type.Number(),

    /** R-10.9, R-10.13 — keyed by owner: a Citizen's board holds the Empire's (R-1.15, R-6.6.2). */
    warbandsOnBoard: WarbandCounts,
    /** R-4.3.3 */
    warbandsInPersonalBank: WarbandCounts,

    /** Absent before setup places the pawn (R-1.23.1). */
    siteId: Type.Optional(Type.String()),
    relicIds: Type.Array(Type.String()),
    /** R-2.2.2 — a facedown adviser has no suit, restriction or power (R-5.1.4.II). */
    advisers: Type.Array(AdviserRow),
    /** R-2.2.2, R-9.4 — every adviser's card, row for row, known to its holder alone. */
    adviserIds: Visibility.protect(Type.Array(Type.String()), { policy: Visibility.Policy.Owner }),
    /** R-7.6.4 */
    adviserLimit: Type.Number(),

    /** R-5.1.2, R-1.20 — held only mid-action; Oath has no persistent hand. */
    handIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.anyOf(Visibility.Policy.Owner, HandShownPolicy)
    }),
    handCount: Type.Number(),
    /** R-9.4 — how many held cards show a Vision's back. */
    handVisions: Type.Number(),
    /** Truthful Harp — the table saw this hand, so `handIds` is everyone's until it is set again. */
    handShown: Type.Optional(Type.Literal(true)),
    /** R-2.2.1 — Exile side only; not an adviser. */
    revealedVisionId: Type.Optional(Type.String()),
    /** R-6.3 — "once you have peeked at a specific relic you may peek at it again from any site". */
    peekedRelicSlotIds: Type.Array(Type.String()),
    /** R-6.3 — the relic each of those peeks showed, by slot, known to this player alone; also a relic they knew was drawn onto a slot, which grants no peek. */
    peekedRelics: Visibility.protect(Type.Record(Type.String(), Type.String()), {
        policy: Visibility.Policy.Owner
    }),
    /** Ivory Eye — the facedown sites this player has peeked at, which stay the sites they saw. */
    peekedSiteSlotIds: Type.Array(Type.String()),
    /** Ivory Eye — the site each of those peeks showed, by slot, known to this player alone. */
    peekedSites: Visibility.protect(Type.Record(Type.String(), Type.String()), {
        policy: Visibility.Policy.Owner
    }),
    /** Oracular Pig — the world deck's top cards this player has seen, top first. */
    knownWorldDeckTop: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Owner
    }),
    /** Scryer, Tavern Songs — each discard pile's cards this player has seen, by position from the bottom. */
    knownDiscardPiles: Visibility.protect(Type.Record(Type.Enum(Region), KnownPositions), {
        policy: Visibility.Policy.Owner
    }),
    /** Cracked Horn — the cards this player saw go under the world deck, by position from its bottom. */
    knownWorldDeckBottom: Visibility.protect(KnownPositions, { policy: Visibility.Policy.Owner }),
    /** Relics this player saw sent to the bottom of the relic deck, bottom last. */
    knownRelicDeckBottom: Visibility.protect(KnownPositions, { policy: Visibility.Policy.Owner }),

    /** R-11.2 — Homeland's once-per-turn condition. */
    homelandUsedThisTurn: Type.Array(Type.String()),
    /** R-7.3.4 — `card#index`. */
    restPowersUsedThisTurn: Type.Array(Type.String(), { maxItems: 16 }),
    /** Knights Errant, Hunting Party — the action index at which a Campaign costs no Supply. */
    freeCampaignAtAction: Type.Optional(Type.Number()),
    /** Second Wind — the action index at which a Travel costs no Supply. */
    freeTravelAtAction: Type.Optional(Type.Number()),
    campaignAsIf: Type.Optional(CampaignAsIf)
})

export const OathPlayerStateValidator = Compile(OathPlayerState)
export const OathProjectedPlayerState = Visibility.createProjectionSchema(OathPlayerState)
export type OathProjectedPlayerState = Type.Static<typeof OathProjectedPlayerState>
const OathProjectedPlayerStateValidator = Compile(OathProjectedPlayerState)

export class HydratedOathPlayerState
    extends Hydratable<typeof OathProjectedPlayerState>
    implements OathProjectedPlayerState
{
    declare playerId: string
    declare color: Color

    declare status: PlayerStatus
    declare supply: number
    declare supplySpentThisTurn: number
    declare supplyAtTurnStart: number
    declare favor: number
    declare secrets: number
    declare secretsFacedown: number
    declare freeCampaignAtAction?: number
    declare freeTravelAtAction?: number
    declare campaignAsIf?: CampaignAsIf
    declare warbandsOnBoard: WarbandCounts
    declare warbandsInPersonalBank: WarbandCounts
    declare siteId?: string
    declare relicIds: string[]
    declare advisers: AdviserRow[]
    declare adviserIds?: string[]
    declare adviserLimit: number
    declare handIds?: string[]
    declare handCount: number
    declare handVisions: number
    declare handShown?: true
    declare revealedVisionId?: string
    declare peekedRelicSlotIds: string[]
    declare peekedRelics?: Record<string, string>
    declare peekedSiteSlotIds: string[]
    declare peekedSites?: Record<string, string>
    declare knownWorldDeckTop?: string[]
    declare knownDiscardPiles?: Record<Region, KnownPositions>
    declare knownWorldDeckBottom?: KnownPositions
    declare knownRelicDeckBottom?: KnownPositions
    declare homelandUsedThisTurn: string[]
    declare restPowersUsedThisTurn: string[]

    constructor(data: OathProjectedPlayerState) {
        super(data, OathProjectedPlayerStateValidator)
    }

    knownHand(): string[] {
        assertExists(this.handIds, 'This operation requires a known hand')
        return this.handIds
    }

    setHand(cardIds: string[]): void {
        this.handIds = [...cardIds]
        this.handCount = cardIds.length
        this.handVisions = cardIds.filter(isVision).length
        this.handShown = undefined
    }

    /** R-4.3.3 */
    spendSupply(amount: number): void {
        this.supply -= amount
        this.supplySpentThisTurn += amount
    }

    knownAdviserIds(): string[] {
        assertExists(this.adviserIds, 'This operation requires known advisers')
        return this.adviserIds
    }

    knownAdvisers(): KnownAdviser[] {
        const ids = this.knownAdviserIds()
        return this.advisers.map((row, index) => ({
            cardId: ids[index],
            faceUp: row.faceUp,
            shownTo: row.shownTo,
            seen: row.seen,
            notConspiracy: row.notConspiracy
        }))
    }

    faceupAdviserIds(): string[] {
        return this.advisers
            .filter((row) => row.faceUp)
            .map((row) => {
                assertExists(row.cardId, `${this.playerId} has a faceup adviser with no card`)
                return row.cardId
            })
    }

    facedownAdviserIds(): string[] {
        if (!this.hasFacedownAdvisers()) return []
        return this.knownAdvisers()
            .filter((adviser) => !adviser.faceUp)
            .map((adviser) => adviser.cardId)
    }

    hasFacedownAdvisers(): boolean {
        return this.advisers.some((row) => !row.faceUp)
    }

    /** R-9.4 — a card among the facedown advisers is known to the holder and the host alone. */
    hasAdviser(cardId: string): boolean {
        if (this.isFaceupAdviser(cardId)) return true
        return this.hasFacedownAdvisers() && this.knownAdviserIds().includes(cardId)
    }

    isFaceupAdviser(cardId: string): boolean {
        return this.faceupAdviserIds().includes(cardId)
    }

    /** R-9.4 */
    knownAdviser(cardId: string): KnownAdviser | undefined {
        if (this.isFaceupAdviser(cardId)) return { cardId, faceUp: true }
        if (!this.hasFacedownAdvisers()) return undefined
        return this.knownAdvisers().find((adviser) => adviser.cardId === cardId)
    }

    setAdvisers(advisers: readonly KnownAdviser[]): void {
        this.advisers = advisers.map(
            ({ cardId, faceUp, shownTo, seen, notConspiracy }): AdviserRow => {
                if (faceUp) return { cardId, faceUp }
                const row: AdviserRow = { faceUp }
                if (shownTo && shownTo.length > 0) row.shownTo = shownTo
                if ((shownTo && shownTo.length > 0) || seen) row.shownCardId = cardId
                if (isVision(cardId)) row.vision = true
                if (seen) row.seen = true
                if (notConspiracy) row.notConspiracy = true
                return row
            }
        )
        this.adviserIds = advisers.map(({ cardId }) => cardId)
    }

    /** R-9.4 — the holder let `toPlayerId` peek at this facedown adviser. */
    markShown(cardId: string, toPlayerId: string): void {
        const adviser = this.knownAdviser(cardId)
        assertExists(adviser, `${cardId} is not an adviser of ${this.playerId}`)
        assert(!adviser.faceUp, `${cardId} is faceup; showing it means nothing`)
        const shownTo = [...new Set([...(adviser.shownTo ?? []), toPlayerId])]
        this.replaceAdviser(cardId, { ...adviser, shownTo })
    }

    /** Truthful Harp, False Prophet — the table saw this card go down facedown. */
    markSeen(cardId: string): void {
        const adviser = this.knownAdviser(cardId)
        assertExists(adviser, `${cardId} is not an adviser of ${this.playerId}`)
        if (!adviser.faceUp) this.replaceAdviser(cardId, { ...adviser, seen: true })
    }

    /** Inquisitor — the favor given showed everyone this card is not the Conspiracy. */
    markNotConspiracy(cardId: string): void {
        const adviser = this.knownAdviser(cardId)
        assertExists(adviser, `${cardId} is not an adviser of ${this.playerId}`)
        this.replaceAdviser(cardId, { ...adviser, notConspiracy: true })
    }

    addAdviser(cardId: string, faceUp: boolean): void {
        this.setAdvisers([...this.knownAdvisers(), { cardId, faceUp }])
    }

    removeAdviser(cardId: string): KnownAdviser | undefined {
        const advisers = this.knownAdvisers()
        const removed = advisers.find((adviser) => adviser.cardId === cardId)
        if (removed) this.setAdvisers(advisers.filter((adviser) => adviser !== removed))
        return removed
    }

    replaceAdviser(cardId: string, replacement: KnownAdviser): void {
        this.setAdvisers(
            this.knownAdvisers().map((adviser) =>
                adviser.cardId === cardId ? replacement : adviser
            )
        )
    }

    knownPeekedRelic(slotId: string): string | undefined {
        assertExists(this.peekedRelics, 'This operation requires known peeks')
        return this.peekedRelics[slotId]
    }

    recordPeek(slotId: string, relicCardId: string): void {
        assertExists(this.peekedRelics, 'This operation requires known peeks')
        this.peekedRelics[slotId] = relicCardId
        if (!this.peekedRelicSlotIds.includes(slotId)) this.peekedRelicSlotIds.push(slotId)
    }

    recordSitePeek(slotId: string, siteCardId: string): void {
        assertExists(this.peekedSites, 'This operation requires known peeks')
        this.peekedSites[slotId] = siteCardId
        if (!this.peekedSiteSlotIds.includes(slotId)) this.peekedSiteSlotIds.push(slotId)
    }
}
