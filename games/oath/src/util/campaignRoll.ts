import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { HeldAttackRoll } from '../actions/answerQuestion.js'
import type { PileDeposit } from '../model/hidden.js'
import {
    type CampaignKillPath,
    type CampaignState,
    type HeldForHospital,
    type KillRedirect,
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
import {
    battleScopeOf,
    collectDefendingBandits,
    collectDefendingForce,
    forceSiteOwners,
    type CampaignParties
} from './campaign.js'
import { attackingSiteOf } from './campaignSite.js'
import {
    addWarbandsToSite,
    boardGroupToKill,
    forceTotal,
    killWarbands,
    removeWarbandsFrom,
    boardOwnersOwnFirst,
    selectionExceedsForce
} from './force.js'
import { rulesSite, warbandsAt } from './rule.js'
import { isInPlay } from './discard.js'
import { discardFromPlayInChosenOrder } from './orderedDiscard.js'
import { BANDITS_PLAN_USER, plansUsedBy, sideOf, type ActiveBattlePlan } from './battlePlans.js'
import type { BattlePlanContext, PlayerPlanContext } from '../powers/registry.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { countOf } from './warbands.js'
import type { WarbandCounts, WarbandOwner } from '../model/warbandCounts.js'
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
        forceSiteIds: campaign.forceSiteIds,
        asIfSiteId: campaign.asIfSiteId
    }
}

/**
 * R-X.3, R-5.5.5.b-H1 — whether the Campaign step just taken reveals information: the dice it
 * rolled, or the roll a later step will make. A Campaign a plan decided ("you're victorious now")
 * rolls no dice, so once no defending plans are left to wait on, the step that settled it reveals
 * nothing and stays undoable. Before revision 17 every such step revealed (R-X.4).
 */
export function campaignStepRevealsInfo(state: HydratedOathGameState): boolean {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes13)) return true
    const campaign = state.campaign
    return campaign?.decidedVictor === undefined || campaign.pendingDefenderPlans !== undefined
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
    applyDefenseRoll(campaign, rollDefenseDice(state.getProtectedPrng(), campaign.defensePool))
    // Mounted Patrol — the pool as it will be rolled, so an attack held for a reroll counts its dice.
    if (rules.halveAttackPool) {
        campaign.attackPool = Math.floor(campaign.attackPool / 2)
    }
    // Before revision 14 both rolls are made, then both sides are asked.
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes10)) {
        return rollAttack(state, campaign, skullLossOrder, ['attack', 'defense'])
    }
    // R-5.5.4-H1 — Step 4's reroll is settled before Step 5's roll.
    if (askRerolls(state, campaign, ['defense'])) {
        campaign.pendingAttackRoll = { order: [...(skullLossOrder ?? [])] }
        return []
    }
    return rollAttack(state, campaign, skullLossOrder, ['attack'])
}

/** R-5.5.4-H1 — the attack held for the defender's reroll is rolled; what it rolled, when it was held. */
export function rollHeldAttack(state: HydratedOathGameState): HeldAttackRoll | undefined {
    const campaign = state.campaign
    if (!campaign?.pendingAttackRoll) return undefined
    const { order } = campaign.pendingAttackRoll
    campaign.pendingAttackRoll = undefined
    const killed = rollAttack(state, campaign, order, ['attack'])
    return {
        attackerPlayerId: campaign.attackerPlayerId,
        swords: campaign.swords,
        defense: campaign.defense,
        skullsKilled: forceTotal(killed)
    }
}

/** R-5.5.5 — the attack roll, then the rerolls asked after it; the skulls kill once those are settled. */
function rollAttack(
    state: HydratedOathGameState,
    campaign: CampaignState,
    skullLossOrder: readonly LossSource[] | undefined,
    rerolledSides: ReadonlyArray<'attack' | 'defense'>
): WarbandGroup[] {
    // R-5.5.5 — the skulls kill before the sacrifice, which is a separate action.
    const prng = state.getProtectedPrng()
    const skulls = applyAttackRoll(campaign, rollAttackDice(prng, campaign.attackPool))
    // Jinx — the skulls' kills wait on the answer, since a reroll replaces the roll.
    if (askRerolls(state, campaign, rerolledSides)) {
        campaign.pendingSkullKills = { skulls, order: [...(skullLossOrder ?? [])] }
        return []
    }
    return killOrHoldForSkulls(state, campaign, skulls, skullLossOrder)
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

/** Jinx — "after you roll": the attacker rolls the attack, the defender the defense (R-5.5.4). */
function askRerolls(
    state: HydratedOathGameState,
    campaign: CampaignState,
    sides: ReadonlyArray<'attack' | 'defense'>
): boolean {
    let asked = false
    for (const side of sides) {
        const playerId = side === 'attack' ? campaign.attackerPlayerId : campaign.defenderPlayerId
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
    killOrHoldForSkulls(state, campaign, skulls, order)
}

/** R-5.5.5 — Outriders ignores them; from revision 7 the attacker picks where they kill when that is a choice. */
function killOrHoldForSkulls(
    state: HydratedOathGameState,
    campaign: CampaignState,
    skulls: number,
    skullLossOrder?: readonly LossSource[]
): WarbandGroup[] {
    if (campaign.ignoreSkulls) return []
    if (skullLossesToPick(state, campaign, skulls)) {
        campaign.pendingSkullLosses = { skulls }
        return []
    }
    return killForSkulls(state, campaign, skulls, skullLossOrder)
}

/**
 * R-5.5.5 — "For each skull attacker immediately kills one warband in their force". From revision 7 the
 * attacker picks where, after the roll, when the force stands in more than one place (Captains, Wild Allies,
 * Vow of Union) and the skulls leave some of it alive; otherwise there is nothing to pick.
 */
export function skullLossesToPick(
    state: HydratedOathGameState,
    campaign: CampaignState,
    skulls: number
): boolean {
    if (skulls <= 0 || !isAtLeastOathRevision(state, OathRevision.EngineFixes3)) return false
    const groups = skullLossGroups(state, campaign)
    const places = new Set(groups.map(({ at }) => placeKey(at)))
    return places.size > 1 && skulls < forceTotal(groups)
}

function placeKey(at: WarbandLocation): string {
    return at.kind === 'board' ? `board:${at.playerId}` : `site:${at.siteId}`
}

function warbandsHeldAt(state: HydratedOathGameState, at: WarbandLocation): WarbandCounts {
    return at.kind === 'board'
        ? state.getPlayerState(at.playerId).warbandsOnBoard
        : warbandsAt(state, at.siteId)
}

/** R-5.5.5, R-10.22 — what the skulls can kill: each place and owner in the attacking force, with its count. */
export function skullLossGroups(
    state: HydratedOathGameState,
    campaign: CampaignState
): WarbandGroup[] {
    return attackingForceSources(state, partiesOf(state, campaign), campaign.forceSiteIds).map(
        ({ at, owner }) => ({ at, owner, count: countOf(warbandsHeldAt(state, at), owner) })
    )
}

/** R-5.5.5 — the attacker's pick: exactly the skulls, all from the attacking force. */
export function reasonSkullLossesInvalid(
    state: HydratedOathGameState,
    playerId: string,
    kills: readonly WarbandGroup[]
): string | undefined {
    const campaign = state.campaign
    const pending = campaign?.pendingSkullLosses
    if (!campaign || !pending) return 'no skulls are waiting for their losses'
    if (playerId !== campaign.attackerPlayerId) {
        return 'only the attacker picks where their skulls kill (R-5.5.5)'
    }
    const total = forceTotal(kills)
    if (total !== pending.skulls) return `must kill exactly ${pending.skulls}, not ${total}`
    return selectionExceedsForce(kills, skullLossGroups(state, campaign))
}

/** R-5.5.5 — the pick, one group per place and owner in the force's order; Hospital may still save them. */
export function killPickedSkullLosses(
    state: HydratedOathGameState,
    campaign: CampaignState,
    kills: readonly WarbandGroup[]
): WarbandGroup[] {
    const picked = skullLossGroups(state, campaign).flatMap(({ at, owner }): WarbandGroup[] => {
        const count = forceTotal(kills.filter((kill) => sameLossSource(kill, { at, owner })))
        return count > 0 ? [{ at, owner, count }] : []
    })
    campaign.pendingSkullLosses = undefined
    for (const { at, owner, count } of picked) {
        killOrRedirect(state, campaign, BattlePlanSide.Attacker, at, owner, count)
    }
    return picked
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
    parties: CampaignParties,
    forceSiteIds: readonly string[]
): LossSource[] {
    const attackerId = parties.attackerPlayerId
    const board = state.getPlayerState(attackerId).warbandsOnBoard
    return [
        ...boardOwnersOwnFirst(state, attackerId)
            .filter((owner) => countOf(board, owner) > 0)
            .map((owner): LossSource => ({ at: { kind: 'board', playerId: attackerId }, owner })),
        ...forceSiteIds.flatMap((siteId) =>
            forceSiteOwners(state, parties, siteId)
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
    parties: CampaignParties,
    forceSiteIds: readonly string[],
    declaredOrder: readonly LossSource[] = []
): string | undefined {
    const sources = attackingForceSources(state, parties, forceSiteIds)
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
    const sources = attackingForceSources(state, partiesOf(state, campaign), campaign.forceSiteIds)
    const order = [
        ...declaredOrder.filter((source) => sources.some((held) => sameLossSource(held, source))),
        ...sources.filter((held) => !declaredOrder.some((source) => sameLossSource(held, source)))
    ]
    const killed: WarbandGroup[] = []
    let remaining = count
    for (const { at, owner } of order) {
        if (remaining === 0) break
        const dying = Math.min(countOf(warbandsHeldAt(state, at), owner), remaining)
        if (dying > 0) {
            killOrRedirect(state, campaign, BattlePlanSide.Attacker, at, owner, dying)
            killed.push({ at, owner, count: dying })
            remaining -= dying
        }
    }
    return killed
}

/**
 * R-10.28-H2 — whose warbands they are, for Hospital: a board's player, and at a site the player whose
 * force holds it (the attacker's force sites, the defender's targets), whatever their colour. Before
 * revision 13 (R-X.4) a site's warbands were their bank's holder's, the Chancellor for the Empire's.
 */
function forceHolderOf(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    at: WarbandLocation,
    owner: WarbandOwner
): string | undefined {
    if (at.kind === 'board') return at.playerId
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes9)) {
        return state.warbandBankHolderOf(owner)
    }
    return side === BattlePlanSide.Attacker ? kills.attackerPlayerId : kills.defenderPlayerId
}

/** R-10.28 — the Hospital in force, if any, that holds `side`'s warbands killed from `at`. */
function hospitalRedirectOf(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    at: WarbandLocation,
    owner: WarbandOwner
): KillRedirect | undefined {
    const playerId = forceHolderOf(state, kills, side, at, owner)
    return kills.killRedirects.find((r) => r.playerId === playerId)
}

/**
 * R-5.5.6, R-10.28-H2 — whose Hospital, if anyone's, would hold `side`'s warbands killed from `group`:
 * from revision 13 two groups of one force can differ here, which makes a loss pick matter.
 */
export function hospitalHolderOf(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    group: LossSource
): string | undefined {
    return hospitalRedirectOf(state, kills, side, group.at, group.owner)?.playerId
}

/**
 * R-10.13, unless Hospital places them on its site; `side` is the force the warbands belong to. True
 * when Hospital holds them.
 */
export function killOrRedirect(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    at: WarbandLocation,
    owner: WarbandOwner,
    count: number
): boolean {
    if (count <= 0) return false
    const redirect = hospitalRedirectOf(state, kills, side, at, owner)
    if (redirect) {
        // Hospital's Q&A — set aside now, placed when the Campaign ends if its ruler still rules it.
        removeWarbandsFrom(state, at, owner, count)
        kills.heldForHospital = [
            ...(kills.heldForHospital ?? []),
            { playerId: redirect.playerId, siteId: redirect.siteId, owner, count }
        ]
        return true
    }
    removeWarbandsFrom(state, at, owner, count)
    killWarbands(state, owner, count)
    countKilled(state, kills, side, count)
    return false
}

/**
 * Hospital, R-10.13 — up to `count` of `playerId`'s warbands on their board, their own first, killed
 * through the Campaign's kill path so a redirect in force sees them (revision 13).
 */
export function killBoardWarbandsInCampaign(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    playerId: string,
    count: number
): { killed: number; held: boolean } {
    const group = boardGroupToKill(state, playerId, count)
    if (!group) return { killed: 0, held: false }
    const held = killOrRedirect(state, kills, side, group.at, group.owner, group.count)
    return { killed: group.count, held }
}

/** Cursed Cauldron, R-10.22 — warbands of `side`'s force killed are enemy warbands killed for the other side. */
export function countKilled(
    state: HydratedOathGameState,
    kills: CampaignKillPath,
    side: BattlePlanSide,
    count: number
): void {
    if (count <= 0 || !isAtLeastOathRevision(state, OathRevision.CardFixes1)) return
    const tally = kills.enemyWarbandsKilled ?? { attacker: 0, defender: 0 }
    kills.enemyWarbandsKilled =
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
    const keeps = hospitalKeeps(state, campaign)
    const heldToDie = (campaign.heldForHospital ?? [])
        .filter((held) => sideOf(campaign, held.playerId) !== side)
        .filter((held) => !keeps(held))
        .reduce((total, held) => total + held.count, 0)
    return killed + heldToDie
}

/** Hospital — "if you still rule it", judged in the Campaign's scope (R-5.5.1.a), for the tally and the end alike. */
function hospitalKeeps(
    state: HydratedOathGameState,
    campaign: CampaignState
): (held: HeldForHospital) => boolean {
    const scope = battleScopeOf(state, partiesOf(state, campaign))
    return (held) => rulesSite(state, held.playerId, held.siteId, scope)
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
    const keeps = hospitalKeeps(state, campaign)
    for (const held of campaign.heldForHospital ?? []) {
        if (keeps(held)) {
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
