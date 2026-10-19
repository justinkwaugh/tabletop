import { burnHalfTheirFavor } from '../util/burn.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PileDeposit } from '../model/hidden.js'
import { concludeVictory } from '../util/campaignVictory.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'
import { MachineState } from '../definition/states.js'
import { afterRelicsTakenPersistent } from '../util/persistent.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { ActionType } from '../definition/actions.js'
import { Banner } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignState } from '../model/campaign.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { partiesOf } from '../util/campaignRoll.js'
import {
    addWarbandsToSite,
    removeWarbandsFrom,
    returnWarbandsOnCardToBanks
} from '../util/force.js'
import { seizeBanner } from '../util/seize.js'
import { commitHiddenOutputs, takeRelicFromVault, type SiteFlip } from '../util/hiddenInputs.js'
import { discardWitnesses } from '../util/knowledge.js'
import { releaseRelic, takeRelic, clearSiteRelicSlot } from '../util/relics.js'
import { attackerBottomsTakenRelics } from '../util/battlePlans.js'
import { OBSIDIAN_CAGE_ID } from '../data/relics.js'
import { CagePlacement } from '../model/question.js'
import {
    cagedGroupsToBoards,
    cageReturnsToBoards,
    cageWentBackSummary,
    reasonCagePlacementInvalid,
    returnCagedWarbands
} from '../util/obsidianCage.js'
import { countOf, describeWarbands } from '../util/warbands.js'
import { WarbandOwner } from '../model/warbandCounts.js'
import { shroudedWoodChooser } from '../util/siteTravel.js'
import { pawnSiteId } from '../util/pawn.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { reasonCannotTravelByPower, travelByPower } from '../util/powerTravel.js'
import { askBeforePowerMove } from '../util/powerMoveTolls.js'
import { PowerMoveKind, PowerMoveToll, PowerMoveTollOutcome } from '../model/powerMoveToll.js'

/** R-5.5.7.I */
export type CampaignPlacement = Type.Static<typeof CampaignPlacement>
export const CampaignPlacement = Type.Object({
    siteId: Type.String(),
    owner: WarbandOwner,
    count: Type.Integer({ minimum: 0, maximum: 999 })
})

export type CampaignResolveVictoryMetadata = Type.Static<typeof CampaignResolveVictoryMetadata>
export const CampaignResolveVictoryMetadata = Type.Object({
    /** Martial Culture */
    endsActPhase: Type.Optional(Type.Boolean()),
    /** R-7.1.4 (Herald) */
    triggered: Type.Optional(Type.Array(Type.String())),
    warbandsPlaced: Type.Number(),
    /** R-9.4 — one sent to the bottom stays facedown. */
    relicsTaken: Type.Array(Type.String()),
    bannersSeized: Type.Array(Type.Enum(Banner)),
    /** R-2.5.3 — what was actually burned, less near the floor. */
    seizeBurned: Type.Number(),
    banishedToSiteId: Type.Optional(Type.String()),
    favorBurned: Type.Number(),
    /** R-5.5.7.III — whose pawn the banish moved and whose favor burned; absent against the bandits. */
    defenderPlayerId: Type.Optional(Type.String()),
    /** R-5.6.2 via R-5.5.7.III */
    revealedSiteCardId: Type.Optional(Type.String()),
    relicsRevealed: Type.Optional(Type.Number()),
    /** Relic Hunter */
    relicsToDeckBottom: Type.Optional(
        Visibility.protect(Type.Array(Type.String()), { policy: Visibility.Policy.Actor })
    ),
    /** Sneak Attack — where the interrupted turn resumes. */
    resumeMachineState: Type.Optional(Type.Enum(MachineState)),
    /** R-5.5.8, R-9.4 */
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 })),
    /** Toll Roads on the banish. */
    tollMove: Type.Optional(PowerMoveToll)
})

export type CampaignResolveVictory = Type.Static<typeof CampaignResolveVictory>
export const CampaignResolveVictory = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignResolveVictory),
            playerId: Type.String(),
            /** R-5.5.7.I — "any number of your warbands, even zero". */
            placements: Type.Array(CampaignPlacement, { maxItems: 64 }),
            /** R-5.5.7.III — absent to leave the pawn. */
            banishToSiteId: Type.Optional(Type.String()),
            /** R-5.5.7.III, R-11.7 — banished from a Shrouded Wood whose ruler chooses the site. */
            banish: Type.Optional(Type.Boolean()),
            /** R-5.5.7.III */
            burnFavor: Type.Boolean(),
            /** Relic Hunter — "you may put any relics you take on the bottom of the relic deck". */
            bottomRelicSlotIds: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            /** Relic Hunter — the relics taken from the defender's board that go there too. */
            bottomRelicIds: Type.Optional(Type.Array(Type.String(), { maxItems: 8 })),
            /** R-10.13-H1 — the Obsidian Cage sent down: its Imperial warbands, as the attacker places them. */
            cagePlacement: Type.Optional(CagePlacement),
            metadata: Type.Optional(CampaignResolveVictoryMetadata)
        })
    ])
)

export const CampaignResolveVictoryValidator = Compile(CampaignResolveVictory)

export function isCampaignResolveVictory(action?: GameAction): action is CampaignResolveVictory {
    return action?.type === ActionType.CampaignResolveVictory
}

export class HydratedCampaignResolveVictory
    extends HydratableAction<typeof CampaignResolveVictory>
    implements CampaignResolveVictory
{
    declare type: ActionType.CampaignResolveVictory
    declare playerId: string
    declare placements: CampaignPlacement[]
    declare banishToSiteId?: string
    declare banish?: boolean
    declare burnFavor: boolean
    declare bottomRelicSlotIds?: string[]
    declare bottomRelicIds?: string[]
    declare cagePlacement?: CagePlacement
    declare metadata?: CampaignResolveVictoryMetadata

    constructor(data: CampaignResolveVictory) {
        super(data, CampaignResolveVictoryValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = discardWitnesses(state)
        this.revealsInfo = false
        const reason = HydratedCampaignResolveVictory.reasonCannotResolveVictory(
            state,
            this.playerId,
            this
        )
        if (reason) {
            throw Error(`Cannot resolve victory: ${reason}`)
        }

        const campaign = state.campaign
        assertExists(campaign, 'Resolving victory requires a Campaign in progress')

        const warbandsPlaced = this.placeWarbands(state, campaign)
        const { relicsTaken, bannersSeized, seizeBurned, toBottom, cageNotes } = this.takeSpoils(
            state,
            campaign
        )
        // R-7.1.4 — "after a player takes any relics" (Relic Thief); one sent down is not there to take.
        const relicNotes = afterRelicsTakenPersistent(state, campaign.attackerPlayerId, relicsTaken)
        const { banishedToSiteId, favorBurned, revealed, banishNotes, tollMove } =
            this.banishAndBurn(state, campaign)
        // R-5.5.8, after R-5.5.7: a banish waiting on an answer runs it there (`settleBanishedVictory`).
        const conclusion = campaign.banishPending ? undefined : concludeVictory(state)
        const triggered = [
            ...cageNotes,
            ...relicNotes,
            ...banishNotes,
            ...(conclusion?.notes ?? [])
        ]
        const pileDeposits = conclusion?.pileDeposits ?? []

        this.metadata = {
            endsActPhase: conclusion?.endsActPhase || undefined,
            triggered: triggered.length > 0 ? triggered : undefined,
            warbandsPlaced,
            relicsTaken,
            bannersSeized,
            seizeBurned,
            banishedToSiteId,
            favorBurned,
            defenderPlayerId: campaign.defenderPlayerId,
            relicsToDeckBottom: toBottom.length > 0 ? toBottom : undefined,
            revealedSiteCardId: revealed?.siteCardId,
            relicsRevealed: revealed?.relicsRevealed ?? 0,
            resumeMachineState: conclusion?.resumeMachineState,
            pileDeposits: pileDeposits.length > 0 ? pileDeposits : undefined,
            tollMove
        }
        // R-X.3(b): a discard is replayed into the vault, which is never rolled back.
        if (this.metadata.pileDeposits) this.revealsInfo = true
        commitHiddenOutputs(this, state, witnesses)
    }

    /** R-5.5.7.I */
    private placeWarbands(state: HydratedOathGameState, campaign: CampaignState): number {
        let placed = 0
        for (const placement of this.placements) {
            if (placement.count <= 0) continue
            removeWarbandsFrom(
                state,
                { kind: 'board', playerId: campaign.attackerPlayerId },
                placement.owner,
                placement.count
            )
            addWarbandsToSite(state, placement.siteId, placement.owner, placement.count)
            placed += placement.count
        }
        return placed
    }

    private takeSpoils(state: HydratedOathGameState, campaign: CampaignState) {
        const attacker = state.getPlayerState(campaign.attackerPlayerId)
        const defender = campaign.defenderPlayerId
            ? state.getPlayerState(campaign.defenderPlayerId)
            : undefined

        const relicsTaken: string[] = []
        const bannersSeized: Banner[] = []
        const toBottom: string[] = []
        const cageNotes: string[] = []
        let seizeBurned = 0

        for (const target of campaign.targets) {
            if (target.kind === CampaignTargetKind.Relic && defender) {
                releaseRelic(state, defender.playerId, target.cardId)
                if (this.bottomRelicIds?.includes(target.cardId)) {
                    toBottom.push(target.cardId)
                    if (target.cardId === OBSIDIAN_CAGE_ID) cageNotes.push(...this.emptyCage(state))
                    // R-X.3(b) — the relic goes into the vault, which is never rolled back.
                    this.revealsInfo = true
                } else {
                    takeRelic(state, attacker.playerId, target.cardId)
                    relicsTaken.push(target.cardId)
                }
            }
            if (target.kind === CampaignTargetKind.Banner) {
                seizeBurned += seizeBanner(state, target.banner, campaign.attackerPlayerId)
                bannersSeized.push(target.banner)
            }
            if (target.kind === CampaignTargetKind.SiteRelic) {
                const found = state.findRelicSlot(target.slotId)
                assertExists(found, `${target.slotId} is not a relic on the map`)
                const relicCardId = takeRelicFromVault(state, target.slotId)
                clearSiteRelicSlot(state, found.siteId, target.slotId)
                if (this.bottomRelicSlotIds?.includes(target.slotId)) {
                    toBottom.push(relicCardId)
                } else {
                    takeRelic(state, attacker.playerId, relicCardId)
                    relicsTaken.push(relicCardId)
                }
                this.revealsInfo = true
            }
        }

        return { relicsTaken, bannersSeized, seizeBurned, toBottom, cageNotes }
    }

    /**
     * R-10.13-H1 — the Obsidian Cage sent down: its warbands go back as its Action moves them, the
     * Empire's as the attacker places them; before revision 17 (R-X.4) they return to their banks.
     */
    private emptyCage(state: HydratedOathGameState): string[] {
        if (!cageReturnsToBoards(state)) {
            returnWarbandsOnCardToBanks(state, OBSIDIAN_CAGE_ID)
            return []
        }
        const groups = cagedGroupsToBoards(state, this.cagePlacement)
        const wentBack = cageWentBackSummary(returnCagedWarbands(state, groups))
        return wentBack ? [`Obsidian Cage: ${wentBack}`] : []
    }

    private banishAndBurn(state: HydratedOathGameState, campaign: CampaignState) {
        const defender = campaign.defenderPlayerId
            ? state.getPlayerState(campaign.defenderPlayerId)
            : undefined
        if (!defender) {
            return {
                banishedToSiteId: undefined,
                favorBurned: 0,
                revealed: undefined,
                banishNotes: [],
                tollMove: undefined
            }
        }

        let banishedToSiteId: string | undefined
        let revealed: SiteFlip | undefined
        let banishNotes: string[] = []
        // The Hidden Place, Toll Roads — the banished player flips a secret, gives the favor, or
        // refuses, and refusing keeps them here.
        const waits = this.banishToSiteId
            ? askBeforePowerMove(
                  state,
                  {
                      move: PowerMoveKind.Banish,
                      moverPlayerId: campaign.attackerPlayerId,
                      movedPlayerId: defender.playerId,
                      toSiteId: this.banishToSiteId,
                      burnFavor: this.burnFavor || undefined
                  },
                  campaign.attackerPlayerId
              )
            : undefined
        const tollMove = waits?.kind === 'toll' ? waits.tollMove : undefined
        const flipWaits = waits?.kind === 'flip'
        if (this.banishToSiteId && waits === undefined) {
            // R-5.6.2 via R-5.5.7.III; Grasping Vines, Boiling Lake.
            const moved = travelByPower(state, defender.playerId, this.banishToSiteId, {
                playerId: campaign.attackerPlayerId,
                next: false
            })
            revealed = moved.revealed
            if (revealed) this.revealsInfo = true
            banishNotes = moved.notes
            banishedToSiteId = this.banishToSiteId
        }
        const chooser = shroudedWoodChooser(state, defender.playerId)
        const woodPicks = this.banish === true && chooser !== undefined
        if (woodPicks) {
            const fromSiteId = pawnSiteId(state, defender.playerId)
            askQuestion(state, campaign.attackerPlayerId, {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                cardId: state.siteCardAt(fromSiteId) ?? fromSiteId,
                askedPlayerId: chooser,
                travelerPlayerId: defender.playerId,
                fromSiteId
            })
        }

        // R-5.5.7.III — the travel, then the burn, then R-5.5.8: an asked toll's answer comes first,
        // and from `UiBatch1` the Wood ruler's pick does too (R-X.4), and the defender's flip
        // (R-11.13-H1) from revision 15.
        const tollWaits = tollMove?.outcome === PowerMoveTollOutcome.Asked
        const woodWaits = woodPicks && isAtLeastOathRevision(state, OathRevision.UiBatch1)
        if (tollWaits) campaign.banishPending = {}
        if (woodWaits || flipWaits) {
            campaign.banishPending = this.burnFavor ? { burnFavor: true } : {}
        }
        const favorBurned =
            this.burnFavor && !tollWaits && !woodWaits && !flipWaits
                ? burnHalfTheirFavor(state, defender.playerId)
                : 0

        return { banishedToSiteId, favorBurned, revealed, banishNotes, tollMove }
    }

    static reasonCannotResolveVictory(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            placements: CampaignPlacement[]
            banishToSiteId?: string
            banish?: boolean
            burnFavor: boolean
            bottomRelicSlotIds?: readonly string[]
            bottomRelicIds?: readonly string[]
            cagePlacement?: CagePlacement
        }
    ): string | undefined {
        const campaign = state.campaign
        if (!campaign) return 'no Campaign is under way'
        if (campaign.attackerVictorious === undefined) {
            return 'the battle has not been resolved yet'
        }
        if (!campaign.attackerVictorious) {
            return 'the attacker was not victorious, so there is no step 7'
        }
        if (campaign.pendingDefeatKills) {
            return 'the defending side has yet to choose its losses (R-5.5.6.a)'
        }
        if (playerId !== campaign.attackerPlayerId) {
            return 'only the attacker resolves their own victory'
        }
        if (campaign.banishPending) return 'the banish waits on an answer'

        const placementReason = HydratedCampaignResolveVictory.reasonCannotPlace(
            state,
            campaign,
            choice.placements
        )
        if (placementReason) return placementReason

        const bottomReason = HydratedCampaignResolveVictory.reasonCannotBottom(
            state,
            campaign,
            choice
        )
        if (bottomReason) return bottomReason

        return HydratedCampaignResolveVictory.reasonCannotBanish(state, campaign, choice)
    }

    /** R-5.5.7.III — rounded down. */
    static favorToBurn(state: HydratedOathGameState): number {
        const defenderId = state.campaign?.defenderPlayerId
        return defenderId ? Math.floor(state.getPlayerState(defenderId).favor / 2) : 0
    }

    static canDoCampaignResolveVictory(state: HydratedOathGameState, playerId: string): boolean {
        const campaign = state.campaign
        return (
            campaign !== undefined &&
            campaign.attackerVictorious === true &&
            campaign.attackerPlayerId === playerId
        )
    }

    /** R-5.5.7.I — onto targeted sites, out of your own force. */
    private static reasonCannotPlace(
        state: HydratedOathGameState,
        campaign: CampaignState,
        placements: readonly CampaignPlacement[]
    ): string | undefined {
        const sites = targetedSiteIds(partiesOf(state, campaign))
        const board = state.getPlayerState(campaign.attackerPlayerId).warbandsOnBoard

        const wanted = new Map<WarbandOwner, number>()
        for (const placement of placements) {
            if (placement.count < 0) {
                return 'must place at least 0 warbands'
            }
            // R-7.1.4-H1, R-9.2 — Ring of Devotion's "cannot place warbands at
            // sites"; "any number, even zero" (R-5.5.7.I) leaves zero legal.
            if (
                placement.count > 0 &&
                cannotPlaceWarbandsAtSites(state, campaign.attackerPlayerId)
            ) {
                return 'you cannot place warbands at sites (Ring of Devotion)'
            }
            if (!sites.includes(placement.siteId)) {
                return `${placement.siteId} was not targeted, so no warbands may be placed there`
            }
            wanted.set(placement.owner, (wanted.get(placement.owner) ?? 0) + placement.count)
        }

        for (const [owner, count] of wanted) {
            const available = countOf(board, owner)
            if (count > available) {
                // R-5.5.7.I places "from your force", which R-10.9 makes the
                // warbands on your board — already reduced by skulls and sacrifice.
                return `cannot place ${describeWarbands(count, owner)}: only ${available} in your force`
            }
        }
        return undefined
    }

    /**
     * R-5.5.7.II-H1 — Relic Hunter's "any relics you take": a relic taken in this Campaign, from a
     * site or from the defender's board, only when the attacker used it. Banners are no relics.
     */
    private static reasonCannotBottom(
        state: HydratedOathGameState,
        campaign: CampaignState,
        choice: {
            bottomRelicSlotIds?: readonly string[]
            bottomRelicIds?: readonly string[]
            cagePlacement?: CagePlacement
        }
    ): string | undefined {
        const slotIds = choice.bottomRelicSlotIds ?? []
        const cardIds = choice.bottomRelicIds ?? []
        if (slotIds.length + cardIds.length > 0 && !attackerBottomsTakenRelics(state, campaign)) {
            return 'only Relic Hunter, used as your battle plan, puts the relics you take on the bottom of the relic deck'
        }
        const named = new Set<string>()
        for (const slotId of slotIds) {
            if (named.has(slotId)) return `${slotId} is named twice`
            named.add(slotId)
            const targeted = campaign.targets.some(
                (target) => target.kind === CampaignTargetKind.SiteRelic && target.slotId === slotId
            )
            if (!targeted) return `you did not take the facedown relic ${slotId} in this Campaign`
        }
        for (const cardId of cardIds) {
            if (named.has(cardId)) return `${cardId} is named twice`
            named.add(cardId)
            const targeted = campaign.targets.some(
                (target) => target.kind === CampaignTargetKind.Relic && target.cardId === cardId
            )
            if (!targeted || campaign.defenderPlayerId === undefined) {
                return `you did not take ${cardId} from the defender in this Campaign`
            }
        }
        if (cardIds.includes(OBSIDIAN_CAGE_ID) && cageReturnsToBoards(state)) {
            return reasonCagePlacementInvalid(state, choice.cagePlacement)
        }
        return choice.cagePlacement === undefined
            ? undefined
            : 'only the Obsidian Cage sent down places warbands'
    }

    /** R-5.5.7.III — both options need the pawn-and-favor target. */
    private static reasonCannotBanish(
        state: HydratedOathGameState,
        campaign: CampaignState,
        choice: { banishToSiteId?: string; banish?: boolean; burnFavor: boolean }
    ): string | undefined {
        const wantsEither =
            choice.banishToSiteId !== undefined || choice.banish === true || choice.burnFavor
        if (!wantsEither) return undefined

        const targetedPawn = campaign.targets.some(
            (target) => target.kind === CampaignTargetKind.PawnAndFavor
        )
        if (!targetedPawn) {
            return 'you did not target their pawn and favor'
        }

        const defenderId = campaign.defenderPlayerId
        if (!defenderId) {
            return 'the bandits have no pawn or favor'
        }

        // R-11.7 — "its power takes precedence over your choice".
        const woodChooses = shroudedWoodChooser(state, defenderId) !== undefined
        if (choice.banish && !woodChooses) {
            return 'name the site to banish them to; no Shrouded Wood ruler chooses it'
        }
        if (choice.banishToSiteId !== undefined) {
            if (woodChooses) return "the Shrouded Wood's ruler chooses where they go"
            return reasonCannotTravelByPower(state, defenderId, choice.banishToSiteId)
        }
        return undefined
    }
}
