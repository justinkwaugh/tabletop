import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { PileDeposit } from '../model/hidden.js'
import { commitHiddenOutputs, showTakenSiteRelics } from '../util/hiddenInputs.js'
import { tableWitnesses } from '../util/knowledge.js'
import {
    banditPlanContext,
    killOrRedirect,
    partiesOf,
    usedPlanContext,
    killFromAttackingForce
} from '../util/campaignRoll.js'
import { concludeCampaign } from '../util/campaignEnd.js'
import { MachineState } from '../definition/states.js'
import { isImperialPlayer } from '../util/rule.js'
import { collectAttackingForce, scopeOf } from '../util/campaign.js'
import {
    BANDITS_PLAN_USER,
    ignoresKillAll,
    plansUsedBy,
    playerIdsOnSide,
    sideOf
} from '../util/battlePlans.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { ActionType } from '../definition/actions.js'
import { WarbandGroup, type CampaignState } from '../model/campaign.js'
import {
    forceTotal,
    takeFromGroups,
    moveForceToBoards,
    selectionExceedsForce,
    defeatChoiceMatters,
    defeatPickMatters,
    soleOwner
} from '../util/force.js'
import { BRUTAL, hasTrait } from '../util/reliquaryTraits.js'
import { reasonPersistentForbidsSacrifice } from '../util/persistent.js'
import { WarbandOwner } from '../model/warbandCounts.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

export type CampaignSacrificeMetadata = Type.Static<typeof CampaignSacrificeMetadata>
export const CampaignSacrificeMetadata = Type.Object({
    /** R-5.5.5 */
    attack: Type.Number(),
    defense: Type.Number(),
    attackerVictorious: Type.Boolean(),
    sacrificed: Type.Number(),
    /** R-10.13 — whose warbands were sacrificed, when they were one owner's. */
    sacrificedOwner: Type.Optional(WarbandOwner),
    /** R-5.5.6 — rounded down; absent while the defending side chooses. */
    defeatKilled: Type.Optional(Type.Number()),
    /** R-5.5.6.a */
    awaitingLossesOf: Type.Optional(Type.String()),
    /** R-5.5.8 */
    planNotes: Type.Optional(Type.Array(Type.String())),
    /** Sneak Attack — where the interrupted turn resumes. */
    resumeMachineState: Type.Optional(Type.Enum(MachineState)),
    /** R-5.5.8, R-9.4 */
    pileDeposits: Type.Optional(Type.Array(PileDeposit, { maxItems: 8 }))
})

export type CampaignSacrifice = Type.Static<typeof CampaignSacrifice>
export const CampaignSacrifice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CampaignSacrifice),
            playerId: Type.String(),
            /** R-5.5.5 — zero, or exactly as many as needed to win (R-5.5.5.c). */
            sacrifice: Type.Integer({ minimum: 0, maximum: 999 }),
            /** R-5.5.5, R-10.22 — which of the force's warbands are sacrificed, when it holds more than one kind. */
            sacrificeKills: Type.Optional(Type.Array(WarbandGroup, { maxItems: 64 })),
            /** R-5.5.6 — only when the attacker is defeated. */
            defeatKills: Type.Optional(Type.Array(WarbandGroup, { maxItems: 64 })),
            metadata: Type.Optional(CampaignSacrificeMetadata)
        })
    ])
)

export const CampaignSacrificeValidator = Compile(CampaignSacrifice)

export function isCampaignSacrifice(action?: GameAction): action is CampaignSacrifice {
    return action?.type === ActionType.CampaignSacrifice
}

export class HydratedCampaignSacrifice
    extends HydratableAction<typeof CampaignSacrifice>
    implements CampaignSacrifice
{
    declare type: ActionType.CampaignSacrifice
    declare playerId: string
    declare sacrifice: number
    declare sacrificeKills?: WarbandGroup[]
    declare defeatKills?: WarbandGroup[]
    declare metadata?: CampaignSacrificeMetadata

    constructor(data: CampaignSacrifice) {
        super(data, CampaignSacrificeValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = tableWitnesses(state)
        this.revealsInfo = false
        const reason = HydratedCampaignSacrifice.reasonCannotResolve(state, this.playerId, this)
        if (reason) {
            throw Error(`Cannot resolve Campaign: ${reason}`)
        }

        const campaign = state.campaign
        assertExists(campaign, 'A sacrifice requires a Campaign in progress')

        // R-5.5.5
        const sacrificedOwner = soleOwner(this.killSacrifice(state, campaign))
        const attack = HydratedCampaignSacrifice.attackTotal(campaign, this.sacrifice)

        // R-5.5.5.b — strictly higher: a tie is the defender's, unless a plan decided it already.
        const attackerVictorious = HydratedCampaignSacrifice.isVictorious(campaign, this.sacrifice)
        campaign.attackerVictorious = attackerVictorious
        // Relic Hunter — the relics a victory takes are seen before any goes to the bottom.
        if (attackerVictorious && showTakenSiteRelics(state, campaign)) this.revealsInfo = true

        // R-5.5.6.a
        const chooserId = attackerVictorious
            ? HydratedCampaignSacrifice.lossChooser(state, campaign)
            : undefined
        if (chooserId) {
            campaign.pendingDefeatKills = { chooserPlayerId: chooserId }
            this.metadata = {
                attack,
                defense: campaign.defense,
                attackerVictorious,
                sacrificed: this.sacrifice,
                sacrificedOwner,
                awaitingLossesOf: chooserId
            }
            return
        }

        // R-5.5.6
        const kills = attackerVictorious
            ? HydratedCampaignSacrifice.defaultDefeatKills(state, this.sacrifice)
            : (this.defeatKills ?? [])
        const finished = HydratedCampaignSacrifice.finishBattle(state, campaign, kills)
        this.metadata = {
            attack,
            defense: campaign.defense,
            attackerVictorious,
            sacrificed: this.sacrifice,
            sacrificedOwner,
            ...finished
        }

        // R-X.3(b): a discard is replayed into the vault, which is never rolled back.
        if (this.metadata.pileDeposits) {
            this.revealsInfo = true
            commitHiddenOutputs(this, state, witnesses)
        }
    }

    /** R-5.5.6 to R-5.5.8 */
    static finishBattle(
        state: HydratedOathGameState,
        campaign: CampaignState,
        kills: readonly WarbandGroup[]
    ): {
        defeatKilled: number
        planNotes?: string[]
        resumeMachineState?: MachineState
        pileDeposits?: PileDeposit[]
    } {
        const attackerVictorious = campaign.attackerVictorious === true
        const defeatedForce = attackerVictorious
            ? campaign.defendingForce
            : HydratedCampaignSacrifice.attackerForce(state, campaign)
        const { defeatKilled, survivorsNote } = HydratedCampaignSacrifice.resolveDefeat(
            state,
            campaign,
            defeatedForce,
            kills,
            attackerVictorious
        )
        campaign.defeatKilled = defeatKilled

        // R-5.5.6 now; R-5.5.8's "if you're victorious" waits for R-5.5.7 when the attacker won.
        const outcomes = HydratedCampaignSacrifice.runOutcomeHooks(
            state,
            campaign,
            attackerVictorious,
            (victorious) => !(attackerVictorious && victorious)
        )
        const planNotes = [...(survivorsNote ? [survivorsNote] : []), ...outcomes.notes]

        // R-5.5.7 is for a victorious attacker; a defeated one's Campaign ends here.
        const conclusion = attackerVictorious ? undefined : concludeCampaign(state)
        planNotes.push(...(conclusion?.notes ?? []))
        const pileDeposits = [...outcomes.pileDeposits, ...(conclusion?.pileDeposits ?? [])]

        return {
            defeatKilled,
            planNotes: planNotes.length > 0 ? planNotes : undefined,
            resumeMachineState: conclusion?.resumeMachineState,
            pileDeposits: pileDeposits.length > 0 ? pileDeposits : undefined
        }
    }

    /** R-5.5.6.a */
    static lossChooser(state: HydratedOathGameState, campaign: CampaignState): string | undefined {
        const force = campaign.defendingForce
        const required = HydratedCampaignSacrifice.requiredKills(state, campaign, force)
        if (required === 0 || required >= forceTotal(force) || force.length < 2) return undefined
        if (
            isAtLeastOathRevision(state, OathRevision.TurnFlow) &&
            !HydratedCampaignSacrifice.defendingLossesMatter(state, force)
        ) {
            return undefined
        }
        const defenderId = campaign.defenderPlayerId
        assertExists(defenderId, 'A defending force with warbands to choose from has a defender')
        return isImperialPlayer(state, defenderId, scopeOf(partiesOf(state, campaign)))
            ? state.chancellorId()
            : defenderId
    }

    /** R-5.5.6-H1 — from revision 7, only losses that can end in another bank or on another board. */
    private static defendingLossesMatter(
        state: HydratedOathGameState,
        force: readonly WarbandGroup[]
    ): boolean {
        return isAtLeastOathRevision(state, OathRevision.EngineFixes3)
            ? defeatPickMatters(state, force)
            : defeatChoiceMatters(force)
    }

    /** R-5.5.5, R-10.22 — sacrificing is choosing to kill your own warbands. */
    private killSacrifice(state: HydratedOathGameState, campaign: CampaignState): WarbandGroup[] {
        if (this.sacrifice <= 0) return []
        if (!this.sacrificeKills) {
            return killFromAttackingForce(state, campaign, this.sacrifice)
        }
        for (const group of this.sacrificeKills) {
            killOrRedirect(
                state,
                campaign,
                BattlePlanSide.Attacker,
                group.at,
                group.owner,
                group.count
            )
        }
        return this.sacrificeKills
    }

    private static resolveDefeat(
        state: HydratedOathGameState,
        campaign: CampaignState,
        force: readonly WarbandGroup[],
        kills: readonly WarbandGroup[],
        attackerVictorious: boolean
    ): { defeatKilled: number; survivorsNote?: string } {
        const victorSide = attackerVictorious ? BattlePlanSide.Attacker : BattlePlanSide.Defender
        const defeatedSide = attackerVictorious ? BattlePlanSide.Defender : BattlePlanSide.Attacker
        for (const group of kills) {
            killOrRedirect(state, campaign, defeatedSide, group.at, group.owner, group.count)
        }

        const survivors = HydratedCampaignSacrifice.subtractSelection(force, kills)
        const survivorsNote = HydratedCampaignSacrifice.victorTakesSurvivors(
            state,
            campaign,
            victorSide,
            survivors
        )
        if (survivorsNote === undefined) {
            moveForceToBoards(
                state,
                survivors,
                attackerVictorious ? undefined : campaign.attackerPlayerId
            )
        }
        return { defeatKilled: forceTotal(kills), survivorsNote }
    }

    private static victorTakesSurvivors(
        state: HydratedOathGameState,
        campaign: CampaignState,
        victorSide: BattlePlanSide,
        survivors: readonly WarbandGroup[]
    ): string | undefined {
        for (const playerId of playerIdsOnSide(campaign, victorSide)) {
            for (const plan of plansUsedBy(state, campaign, playerId)) {
                const take = plan.hooks.takesEnemySurvivors
                if (take) {
                    return take(usedPlanContext(state, campaign, playerId, plan), survivors)
                }
            }
        }
        return undefined
    }

    static sacrificeNeeded(campaign: CampaignState): number {
        if (campaign.decidedVictor) return 0
        const shortfall = campaign.defense + 1 - campaign.swords
        return Math.max(0, Math.ceil(shortfall / campaign.sacrificeWorth))
    }

    /** R-5.5.5 */
    static attackTotal(campaign: CampaignState, sacrifice: number): number {
        return campaign.swords + sacrifice * campaign.sacrificeWorth
    }

    /** R-5.5.5.b, or a plan's "you're victorious now" (Hearts and Minds, Peace Envoy). */
    static isVictorious(campaign: CampaignState, sacrifice: number): boolean {
        if (campaign.decidedVictor) return campaign.decidedVictor === 'attacker'
        return HydratedCampaignSacrifice.attackTotal(campaign, sacrifice) > campaign.defense
    }

    static defaultDefeatKills(state: HydratedOathGameState, sacrifice: number): WarbandGroup[] {
        const campaign = state.campaign
        assertExists(campaign, 'the sacrifice step runs inside a Campaign')

        const attackerVictorious = HydratedCampaignSacrifice.isVictorious(campaign, sacrifice)
        const defeated = attackerVictorious
            ? campaign.defendingForce
            : HydratedCampaignSacrifice.attackerForce(state, campaign, sacrifice)

        return takeFromGroups(
            defeated,
            HydratedCampaignSacrifice.requiredKills(state, campaign, defeated)
        )
    }

    /** R-5.5.6 */
    static attackerDefeatKills(state: HydratedOathGameState, sacrifice: number): WarbandGroup[] {
        const campaign = state.campaign
        assertExists(campaign, 'the sacrifice step runs inside a Campaign')
        if (HydratedCampaignSacrifice.isVictorious(campaign, sacrifice)) return []
        return HydratedCampaignSacrifice.defaultDefeatKills(state, sacrifice)
    }

    static reasonCannotResolve(
        state: HydratedOathGameState,
        playerId: string,
        choice: {
            sacrifice: number
            defeatKills?: WarbandGroup[]
            sacrificeKills?: readonly WarbandGroup[]
        }
    ): string | undefined {
        const campaign = state.campaign
        if (!campaign) return 'no Campaign is under way'
        if (campaign.pendingDefenderPlans) {
            return 'the defender has yet to use their battle plans (R-5.5.3); nothing is rolled'
        }
        if (campaign.pendingSkullLosses) {
            return 'the attacker has yet to pick where the skulls kill (R-5.5.5)'
        }
        if (campaign.attackerVictorious !== undefined) {
            return 'this Campaign is already resolved'
        }
        if (playerId !== campaign.attackerPlayerId) {
            return 'only the attacker resolves their own Campaign'
        }

        if (campaign.decidedVictor && choice.sacrifice > 0) {
            return 'the battle is already decided by a battle plan; nothing is sacrificed'
        }
        const sacrificeReason = HydratedCampaignSacrifice.reasonCannotSacrifice(
            state,
            campaign,
            choice.sacrifice
        )
        if (sacrificeReason) return sacrificeReason
        const sacrificeKillsReason = HydratedCampaignSacrifice.reasonSacrificeKillsInvalid(
            state,
            campaign,
            choice.sacrifice,
            choice.sacrificeKills
        )
        if (sacrificeKillsReason) return sacrificeKillsReason

        const kills = choice.defeatKills ?? []
        if (HydratedCampaignSacrifice.isVictorious(campaign, choice.sacrifice)) {
            return kills.length > 0
                ? 'the defending side chooses its own losses (R-5.5.6.a)'
                : undefined
        }
        const defeatedForce = HydratedCampaignSacrifice.attackerForce(
            state,
            campaign,
            choice.sacrifice
        )
        const required = HydratedCampaignSacrifice.requiredKills(state, campaign, defeatedForce)
        if (forceTotal(kills) !== required) {
            return `must kill exactly ${required} of the defeated force, not ${forceTotal(kills)}`
        }
        return selectionExceedsForce(kills, defeatedForce)
    }

    static canDoCampaignSacrifice(state: HydratedOathGameState, playerId: string): boolean {
        const campaign = state.campaign
        return (
            campaign !== undefined &&
            campaign.attackerVictorious === undefined &&
            campaign.attackerPlayerId === playerId
        )
    }

    /** R-5.5.5.c, R-9.5 */
    private static reasonCannotSacrifice(
        state: HydratedOathGameState,
        campaign: CampaignState,
        sacrifice: number
    ): string | undefined {
        if (sacrifice < 0) return 'must sacrifice at least 0 warbands'
        if (sacrifice === 0) return undefined
        // R-7.1.4 — Vow of Peace: attackers cannot sacrifice against its holder.
        const forbidden = reasonPersistentForbidsSacrifice(
            state,
            campaign.attackerPlayerId,
            campaign.defenderPlayerId
        )
        if (forbidden) return forbidden

        const available = forceTotal(HydratedCampaignSacrifice.attackerForce(state, campaign))
        if (sacrifice > available) {
            return `only ${available} warbands in your force to sacrifice`
        }

        const needed = HydratedCampaignSacrifice.sacrificeNeeded(campaign)
        if (needed === 0) {
            // R-9.5 — nothing prompted the loss, so nothing may be lost.
            return 'the attack is already victorious, so no sacrifice is prompted'
        }
        if (sacrifice !== needed) {
            return `must sacrifice exactly ${needed} to be victorious, not ${sacrifice}`
        }
        return undefined
    }

    static requiredKills(
        state: HydratedOathGameState,
        campaign: CampaignState,
        defeated: readonly WarbandGroup[]
    ): number {
        const total = forceTotal(defeated)
        const attackerLost = defeated !== campaign.defendingForce
        const loserSide = attackerLost ? BattlePlanSide.Attacker : BattlePlanSide.Defender
        const rules = playerIdsOnSide(campaign, loserSide)
            .flatMap((id) => plansUsedBy(state, campaign, id))
            .map((p) => p.hooks.defeatKills)
        // Peace Envoy — "ignore killing warbands", for either side.
        if (campaign.ignoreDefeatKills) return 0
        // R-9.2 — from revision 5, checked before Sticky Fire's kill.
        if (ignoresKillAll(state, campaign, loserSide)) return 0
        // Sticky Fire — the victor burns the whole enemy force.
        const winnerSide = attackerLost ? BattlePlanSide.Defender : BattlePlanSide.Attacker
        if (
            playerIdsOnSide(campaign, winnerSide)
                .flatMap((id) => plansUsedBy(state, campaign, id))
                .some((p) => p.hooks.killsEnemyForce)
        )
            return total
        // Billowing Fog, Traveling Doctor — "kill no warbands … ignore powers
        // that kill all of your force": none beats all, and beats Brutal.
        if (rules.includes('none')) return 0
        if (rules.includes('all')) return total
        // R-7.6.5 — bandits in a defeated defending force count toward its half and cannot be killed.
        const forceSize = attackerLost ? total : total + campaign.defendingBandits
        const owed = hasTrait(state, campaign.attackerPlayerId, BRUTAL)
            ? forceSize
            : Math.floor(forceSize / 2)
        return Math.min(total, owed)
    }

    static runOutcomeHooks(
        state: HydratedOathGameState,
        campaign: CampaignState,
        attackerVictorious: boolean,
        sides: (victorious: boolean) => boolean
    ): { notes: string[]; pileDeposits: PileDeposit[] } {
        const notes: string[] = []
        const pileDeposits: PileDeposit[] = []
        for (const playerId of Object.keys(campaign.plansUsedBy)) {
            if (playerId === BANDITS_PLAN_USER) {
                notes.push(
                    ...HydratedCampaignSacrifice.banditOutcomes(
                        state,
                        campaign,
                        !attackerVictorious,
                        sides
                    )
                )
                continue
            }
            const victorious =
                sideOf(campaign, playerId) === BattlePlanSide.Attacker
                    ? attackerVictorious
                    : !attackerVictorious
            if (!sides(victorious)) continue
            for (const plan of plansUsedBy(state, campaign, playerId)) {
                const outcome = plan.hooks.onOutcome?.(
                    usedPlanContext(state, campaign, playerId, plan),
                    victorious
                )
                if (!outcome) continue
                if (typeof outcome === 'string') {
                    notes.push(outcome)
                    continue
                }
                notes.push(outcome.note)
                pileDeposits.push(...(outcome.pileDeposits ?? []))
            }
        }
        return { notes, pileDeposits }
    }

    /** R-5.5.3-H1, R-5.5.6, R-10.3-H1 — the bandits' compelled plans whose outcome is ruled for them. */
    private static banditOutcomes(
        state: HydratedOathGameState,
        campaign: CampaignState,
        victorious: boolean,
        sides: (victorious: boolean) => boolean
    ): string[] {
        if (!isAtLeastOathRevision(state, OathRevision.CardFixes1)) return []
        if (!sides(victorious)) return []
        const notes: string[] = []
        for (const plan of plansUsedBy(state, campaign, BANDITS_PLAN_USER)) {
            const note = plan.hooks.onBanditOutcome?.(
                banditPlanContext(state, campaign, plan),
                victorious
            )
            if (note) notes.push(note)
        }
        return notes
    }

    // R-5.5.5-H1 — the attacker names the sacrificed warbands whenever the force holds more than one kind.
    private static reasonSacrificeKillsInvalid(
        state: HydratedOathGameState,
        campaign: CampaignState,
        sacrifice: number,
        kills: readonly WarbandGroup[] | undefined
    ): string | undefined {
        const force = HydratedCampaignSacrifice.attackerForce(state, campaign)
        if (!kills) {
            return sacrifice > 0 && force.length > 1
                ? 'choose which warbands of your force are sacrificed'
                : undefined
        }
        if (forceTotal(kills) !== sacrifice) {
            return `must sacrifice exactly ${sacrifice}, not ${forceTotal(kills)}`
        }
        return selectionExceedsForce(kills, force)
    }

    /** R-5.5.5, R-5.5.6 — the attacker's force as it stands, less any warbands already sacrificed. */
    static attackerForce(
        state: HydratedOathGameState,
        campaign: CampaignState,
        alreadySacrificed = 0
    ): WarbandGroup[] {
        let toRemove = alreadySacrificed
        return collectAttackingForce(state, campaign).flatMap((group) => {
            if (group.at.kind !== 'board') return [group]
            const taken = Math.min(group.count, toRemove)
            toRemove -= taken
            return group.count > taken ? [{ ...group, count: group.count - taken }] : []
        })
    }

    private static subtractSelection(
        force: readonly WarbandGroup[],
        selection: readonly WarbandGroup[]
    ): WarbandGroup[] {
        const remaining = force.map((group) => ({ ...group }))
        for (const taken of selection) {
            let toRemove = taken.count
            for (const group of remaining) {
                if (toRemove === 0) break
                if (
                    group.owner !== taken.owner ||
                    !HydratedCampaignSacrifice.sameLocation(group.at, taken.at)
                )
                    continue
                const removed = Math.min(group.count, toRemove)
                group.count -= removed
                toRemove -= removed
            }
        }
        return remaining.filter((group) => group.count > 0)
    }

    private static sameLocation(a: WarbandGroup['at'], b: WarbandGroup['at']): boolean {
        if (a.kind === 'site' && b.kind === 'site') return a.siteId === b.siteId
        if (a.kind === 'board' && b.kind === 'board') return a.playerId === b.playerId
        return false
    }
}
