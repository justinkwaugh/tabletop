import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility,
    assertExists
} from '@tabletop/common'
import { TablePositions, OathPlayerState, HydratedOathPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { PowerUse } from './powerUse.js'
import { IMPERIAL_WARBANDS, WarbandCounts, type WarbandOwner } from './warbandCounts.js'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { Banner, CardKind, OathType, Region, SetupVariant, Suit } from './oathEnums.js'
import { CampaignState } from './campaign.js'
import { PendingCampaign } from './pendingCampaign.js'
import { PendingQuestions } from './question.js'
import { PendingConsent } from './consent.js'
import { OathVaultSchema, type OathVault } from './vault.js'

/** R-2.8.2 — actions target the slot; `cardId` fills in once the identity is public (R-9.4). */
export type RelicSlot = Type.Static<typeof RelicSlot>
export const RelicSlot = Type.Object({
    slotId: Type.String()
})

/** R-2.5 — `value` is read by R-5.4.2, R-2.5.2 and R-2.5.3; `mobSide` is the People's Favor only. */
export type BannerState = Type.Static<typeof BannerState>
export const BannerState = Type.Object({
    holderPlayerId: Type.Optional(Type.String()),
    value: Type.Number(),
    mobSide: Type.Optional(Type.Boolean())
})

/** R-7.1.2 — favor and secrets on one card. */
export type CardTokens = Type.Static<typeof CardTokens>
export const CardTokens = Type.Object({ favor: Type.Number(), secrets: Type.Number() })

/** R-2.11.b */
export type PendingOathkeeperChoice = Type.Static<typeof PendingOathkeeperChoice>
export const PendingOathkeeperChoice = Type.Object({
    holderPlayerId: Type.String(),
    candidates: Type.Array(Type.String()),
    resumeMachineState: Type.Enum(MachineState)
})

export type OathGameState = Type.Static<typeof OathGameState>
export const OathGameState = Type.Object({
    ...GameState.properties,
    players: Type.Array(OathPlayerState),
    machineState: Type.Enum(MachineState),

    round: Type.Number(),

    /** R-4.3 — `RestPhase.enter()` re-runs on every action in RestPhase; this stops a second refund. */
    restResolvedForTurnStart: Type.Optional(Type.Number()),
    /** R-7.4 — carried from the Search to its resolve. */
    pendingSearchModifiers: Type.Optional(Type.Array(PowerUse, { maxItems: 8 })),

    /** Grand Scepter — "You cannot use this if you took it on this turn" (R-6.4, R-6.6.1, R-6.7). */
    grandScepterTakenOnTurnStart: Type.Optional(Type.Number()),

    /** An enum, never the pool's ids: public state must not enumerate the deck (R-9.4). */
    setupVariant: Type.Optional(Type.Enum(SetupVariant)),

    /** R-2.1.1, R-1.1 — slot ids by region, top to bottom; R-8.3.5 moves sites between them. */
    map: Type.Record(Type.Enum(Region), Type.Array(Type.String())),
    /** R-9.4 — a slot absent here is facedown; its identity is in the vault until R-5.6.2 flips it. */
    siteCards: Type.Record(Type.String(), Type.String()),
    denizensBySite: Type.Record(Type.String(), Type.Array(Type.String())),
    /** R-7.1.2 — favor and secrets on cards, keyed by card id. */
    cardTokens: Type.Record(Type.String(), CardTokens),
    /** R-2.8.2, R-9.4 — a slot per relic; the count is public, the identity is not. */
    relicsBySite: Type.Record(Type.String(), Type.Array(RelicSlot)),
    warbandsBySite: Type.Record(Type.String(), WarbandCounts),
    /** Obsidian Cage, False Prophet — keyed by card id; in no force (R-10.9), ruling nothing (R-10.21). */
    warbandsOnCards: Type.Record(Type.String(), WarbandCounts),

    /** R-2.3, R-1.17 — a space leaves the array when its relic does. */
    reliquary: Type.Array(RelicSlot),

    favorBank: Type.Record(Type.Enum(Suit), Type.Number()),
    /** R-1.4, R-9.3, R-10.4 — burned favor returns here; returned favor goes to a suit bank. */
    favorSupply: Type.Number(),
    /** R-1.16 — the sites' favor when the bank cannot pay them all; the Chancellor splits it at setup. */
    pendingSiteFavor: Type.Optional(
        Type.Array(Type.Object({ siteCardId: Type.String(), wanted: Type.Number() }), {
            maxItems: 16
        })
    ),
    /** R-2.5 */
    banners: Type.Record(Type.Enum(Banner), BannerState),

    /** R-9.4 — the deck's order and count are private; emptiness is observable. */
    worldDeckExhausted: Type.Boolean(),
    /** R-9.4 — only the first card back is public. */
    topCardBackType: Type.Optional(Type.Enum(CardKind)),
    /** R-2.1.6, R-2.7.1, R-1.2 */
    visionsDrawn: Type.Number(),
    /** R-2.1.2, R-9.4 — counts are public; the piles live in the vault. */
    discardPileCounts: Type.Record(Type.Enum(Region), Type.Number()),
    /** R-9.4 — backs are public. Never written in `commitHiddenOutputs`: clients replay `apply()`. */
    discardTopBackType: Type.Record(Type.Enum(Region), Type.Optional(Type.Enum(CardKind))),
    /** What the whole table saw go onto each pile, by position from its bottom (`util/knowledge.ts`). */
    seenDiscardPiles: Type.Record(Type.Enum(Region), TablePositions),
    /** Cracked Horn with Truthful Harp — what the whole table saw go under the world deck. */
    seenWorldDeckBottom: TablePositions,
    /** R-5.1.4.IV — out of play for this game only; the Chronicle carries no box (R-8.5, R-8.8). */
    boxIds: Type.Array(Type.String()),

    oathType: Type.Enum(OathType),
    oathkeeperPlayerId: Type.Optional(Type.String()),
    /** R-2.11 */
    oathkeeperIsUsurper: Type.Optional(Type.Boolean()),
    /** R-2.11.b */
    pendingOathkeeperChoice: Type.Optional(PendingOathkeeperChoice),
    /** R-5.5 */
    campaign: Type.Optional(CampaignState),
    /** R-5.5.2.a */
    pendingCampaign: Type.Optional(PendingCampaign),
    vault: Visibility.protect(OathVaultSchema, { policy: Visibility.Policy.HostOnly }),
    /** R-X.1 */
    pendingConsent: Type.Optional(PendingConsent),
    pendingQuestions: Type.Optional(PendingQuestions),
    /** Sneak Attack — present while a Campaign runs out of turn. */
    heldTurn: Type.Optional(PendingQuestions),
    /** Salt the Earth (R-2.8.1). */
    siteCapacityOverrides: Type.Record(Type.String(), Type.Number()),
    chancellorPlayerId: Type.Optional(Type.String())
})

export const OathGameStateValidator = Compile(OathGameState)
export const OathProjectedState = Visibility.createProjectionSchema(OathGameState)
export type OathProjectedState = Type.Static<typeof OathProjectedState>
const OathProjectedStateValidator = Compile(OathProjectedState)

/** A pending question as a projection carries it: fields protected from the viewer are absent. */
export type ProjectedPowerQuestion = NonNullable<
    OathProjectedState['pendingQuestions']
>['queue'][number]

export class HydratedOathGameState
    extends HydratableGameState<typeof OathProjectedState, HydratedOathPlayerState>
    implements OathProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedOathPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]

    declare round: number
    declare restResolvedForTurnStart?: number
    declare pendingSearchModifiers?: PowerUse[]
    declare grandScepterTakenOnTurnStart?: number
    declare setupVariant?: SetupVariant
    declare map: Record<Region, string[]>
    declare siteCards: Record<string, string>
    declare denizensBySite: Record<string, string[]>
    declare cardTokens: Record<string, CardTokens>
    declare relicsBySite: Record<string, RelicSlot[]>
    declare warbandsBySite: Record<string, WarbandCounts>
    declare warbandsOnCards: Record<string, WarbandCounts>
    declare reliquary: RelicSlot[]
    declare favorBank: Record<Suit, number>
    declare favorSupply: number
    declare pendingSiteFavor?: { siteCardId: string; wanted: number }[]
    declare banners: Record<Banner, BannerState>
    declare worldDeckExhausted: boolean
    declare topCardBackType?: CardKind
    declare visionsDrawn: number
    declare discardPileCounts: Record<Region, number>
    declare discardTopBackType: Partial<Record<Region, CardKind>>
    declare seenDiscardPiles: Record<Region, TablePositions>
    declare seenWorldDeckBottom: TablePositions
    declare boxIds: string[]
    declare oathType: OathType
    declare oathkeeperPlayerId?: string
    declare oathkeeperIsUsurper?: boolean
    declare pendingOathkeeperChoice?: PendingOathkeeperChoice
    declare campaign?: CampaignState
    declare pendingCampaign?: PendingCampaign
    declare pendingConsent?: PendingConsent
    declare pendingQuestions?: OathProjectedState['pendingQuestions']
    declare heldTurn?: OathProjectedState['heldTurn']
    declare siteCapacityOverrides: Record<string, number>
    declare chancellorPlayerId?: string
    declare vault?: OathProjectedState['vault']

    constructor(data: OathProjectedState) {
        super(data, OathProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedOathPlayerState(player))
    }

    requireVault(): OathVault {
        assertExists(this.vault, 'This operation requires the concealed vault')
        return this.vault
    }

    /** R-2.2 — every map slot belongs to a region; `siteId` must be a slot on the map. */
    regionOf(siteId: string): Region {
        const region = Object.values(Region).find((r) => this.map[r].includes(siteId))
        assertExists(region, `${siteId} is not a site on the map`)
        return region
    }

    /** R-1.7 — every game seats a Chancellor. */
    chancellorId(): string {
        assertExists(this.chancellorPlayerId, 'R-1.7 — every game seats a Chancellor')
        return this.chancellorPlayerId
    }

    /** Undefined while the slot is facedown (R-9.4). */
    siteCardAt(slotId: string | undefined): string | undefined {
        return slotId ? this.siteCards[slotId] : undefined
    }

    /** R-10.21, R-1.23.1, R-1.12 */
    isSiteFaceup(slotId: string): boolean {
        return this.siteCardAt(slotId) !== undefined
    }

    /** R-1.12 — region then top-to-bottom order. */
    faceupSiteIds(): string[] {
        return this.allSiteIds().filter((slotId) => this.isSiteFaceup(slotId))
    }

    warbandsOnCard(cardId: string): WarbandCounts {
        return this.warbandsOnCards[cardId] ?? {}
    }

    tokensOn(cardId: string): CardTokens {
        return this.cardTokens[cardId] ?? { favor: 0, secrets: 0 }
    }

    /** A negative count takes tokens off. */
    addTokensOn(cardId: string, { favor = 0, secrets = 0 }: Partial<CardTokens>) {
        const tokens = this.tokensOn(cardId)
        this.cardTokens[cardId] = { favor: tokens.favor + favor, secrets: tokens.secrets + secrets }
    }

    /** R-10.13 — the player whose bank a warband returns to; the Empire's is the Chancellor's (R-1.8). */
    warbandBankHolderOf(owner: WarbandOwner): string {
        if (owner === IMPERIAL_WARBANDS) return this.chancellorId()
        return this.getPlayerState(owner).playerId
    }

    /** R-9.4 */
    adviserHolderOf(cardId: string): HydratedOathPlayerState | undefined {
        return (
            this.players.find((player) => player.isFaceupAdviser(cardId)) ??
            this.players.find(
                (player) =>
                    player.hasFacedownAdvisers() && player.knownAdviserIds().includes(cardId)
            )
        )
    }

    relicHolderOf(cardId: string): HydratedOathPlayerState | undefined {
        return this.players.find((player) => player.relicIds.includes(cardId))
    }

    /** R-2.8.1 */
    denizensAt(siteId: string): string[] {
        return this.denizensBySite[siteId] ?? []
    }

    /** R-5.2.1, R-5.3.2 — a denizen at the site; not a relic. */
    isMusterableCard(siteId: string, cardId: string): boolean {
        return this.denizensAt(siteId).includes(cardId)
    }

    /** R-2.8.2 */
    relicSlotsAt(siteId: string): RelicSlot[] {
        return this.relicsBySite[siteId] ?? []
    }

    /** R-2.3 — the length is how many are still covered. */
    reliquarySlots(): RelicSlot[] {
        return this.reliquary
    }

    findRelicSlot(slotId: string): { siteId: string; slot: RelicSlot } | undefined {
        for (const [siteId, slots] of Object.entries(this.relicsBySite)) {
            const slot = slots.find((s) => s.slotId === slotId)
            if (slot) {
                return { siteId, slot }
            }
        }
        return undefined
    }

    /** R-2.5.3, R-4.1.1 */
    isOnMobSide(banner: Banner): boolean {
        return this.banners[banner].mobSide === true
    }

    /** R-10.5 — the next region's pile. */
    discardPileCountFor(region: Region): number {
        return this.discardPileCounts[discardRegionFor(region)]
    }

    discardPileCountIn(region: Region): number {
        return this.discardPileCounts[region]
    }

    /** R-9.4 — backs are public. */
    discardTopBackIn(region: Region): CardKind | undefined {
        return this.discardPileCountIn(region) > 0 ? this.discardTopBackType[region] : undefined
    }

    allSiteIds(): string[] {
        return [
            ...this.map[Region.Cradle],
            ...this.map[Region.Provinces],
            ...this.map[Region.Hinterland]
        ]
    }
}

/** R-10.5 — you discard to the next region, never your own. */
export function discardRegionFor(region: Region): Region {
    switch (region) {
        case Region.Cradle:
            return Region.Provinces
        case Region.Provinces:
            return Region.Hinterland
        case Region.Hinterland:
            return Region.Cradle
    }
}
