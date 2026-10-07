import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { PileDeposit } from '../model/hidden.js'
import {
    type CampaignState,
    type LossSource,
    type RolledAttackFace,
    type RolledDefenseFace,
    type WarbandGroup,
    type WarbandLocation
} from '../model/campaign.js'
import {
    attackFromFaces,
    defenseShieldsFromFaces,
    rollAttackDice,
    rollDefenseDice
} from '../data/dice.js'
import { askQuestion } from './questions.js'
import { PowerQuestionKind, RerolledRollKind } from '../model/question.js'
import { offerReroll } from './reroll.js'
import { collectDefendingBandits, collectDefendingForce, type CampaignParties } from './campaign.js'
import { attackingSiteOf } from './campaignSite.js'
import {
    addWarbandsToSite,
    forceTotal,
    killWarbands,
    removeWarbandsFrom,
    boardOwnersOwnFirst
} from './force.js'
import { rulesSite, rulingWarbandOwners, warbandsAt } from './rule.js'
import { isInPlay } from './discard.js'
import { discardFromPlayInChosenOrder } from './orderedDiscard.js'
import { BANDITS_PLAN_USER, plansUsedBy, sideOf, type ActiveBattlePlan } from './battlePlans.js'
import type { BattlePlanContext, PlayerPlanContext } from '../powers/registry.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { countOf } from './warbands.js'
import type { WarbandOwner } from '../model/warbandCounts.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

/** R-5.5.4, R-5.5.5 — rolled from the protected stream inside an action's `apply`. */

export function partiesOf(state: HydratedOathGameState, campaign: CampaignState): CampaignParties {
    return {
        attackerPlayerId: campaign.attackerPlayerId,
        defenderPlayerId: campaign.defenderPlayerId,
        allyPlayerIds: campaign.allyPlayerIds,
        nonImperialPlayerIds: campaign.nonImperialPlayerIds,
        targets: campaign.targets,
        attackerSiteId: attackingSiteOf(state, campaign.attackerPlayerId),
        forceSiteIds: campaign.forceSiteIds
    }
}

export function rollCampaign(
    state: HydratedOathGameState,
    campaign: CampaignState,
    skullLossOrder?: readonly LossSource[]
): WarbandGroup[] {
    const parties = partiesOf(state, campaign)

    // R-5.5.4 — the doubling faces multiply the shields only, never the warbands.
    const rules = campaign.rollRules
    const defendingForce = collectDefendingForce(state, parties)
    const defendingBandits = collectDefendingBandits(state, parties)
    campaign.defendingForce = defendingForce
    campaign.defendingBandits = defendingBandits
    // Zealots — judged when it was used.
    if (rules.zealots) campaign.sacrificeWorth = 3
    // Hearts and Minds, Peace Envoy — "you're victorious now": no dice, no skulls.
    if (campaign.decidedVictor) {
        campaign.defenseRoll = []
        campaign.attackRoll = []
        campaign.defense = 0
        campaign.swords = 0
        return []
    }
    const prng = state.getProtectedPrng()
    applyDefenseRoll(campaign, rollDefenseDice(prng, campaign.defensePool))

    // R-5.5.5 — the skulls kill before the sacrifice, which is a separate action.
    // Mounted Patrol
    if (rules.halveAttackPool) campaign.attackPool = Math.floor(campaign.attackPool / 2)
    const skulls = applyAttackRoll(campaign, rollAttackDice(prng, campaign.attackPool))
    // Jinx — the skulls' kills wait on the answer, since a reroll replaces the roll.
    const jinxed = askRerolls(state, campaign)
    if (jinxed) {
        campaign.pendingSkullKills = { skulls, order: [...(skullLossOrder ?? [])] }
        return []
    }
    return campaign.ignoreSkulls ? [] : killForSkulls(state, campaign, skulls, skullLossOrder)
}

/** R-5.5.4 */
export function applyDefenseRoll(campaign: CampaignState, defenseRoll: RolledDefenseFace[]): void {
    const rules = campaign.rollRules
    campaign.defenseRoll = defenseRoll
    // Rain Boots, War Tortoise — an ignored face stays on record as rolled.
    const countedDefense = defenseRoll.map((face) =>
        (rules.ignoreSingleShields && face.shields === 1 && !face.doubling) ||
        (rules.ignoreTwoShieldFaces && face.shields === 2)
            ? { shields: 0, doubling: false }
            : face
    )
    campaign.defense =
        defenseShieldsFromFaces(countedDefense) +
        forceTotal(campaign.defendingForce) +
        campaign.defendingBandits
}

/** R-5.5.5 — the roll as it counts: Rusting Ray, War Tortoise, Lancers. */
function countedAttack(
    campaign: CampaignState,
    attackRoll: readonly RolledAttackFace[]
): { swords: number; skulls: number } {
    const rules = campaign.rollRules
    // Lancers' Q&A — "double your total attack roll" doubles every result, skulls and hollow swords too, before flooring.
    const times = rules.doubleAttackRoll ? 2 : 1
    // Rusting Ray, War Tortoise — an ignored face's skulls always still kill.
    return attackFromFaces(
        attackRoll.map((face) => ({
            swords: (rules.ignoreTwoSwordFaces && face.skulls > 0 ? 0 : face.swords) * times,
            hollowSwords: (rules.ignoreHollowSwords ? 0 : face.hollowSwords) * times,
            skulls: face.skulls * times
        }))
    )
}

/** R-5.5.5 — returns the skulls. */
export function applyAttackRoll(campaign: CampaignState, attackRoll: RolledAttackFace[]): number {
    const { swords, skulls } = countedAttack(campaign, attackRoll)
    campaign.attackRoll = attackRoll
    campaign.swords = swords
    return skulls
}

/** Jinx */
function askRerolls(state: HydratedOathGameState, campaign: CampaignState): boolean {
    const rollers: Array<{ playerId: string | undefined; side: 'attack' | 'defense' }> = [
        { playerId: campaign.attackerPlayerId, side: 'attack' },
        { playerId: campaign.defenderPlayerId, side: 'defense' }
    ]
    let asked = false
    for (const { playerId, side } of rollers) {
        if (!playerId) continue
        const roll = { kind: RerolledRollKind.Campaign as const, side }
        if (offerReroll(state, campaign.attackerPlayerId, playerId, roll)) asked = true
    }
    return asked
}

/** Jinx */
export function settleSkullKills(state: HydratedOathGameState): void {
    const campaign = state.campaign
    if (!campaign?.pendingSkullKills) return
    const { order } = campaign.pendingSkullKills
    const { skulls } = countedAttack(campaign, campaign.attackRoll)
    campaign.pendingSkullKills = undefined
    if (!campaign.ignoreSkulls) killForSkulls(state, campaign, skulls, order)
}

/** R-5.5.5 */
function killForSkulls(
    state: HydratedOathGameState,
    campaign: CampaignState,
    skulls: number,
    skullLossOrder: readonly LossSource[] = []
): WarbandGroup[] {
    if (skulls <= 0) return []
    return killFromAttackingForce(state, campaign, skulls, skullLossOrder)
}

/** R-5.5.5, R-10.22 — the board, then the sites the force reaches: every place and owner it holds. */
export function attackingForceSources(
    state: HydratedOathGameState,
    attackerId: string,
    forceSiteIds: readonly string[]
): LossSource[] {
    const board = state.getPlayerState(attackerId).warbandsOnBoard
    const siteOwners = rulingWarbandOwners(state, attackerId)
    return [
        ...boardOwnersOwnFirst(state, attackerId)
            .filter((owner) => countOf(board, owner) > 0)
            .map((owner): LossSource => ({ at: { kind: 'board', playerId: attackerId }, owner })),
        ...forceSiteIds.flatMap((siteId) =>
            siteOwners
                .filter((owner) => countOf(warbandsAt(state, siteId), owner) > 0)
                .map((owner): LossSource => ({ at: { kind: 'site', siteId }, owner }))
        )
    ]
}

export function sameLossSource(a: LossSource, b: LossSource): boolean {
    return (
        a.owner === b.owner &&
        (a.at.kind === 'board'
            ? b.at.kind === 'board' && a.at.playerId === b.at.playerId
            : b.at.kind === 'site' && a.at.siteId === b.at.siteId)
    )
}

/** R-5.5.5-H1, R-10.22 — a declared loss order names only places and owners in the attacking force. */
export function reasonLossOrderOutsideForce(
    state: HydratedOathGameState,
    attackerId: string,
    forceSiteIds: readonly string[],
    declaredOrder: readonly LossSource[] = []
): string | undefined {
    const sources = attackingForceSources(state, attackerId, forceSiteIds)
    const stray = declaredOrder.find(
        (source) => !sources.some((held) => sameLossSource(held, source))
    )
    return stray === undefined ? undefined : `${stray.owner}'s warbands there are not in your force`
}

/** R-5.5.5, R-10.22 — the sources named first, in order, then the rest of the force by default. */
export function killFromAttackingForce(
    state: HydratedOathGameState,
    campaign: CampaignState,
    count: number,
    declaredOrder: readonly LossSource[] = []
): WarbandGroup[] {
    const sources = attackingForceSources(state, campaign.attackerPlayerId, campaign.forceSiteIds)
    const order = [
        ...declaredOrder.filter((source) => sources.some((held) => sameLossSource(held, source))),
        ...sources.filter((held) => !declaredOrder.some((source) => sameLossSource(held, source)))
    ]
    const killed: WarbandGroup[] = []
    let remaining = count
    for (const { at, owner } of order) {
        if (remaining === 0) break
        const here =
            at.kind === 'board'
                ? state.getPlayerState(at.playerId).warbandsOnBoard
                : warbandsAt(state, at.siteId)
        const dying = Math.min(countOf(here, owner), remaining)
        if (dying > 0) {
            killOrRedirect(state, campaign, BattlePlanSide.Attacker, at, owner, dying)
            killed.push({ at, owner, count: dying })
            remaining -= dying
        }
    }
    return killed
}

/** R-10.13, unless Hospital places them on its site; `side` is the force the warbands belong to. */
export function killOrRedirect(
    state: HydratedOathGameState,
    campaign: CampaignState,
    side: BattlePlanSide,
    at: WarbandLocation,
    owner: WarbandOwner,
    count: number
): void {
    if (count <= 0) return
    const playerId = at.kind === 'board' ? at.playerId : state.warbandBankHolderOf(owner)
    const redirect = campaign.killRedirects.find((r) => r.playerId === playerId)
    if (redirect) {
        // Hospital's Q&A — set aside now, placed when the Campaign ends if its ruler still rules it.
        removeWarbandsFrom(state, at, owner, count)
        campaign.heldForHospital = [
            ...(campaign.heldForHospital ?? []),
            { playerId, siteId: redirect.siteId, owner, count }
        ]
        return
    }
    removeWarbandsFrom(state, at, owner, count)
    killWarbands(state, owner, count)
    countKilled(state, campaign, side, count)
}

/** Cursed Cauldron, R-10.22 — warbands of `side`'s force killed are enemy warbands killed for the other side. */
export function countKilled(
    state: HydratedOathGameState,
    campaign: CampaignState,
    side: BattlePlanSide,
    count: number
): void {
    if (count <= 0 || !isAtLeastOathRevision(state, OathRevision.CardFixes1)) return
    const tally = campaign.enemyWarbandsKilled ?? { attacker: 0, defender: 0 }
    campaign.enemyWarbandsKilled =
        side === BattlePlanSide.Attacker
            ? { ...tally, defender: tally.defender + count }
            : { ...tally, attacker: tally.attacker + count }
}

/**
 * Cursed Cauldron — "enemy warbands killed in this campaign", for the side `side`.
 * Site rule is settled once a victory resolves, so the enemy's warbands Hospital holds for a site its user has lost
 * count too: `endCampaign` kills them.
 */
export function enemyWarbandsKilledFor(
    state: HydratedOathGameState,
    campaign: CampaignState,
    side: BattlePlanSide
): number {
    const tally = campaign.enemyWarbandsKilled
    const killed = !tally ? 0 : side === BattlePlanSide.Attacker ? tally.attacker : tally.defender
    const heldToDie = (campaign.heldForHospital ?? [])
        .filter((held) => sideOf(campaign, held.playerId) !== side)
        .filter((held) => !rulesSite(state, held.playerId, held.siteId))
        .reduce((total, held) => total + held.count, 0)
    return killed + heldToDie
}

/** R-5.5.3-H1 — the bandits' compelled plans have no user, and the bandits always defend. */
export function banditPlanContext(
    state: HydratedOathGameState,
    campaign: CampaignState,
    plan: ActiveBattlePlan
): BattlePlanContext {
    return {
        state,
        playerId: undefined,
        power: plan.power,
        choices: [],
        campaign: {
            parties: partiesOf(state, campaign),
            side: BattlePlanSide.Defender,
            pools: { attackPool: campaign.attackPool, defensePool: campaign.defensePool }
        }
    }
}

export function usedPlanContext(
    state: HydratedOathGameState,
    campaign: CampaignState,
    playerId: string,
    plan: ActiveBattlePlan
): PlayerPlanContext {
    return {
        state,
        playerId,
        power: plan.power,
        choices: [],
        campaign: {
            parties: partiesOf(state, campaign),
            side: sideOf(campaign, playerId),
            pools: { attackPool: campaign.attackPool, defensePool: campaign.defensePool }
        }
    }
}

/** Wild Mounts */
function askToSpareEndDiscards(state: HydratedOathGameState, campaign: CampaignState): string[] {
    const spared: string[] = []
    for (const [playerId, used] of Object.entries(campaign.plansUsedBy)) {
        if (playerId === BANDITS_PLAN_USER) continue
        const mine = campaign.discardAtEnd.filter(
            (cardId) => used.includes(cardId) && isInPlay(state, cardId)
        )
        for (const plan of plansUsedBy(state, campaign, playerId)) {
            const offer = plan.hooks.sparesEndDiscards?.(
                usedPlanContext(state, campaign, playerId, plan),
                mine.filter((cardId) => !spared.includes(cardId))
            )
            if (!offer) continue
            const refused = askQuestion(state, campaign.attackerPlayerId, {
                kind: PowerQuestionKind.DiscardInstead,
                cardId: plan.power.cardId,
                askedPlayerId: playerId,
                planCardIds: offer.planCardIds,
                insteadCardIds: offer.insteadCardIds,
                actingPlayerId: campaign.attackerPlayerId
            })
            if (!refused) spared.push(...offer.planCardIds)
        }
    }
    return spared
}

/** Wild Mounts, by its Q&A — the bandits' swap is fixed, so nobody is asked (revision 4). */
function banditsSpareEndDiscards(
    state: HydratedOathGameState,
    campaign: CampaignState
): { spared: string[]; instead: string[] } {
    const spared: string[] = []
    const instead: string[] = []
    const used = campaign.plansUsedBy[BANDITS_PLAN_USER]
    if (!used || !isAtLeastOathRevision(state, OathRevision.CardFixes1)) return { spared, instead }
    const owed = campaign.discardAtEnd.filter(
        (cardId) => used.includes(cardId) && isInPlay(state, cardId)
    )
    for (const plan of plansUsedBy(state, campaign, BANDITS_PLAN_USER)) {
        const swap = plan.hooks.banditSparesEndDiscards?.(
            banditPlanContext(state, campaign, plan),
            owed.filter((cardId) => !spared.includes(cardId))
        )
        if (!swap) continue
        spared.push(...swap.planCardIds)
        instead.push(swap.insteadCardId)
    }
    return { spared, instead }
}

/** R-5.5.8, R-9.4 — each plan is discarded from its own region. */
export function endCampaign(state: HydratedOathGameState): PileDeposit[] {
    const campaign = state.campaign
    assertExists(campaign, 'only a Campaign in progress can end')
    // Hospital — "if you still rule it"; otherwise the warbands are killed after all (R-10.13).
    for (const held of campaign.heldForHospital ?? []) {
        if (rulesSite(state, held.playerId, held.siteId)) {
            addWarbandsToSite(state, held.siteId, held.owner, held.count)
        } else {
            killWarbands(state, held.owner, held.count)
        }
    }
    campaign.heldForHospital = undefined
    const spared = askToSpareEndDiscards(state, campaign)
    const bandits = banditsSpareEndDiscards(state, campaign)
    const going = [
        ...campaign.discardAtEnd.filter(
            (cardId) => !spared.includes(cardId) && !bandits.spared.includes(cardId)
        ),
        ...bandits.instead
    ]
    // Law Glossary "Discard" — the attacker orders the cards leaving for one pile.
    const deposits = discardFromPlayInChosenOrder(state, campaign.attackerPlayerId, going)
    state.campaign = undefined
    return deposits
}
