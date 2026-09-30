import { removeFavorFromBoard } from '../util/favor.js'
import { burnFavor } from '../util/burn.js'
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
import { concludeCampaign } from '../util/campaignEnd.js'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { isCampaignOutOfTurn } from '../util/sneakAttack.js'
import { MachineState } from '../definition/states.js'
import { afterRelicsTakenPersistent } from '../util/persistent.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { ActionType } from '../definition/actions.js'
import { Banner } from '../model/oathEnums.js'
import { CampaignTargetKind, type CampaignState } from '../model/campaign.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { partiesOf } from '../util/campaignRoll.js'
import { addWarbandsToSite, removeWarbandsFrom } from '../util/force.js'
import { seizeBanner } from '../util/seize.js'
import { commitHiddenOutputs, takeRelicFromVault, type SiteFlip } from '../util/hiddenInputs.js'
import { discardWitnesses } from '../util/knowledge.js'
import { moveRelic, takeRelic, clearSiteRelicSlot } from '../util/relics.js'
import { countOf, describeWarbands } from '../util/warbands.js'
import { WarbandOwner } from '../model/warbandCounts.js'
import { shroudedWoodChooser } from '../util/siteTravel.js'
import { pawnSiteId } from '../util/pawn.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { reasonCannotTravelByPower, travelByPower } from '../util/powerTravel.js'

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
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 }))
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
        const { relicsTaken, bannersSeized, seizeBurned, toBottom } = this.takeSpoils(
            state,
            campaign
        )
        // R-7.1.4 — "after a player takes any relics" (Relic Thief).
        const relicNotes = afterRelicsTakenPersistent(state, campaign.attackerPlayerId, relicsTaken)
        const { banishedToSiteId, favorBurned, revealed, banishNotes } = this.banishAndBurn(
            state,
            campaign
        )
        // R-5.5.8 — the victorious attacker's "if you're victorious" plans, after R-5.5.7.
        const victoryPlans = HydratedCampaignSacrifice.runOutcomeHooks(
            state,
            campaign,
            true,
            (victorious) => victorious
        )

        // Martial Culture's "end your Act Phase" ends nothing for an attacker who is not in theirs.
        const endsActPhase = campaign.endsActPhaseAfter === true && !isCampaignOutOfTurn(state)
        const conclusion = concludeCampaign(state)
        const triggered = [
            ...relicNotes,
            ...banishNotes,
            ...victoryPlans.notes,
            ...conclusion.notes
        ]
        const pileDeposits = [...victoryPlans.pileDeposits, ...conclusion.pileDeposits]

        this.metadata = {
            endsActPhase: endsActPhase || undefined,
            triggered: triggered.length > 0 ? triggered : undefined,
            warbandsPlaced,
            relicsTaken,
            bannersSeized,
            seizeBurned,
            banishedToSiteId,
            favorBurned,
            relicsToDeckBottom: toBottom.length > 0 ? toBottom : undefined,
            revealedSiteCardId: revealed?.siteCardId,
            relicsRevealed: revealed?.relicsRevealed ?? 0,
            resumeMachineState: conclusion.resumeMachineState,
            pileDeposits: pileDeposits.length > 0 ? pileDeposits : undefined
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
        let seizeBurned = 0

        for (const target of campaign.targets) {
            if (target.kind === CampaignTargetKind.Relic && defender) {
                moveRelic(state, defender.playerId, attacker.playerId, target.cardId)
                relicsTaken.push(target.cardId)
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

        return { relicsTaken, bannersSeized, seizeBurned, toBottom }
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
                banishNotes: []
            }
        }

        let banishedToSiteId: string | undefined
        let revealed: SiteFlip | undefined
        let banishNotes: string[] = []
        if (this.banishToSiteId) {
            // R-5.6.2 via R-5.5.7.III; Grasping Vines, Boiling Lake.
            const moved = travelByPower(state, defender.playerId, this.banishToSiteId)
            revealed = moved.revealed
            if (revealed) this.revealsInfo = true
            banishNotes = moved.notes
            banishedToSiteId = this.banishToSiteId
        }
        const chooser = shroudedWoodChooser(state, defender.playerId)
        if (this.banish && chooser !== undefined) {
            const fromSiteId = pawnSiteId(state, defender.playerId)
            askQuestion(state, campaign.attackerPlayerId, {
                kind: PowerQuestionKind.ShroudedWoodDestination,
                cardId: state.siteCardAt(fromSiteId) ?? fromSiteId,
                askedPlayerId: chooser,
                travelerPlayerId: defender.playerId,
                fromSiteId
            })
        }

        let favorBurned = 0
        if (this.burnFavor) {
            favorBurned = removeFavorFromBoard(
                state,
                defender.playerId,
                HydratedCampaignResolveVictory.favorToBurn(state)
            )
            // R-10.4 — burned favor goes to the shared bank, not a suit bank.
            burnFavor(state, favorBurned)
        }

        return { banishedToSiteId, favorBurned, revealed, banishNotes }
    }

    static reasonCannotResolveVictory(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            placements: CampaignPlacement[]
            banishToSiteId?: string
            banish?: boolean
            burnFavor: boolean
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

        const placementReason = HydratedCampaignResolveVictory.reasonCannotPlace(
            state,
            campaign,
            choice.placements
        )
        if (placementReason) return placementReason

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
        const sites = targetedSiteIds(partiesOf(campaign))
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
