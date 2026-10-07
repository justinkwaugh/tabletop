import { bannerHolder } from './oathkeeper.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { attackingSiteOf, forceSitesOf, targetedSiteIds } from './campaignSite.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { reasonSitesForbidTargets, targetsNeedFlip } from './siteTravel.js'
import { relicDefenseDice } from '../data/cardRegistry.js'
import {
    campaignTargetKey,
    CampaignTargetKind,
    type CampaignTarget,
    type WarbandGroup
} from '../model/campaign.js'
import { banditsPerSite } from './bandits.js'
import {
    persistentPawnDefenseBonus,
    persistentRelicDefenseBonus,
    reasonPersistentForbidsBannerTake,
    reasonPersistentForbidsCampaign,
    reasonPersistentForbidsRelicTake,
    reasonPersistentForbidsTargets
} from './persistent.js'
import {
    banditsRuleSite,
    banditsServe,
    isImperialPlayer,
    rulersOfSite,
    rulesSite,
    rulingWarbandOwners,
    type ImperialScope
} from './rule.js'
import { boardOwnersOwnFirst, boardWarbandGroups, warbandGroupsAtSites } from './force.js'
import { countOf } from './warbands.js'
import { pawnSiteId } from './pawn.js'
import { siteLockedFor } from './locked.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

/** R-5.5.1, R-5.5.2 */
export interface CampaignParties {
    attackerPlayerId: string
    /** Absent when attacking the bandits (R-5.5.1, R-10.3). */
    defenderPlayerId?: string
    /** R-5.5.2.a */
    allyPlayerIds: readonly string[]
    /** R-5.5.1.a */
    nonImperialPlayerIds: readonly string[]
    targets: readonly CampaignTarget[]
    /** R-5.5.1's "your site": the pawn's, or the one Wild Allies or Captains names. */
    attackerSiteId: string
    /** Wild Allies, Captains, Vow of Union — sites whose warbands of the attacker's join their force. */
    forceSiteIds: readonly string[]
}

export function scopeOf(parties: CampaignParties): ImperialScope {
    return { nonImperialPlayerIds: parties.nonImperialPlayerIds }
}

/** R-5.5.1.a */
export function suspendedImperialsFor(
    state: HydratedOathGameState,
    attackerId: string,
    defenderId?: string
): string[] {
    if (!defenderId) return []
    const attacker = state.getPlayerState(attackerId)
    const defender = state.getPlayerState(defenderId)

    if (
        attacker.status === PlayerStatus.Citizen &&
        (defender.status === PlayerStatus.Chancellor || defender.status === PlayerStatus.Citizen)
    ) {
        return [attackerId]
    }
    if (attacker.status === PlayerStatus.Chancellor && defender.status === PlayerStatus.Citizen) {
        return [defenderId]
    }
    return []
}

/** R-5.5.1.a, R-5.5.2.a — the sides as declared, before any Citizen joins. */
export function declaredParties(
    state: HydratedOathGameState,
    attackerPlayerId: string,
    defenderPlayerId: string | undefined,
    targets: readonly CampaignTarget[]
): CampaignParties {
    const base: CampaignParties = {
        attackerPlayerId,
        defenderPlayerId,
        allyPlayerIds: [],
        nonImperialPlayerIds: suspendedImperialsFor(state, attackerPlayerId, defenderPlayerId),
        targets,
        attackerSiteId: attackingSiteOf(state, attackerPlayerId),
        forceSiteIds: forceSitesOf(state, attackerPlayerId)
    }
    return { ...base, allyPlayerIds: compulsoryAllies(state, base) }
}

/** R-5.5.2.a — "the Chancellor joins as an Ally" when an Imperial player defends. */
function compulsoryAllies(state: HydratedOathGameState, parties: CampaignParties): string[] {
    const defenderId = parties.defenderPlayerId
    if (!defenderId || !isImperialPlayer(state, defenderId, scopeOf(parties))) return []
    const chancellorId = state.chancellorId()
    return chancellorId !== defenderId && chancellorId !== parties.attackerPlayerId
        ? [chancellorId]
        : []
}

/** R-5.5.1, R-5.5.2 — a defender with no declarable targets is no defender. */
export function reasonNoCampaignAgainst(
    state: HydratedOathGameState,
    attackerId: string,
    defenderPlayerId: string | undefined
): string | undefined {
    const reason = reasonCannotChooseDefender(state, attackerId, defenderPlayerId)
    if (reason) return reason

    const parties = declaredParties(state, attackerId, defenderPlayerId, [])
    const candidates = targetableBy(state, parties)
    const declarable = (targets: CampaignTarget[]) => {
        const declared = { ...parties, targets }
        return (
            reasonCannotDeclareTargets(state, declared) === undefined &&
            reasonSitesForbidTargets(state, declared, targetsNeedFlip(state, declared)) ===
                undefined
        )
    }
    // R-7.1.4 — Giant Python's even total can need a second target; no rule needs a third.
    const found =
        candidates.some((target) => declarable([target])) ||
        candidates.some((target, i) =>
            candidates.slice(i + 1).some((other) => declarable([target, other]))
        )
    return found
        ? undefined
        : `no targets can be declared against ${defenderPlayerId ?? 'the bandits'}`
}

/** R-5.5.1, R-5.5.2 — Sneak Attack gives the opportunity, not an exemption. */
export function reasonCannotSneakAttack(
    state: HydratedOathGameState,
    holderPlayerId: string,
    defenderPlayerId: string
): string | undefined {
    if (state.campaign) return 'a Campaign is already under way'
    return (
        reasonPersistentForbidsCampaign(state, holderPlayerId) ??
        reasonNoCampaignAgainst(state, holderPlayerId, defenderPlayerId)
    )
}

function targetableBy(state: HydratedOathGameState, parties: CampaignParties): CampaignTarget[] {
    const defenderId = parties.defenderPlayerId
    const defender = defenderId ? state.getPlayerState(defenderId) : undefined
    const sites = state
        .allSiteIds()
        .map((siteId): CampaignTarget => ({ kind: CampaignTargetKind.Site, siteId }))
    const held: CampaignTarget[] = defender
        ? [
              { kind: CampaignTargetKind.PawnAndFavor },
              ...defender.relicIds.map(
                  (cardId): CampaignTarget => ({ kind: CampaignTargetKind.Relic, cardId })
              ),
              ...Object.values(Banner)
                  .filter((banner) => bannerHolder(state, banner) === defender.playerId)
                  .map((banner): CampaignTarget => ({ kind: CampaignTargetKind.Banner, banner }))
          ]
        : []
    return [...sites, ...held].filter(
        (target) => reasonCannotTarget(state, parties, target) === undefined
    )
}

/** R-5.5.1 — an undefined defender is the bandits. */
export function reasonCannotChooseDefender(
    state: HydratedOathGameState,
    attackerId: string,
    defenderPlayerId: string | undefined
): string | undefined {
    const siteId = attackingSiteOf(state, attackerId)

    if (defenderPlayerId === undefined) {
        if (!banditsRuleSite(state, siteId)) {
            return 'a player rules your site, so the bandits cannot be chosen'
        }
        return undefined
    }

    if (defenderPlayerId === attackerId) {
        return 'must choose any one other player'
    }
    const other = state.findPlayerState(defenderPlayerId)
    if (!other) return `no such player ${defenderPlayerId}`

    const rules = rulersOfSite(state, siteId).includes(defenderPlayerId)
    if (!rules && other.siteId !== siteId) {
        return `${defenderPlayerId} neither rules your site nor has a pawn there`
    }
    return undefined
}

/** R-5.5.2 */
export function collectDefensePool(state: HydratedOathGameState, parties: CampaignParties): number {
    return targetDefenseDice(state, parties) + titleDefenseDice(state, parties)
}

/** R-5.5.2, R-2.8.3 — a site's printed shield is a reminder, not a number. */
export function targetDefenseDice(state: HydratedOathGameState, parties: CampaignParties): number {
    let dice = 0

    for (const target of parties.targets) {
        switch (target.kind) {
            case CampaignTargetKind.Site:
                dice += 1
                break
            case CampaignTargetKind.Relic: {
                const printed = relicDefenseDice(target.cardId)
                if (printed === undefined) {
                    throw Error(`Relic ${target.cardId} has no recorded defense dice (R-2.4.2)`)
                }
                dice += printed
                // Sealing Ward — "your relics add one more defense die when targeted".
                if (parties.defenderPlayerId)
                    dice += persistentRelicDefenseBonus(state, parties.defenderPlayerId)
                break
            }
            case CampaignTargetKind.Banner:
                // R-2.5.2 — as many dice as there are favor or secrets on it.
                dice += state.banners[target.banner].value
                break
            case CampaignTargetKind.SiteRelic:
                // Relic Hunter — "adding 1 defense die per relic".
                dice += 1
                break
            case CampaignTargetKind.PawnAndFavor:
                // R-5.5.2 — "this adds two dice, as shown by the shield on their board".
                dice += 2
                // Circlet of Command — "banishing your pawn and favor adds one more".
                if (parties.defenderPlayerId)
                    dice += persistentPawnDefenseBonus(state, parties.defenderPlayerId)
                break
        }
    }

    return dice
}

/** R-2.11.c, R-2.11.d — the Chancellor's title covers a defending Citizen unless R-5.5.1.a suspends them. */
export function titleDefenseDice(state: HydratedOathGameState, parties: CampaignParties): number {
    const holderId = state.oathkeeperPlayerId
    const defenderId = parties.defenderPlayerId
    // Bandits hold no titles (R-10.3).
    if (!holderId || !defenderId) return 0

    const holderIsChancellor = state.getPlayerState(holderId).status === PlayerStatus.Chancellor
    const applies =
        holderId === defenderId ||
        (holderIsChancellor && isImperialPlayer(state, defenderId, scopeOf(parties)))

    if (!applies) return 0
    return state.oathkeeperIsUsurper ? 2 : 1
}

// R-5.5.4, R-5.5.4.b, R-10.9 — by owner, so another player's warbands at a targeted site never defend.
export function collectDefendingForce(
    state: HydratedOathGameState,
    parties: CampaignParties
): WarbandGroup[] {
    const defenderId = parties.defenderPlayerId
    if (!defenderId) return []

    const sites = targetedSiteIds(parties)
    const force = warbandGroupsAtSites(
        state,
        sites,
        rulingWarbandOwners(state, defenderId, scopeOf(parties))
    )

    const inTheBattle = (playerId: string) => {
        const siteId = pawnSiteId(state, playerId)
        return siteId === parties.attackerSiteId || sites.includes(siteId)
    }

    const boards = [defenderId, ...parties.allyPlayerIds.filter((id) => id !== defenderId)]
    for (const playerId of boards) {
        if (inTheBattle(playerId)) force.push(...boardWarbandGroups(state, playerId))
    }

    return force
}

/** R-5.5.2, R-10.9 — the sites the force reaches, then the board with the attacker's own warbands first. */
export function collectAttackingForce(
    state: HydratedOathGameState,
    parties: Pick<CampaignParties, 'attackerPlayerId' | 'forceSiteIds'>
): WarbandGroup[] {
    const attackerId = parties.attackerPlayerId
    const board = state.getPlayerState(attackerId).warbandsOnBoard
    const onBoard = boardOwnersOwnFirst(state, attackerId)
        .map((owner): WarbandGroup => ({
            at: { kind: 'board', playerId: attackerId },
            owner,
            count: countOf(board, owner)
        }))
        .filter((group) => group.count > 0)
    return [
        ...warbandGroupsAtSites(
            state,
            parties.forceSiteIds,
            rulingWarbandOwners(state, attackerId)
        ),
        ...onBoard
    ]
}

// R-2.8.3, R-10.3, R-5.5.6, R-7.6.5 — bandits are counted apart from warbands and never killed.
export function collectDefendingBandits(
    state: HydratedOathGameState,
    parties: CampaignParties
): number {
    const sites = targetedSiteIds(parties)
    const defenderId = parties.defenderPlayerId
    if (!defenderId) return sites.length * banditsPerSite(state)

    const scope = scopeOf(parties)
    const defenders = [defenderId, ...parties.allyPlayerIds]
    const served = sites.filter((siteId) =>
        defenders.some((playerId) => banditsServe(state, playerId, siteId, scope))
    )
    return served.length * banditsPerSite(state)
}

export interface DicePools {
    attackPool: number
    defensePool: number
}

/** R-7.5.4 */
export interface DiceDelta {
    attack?: number
    defense?: number
}

/** R-5.5.3, R-7.5.4 — attack dice below zero cross to the defence one for one; defence floors at zero. */
export function applyDiceDelta(pools: DicePools, delta: DiceDelta): DicePools {
    const attackDelta = delta.attack ?? 0
    const defenseDelta = delta.defense ?? 0

    let attackPool = pools.attackPool + attackDelta
    let defensePool = pools.defensePool + defenseDelta

    if (attackPool < 0) {
        defensePool += -attackPool
        attackPool = 0
    }

    return { attackPool, defensePool: Math.max(0, defensePool) }
}

/** R-5.5.2 */
export function reasonCannotDeclareTargets(
    state: HydratedOathGameState,
    parties: CampaignParties
): string | undefined {
    const attackerSiteId = attackingSiteOf(state, parties.attackerPlayerId)

    const seen = new Set<string>()
    for (const target of parties.targets) {
        const key = campaignTargetKey(target)
        if (seen.has(key)) {
            return `${key} was declared twice`
        }
        seen.add(key)

        const reason = reasonCannotTarget(state, parties, target)
        if (reason) return reason
    }

    const sites = targetedSiteIds(parties)
    // A non-site target needs the defender's pawn at your site, so it counts as one there.
    const atAttackerSite =
        sites.includes(attackerSiteId) ||
        parties.targets.some((t) => t.kind !== CampaignTargetKind.Site)
    if (!atAttackerSite) {
        return 'must declare at least one target at your site'
    }

    const defenderId = parties.defenderPlayerId
    const defenderRulesAttackerSite = defenderId
        ? rulesSite(state, defenderId, attackerSiteId, scopeOf(parties))
        : banditsRuleSite(state, attackerSiteId)
    if (defenderRulesAttackerSite && !sites.includes(attackerSiteId)) {
        return `the defender rules ${attackerSiteId}, so you must target your site`
    }

    // R-7.1.4 — Giant Python: the targets must add an even total of defense dice; its Q&A
    // counts only the dice the targets add, not the Oathkeeper's.
    const targetDice = isAtLeastOathRevision(state, OathRevision.EngineFixes2)
        ? targetDefenseDice(state, parties)
        : collectDefensePool(state, parties)
    return reasonPersistentForbidsTargets(state, parties, targetDice)
}

function reasonCannotTarget(
    state: HydratedOathGameState,
    parties: CampaignParties,
    target: CampaignTarget
): string | undefined {
    const attackerSiteId = attackingSiteOf(state, parties.attackerPlayerId)
    const defenderId = parties.defenderPlayerId
    const defender = defenderId ? state.getPlayerState(defenderId) : undefined

    if (target.kind === CampaignTargetKind.Site) {
        // R-5.5.2 — "any sites they rule (yes, anywhere on the map!)".
        const ruled = defenderId
            ? rulesSite(state, defenderId, target.siteId, scopeOf(parties))
            : banditsRuleSite(state, target.siteId)
        if (!ruled) {
            const who = defenderId ?? 'the bandits'
            return `${who} does not rule ${target.siteId}`
        }
        return undefined
    }

    if (target.kind === CampaignTargetKind.SiteRelic) {
        // Relic Hunter — "facedown relics at targeted sites".
        const sites = targetedSiteIds(parties)
        const siteId = state.findRelicSlot(target.slotId)?.siteId
        if (!siteId) return `${target.slotId} is not a relic at a site`
        if (!sites.includes(siteId)) {
            return `${target.slotId} is at ${siteId}, which is not a targeted site`
        }
        // Ancient Bloodline — a relic at a site its holder rules is locked for their enemies.
        return siteLockedFor(state, parties.attackerPlayerId, siteId)
            ? `the relics at ${siteId} are locked (Ancient Bloodline)`
            : undefined
    }

    // R-10.3
    if (!defender) {
        return 'the bandits have no pawn, relics or banners to target'
    }
    if (defender.siteId !== attackerSiteId) {
        return "the defender's pawn is not at your site"
    }

    switch (target.kind) {
        case CampaignTargetKind.Relic:
            if (!defender.relicIds.includes(target.cardId)) {
                return `the defender does not hold ${target.cardId}`
            }
            // R-7.1.4 — Lost Tongue.
            return reasonPersistentForbidsRelicTake(
                state,
                parties.attackerPlayerId,
                defender.playerId,
                target.cardId
            )
        case CampaignTargetKind.Banner:
            if (bannerHolder(state, target.banner) !== defender.playerId) {
                return `the defender does not hold the ${target.banner}`
            }
            // R-7.1.4 — Tome Guardians, Lost Tongue.
            return reasonPersistentForbidsBannerTake(
                state,
                parties.attackerPlayerId,
                target.banner,
                'seize',
                defender.playerId
            )
        case CampaignTargetKind.PawnAndFavor:
            return undefined
    }
}
