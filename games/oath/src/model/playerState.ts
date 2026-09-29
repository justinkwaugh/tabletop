import { Hydratable, PlayerState, Visibility, assert, assertExists, Color } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { PlayerStatus } from './oathEnums.js'
import { WarbandCounts } from './warbandCounts.js'
import { AdviserShownPolicy } from './question.js'

/** R-2.2.2 — one adviser in play order; a facedown one names no card here (R-9.4). */
export type AdviserRow = Type.Static<typeof AdviserRow>
export const AdviserRow = Type.Object({
    cardId: Type.Optional(Type.String()),
    faceUp: Type.Boolean(),
    /** R-9.4 — the players its holder let peek while it is facedown; everyone sees a card was shown. */
    shownTo: Type.Optional(Type.Array(Type.String())),
    /** R-9.4 — the card, to those players alone, for as long as it stays here facedown. */
    shownCardId: Type.Optional(Visibility.protect(Type.String(), { policy: AdviserShownPolicy }))
})

/** R-9.4 — known to its holder, or to the host. */
export interface KnownAdviser {
    cardId: string
    faceUp: boolean
    shownTo?: string[]
}

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

    /** R-10.9, R-10.13 — keyed by colour: a Citizen's board holds purple (R-1.15, R-6.6.2). */
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
    handIds: Visibility.protect(Type.Array(Type.String()), { policy: Visibility.Policy.Owner }),
    handCount: Type.Number(),
    /** R-2.2.2 */
    visionIds: Type.Array(Type.String()),
    /** R-2.2.1 — Exile side only; not an adviser. */
    revealedVisionId: Type.Optional(Type.String()),
    /** R-6.3 — "once you have peeked at a specific relic you may peek at it again from any site". */
    peekedRelicSlotIds: Type.Array(Type.String()),
    /** R-6.3 — the relic each of those peeks showed, by slot, known to this player alone. */
    peekedRelics: Visibility.protect(Type.Record(Type.String(), Type.String()), {
        policy: Visibility.Policy.Owner
    }),

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
    declare visionIds: string[]
    declare revealedVisionId?: string
    declare peekedRelicSlotIds: string[]
    declare peekedRelics?: Record<string, string>
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
            shownTo: row.shownTo
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
        this.advisers = advisers.map(({ cardId, faceUp, shownTo }) => {
            if (faceUp) return { cardId, faceUp }
            if (shownTo && shownTo.length > 0) return { faceUp, shownTo, shownCardId: cardId }
            return { faceUp }
        })
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
}
