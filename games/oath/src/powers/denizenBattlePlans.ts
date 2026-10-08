import { assertExists } from '@tabletop/common'
import { bannerHolder } from '../util/oathkeeper.js'
import { removeFavorFromBoard } from '../util/favor.js'
import { burnFavor, burnFavorFromBank } from '../util/burn.js'
import { countKilled } from '../util/campaignRoll.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { collectDefendingForce, type DiceDelta } from '../util/campaign.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { forceTotal, warbandsOnBoardOf } from '../util/force.js'
import { isImperialPlayer } from '../util/rule.js'
import { ruledFaceupCardIds, siteHolding } from '../util/access.js'
import { registerBattlePlan, type BattlePlanContext } from './registry.js'
import { PowerChoiceKind, optional } from '../util/powerChoice.js'
import {
    burnSecretsFromPlayer,
    denizensOnMap,
    gainFavorFromBank,
    gainWarbandsToBoard,
    killWarbandGroup,
    killWarbandsOnBoard,
    ruledCardsOfSuit,
    siteHasCardOfSuit,
    hasFaceupAdviserOfSuit
} from './vocabulary.js'
import { defendingPlayerIds } from '../util/battlePlans.js'

const side = (ctx: BattlePlanContext): BattlePlanSide => ctx.campaign.side

/** R-7.5.4-H1 */
function pm(ctx: BattlePlanContext, n: number): DiceDelta | undefined {
    if (n <= 0) return undefined
    return { attack: side(ctx) === BattlePlanSide.Attacker ? n : -n }
}

/** R-10.29 — "your enemy". */
function enemies(ctx: BattlePlanContext): string[] {
    const parties = ctx.campaign.parties
    return side(ctx) === BattlePlanSide.Attacker
        ? defendingPlayerIds(parties)
        : [parties.attackerPlayerId]
}

function enemyHasAdviserOf(ctx: BattlePlanContext, suit: Suit): boolean {
    return enemies(ctx).some((id) => hasFaceupAdviserOfSuit(ctx.state, id, suit))
}

function enemyHolds(ctx: BattlePlanContext, banner: Banner): boolean {
    const holder = bannerHolder(ctx.state, banner)
    return holder !== undefined && enemies(ctx).includes(holder)
}

function targeted(ctx: BattlePlanContext): string[] {
    return targetedSiteIds(ctx.campaign.parties)
}

function pawnTargeted(ctx: BattlePlanContext): boolean {
    return ctx.campaign.parties.targets.some((t) => t.kind === CampaignTargetKind.PawnAndFavor)
}

function planUser(ctx: BattlePlanContext): string {
    assertExists(ctx.playerId, `${ctx.power.cardId} reads its user, and the bandits are no player`)
    return ctx.playerId
}

/** R-10.9 — "your force". */
function myForce(ctx: BattlePlanContext): number {
    return side(ctx) === BattlePlanSide.Attacker
        ? warbandsOnBoardOf(ctx.state, planUser(ctx))
        : forceTotal(collectDefendingForce(ctx.state, ctx.campaign.parties))
}
function enemyForce(ctx: BattlePlanContext): number {
    return side(ctx) === BattlePlanSide.Attacker
        ? forceTotal(collectDefendingForce(ctx.state, ctx.campaign.parties))
        : warbandsOnBoardOf(ctx.state, ctx.campaign.parties.attackerPlayerId)
}

/** Fire Talkers' entry widens "you hold" to any Imperial player when you are one (R-10.28-H1). */
function holdsDarkestSecretWide(ctx: BattlePlanContext): boolean {
    const user = planUser(ctx)
    const holder = bannerHolder(ctx.state, Banner.DarkestSecret)
    if (!holder) return false
    if (holder === user) return true
    return isImperialPlayer(ctx.state, user) && isImperialPlayer(ctx.state, holder)
}

/**
 * Cursed Cauldron — a plan's own kill, of `dying`'s force. The bandits' plans resolve while the
 * Campaign is mustered, before its state exists, and no player stands on their side to count one.
 */
function countPlanKill(ctx: BattlePlanContext, dying: BattlePlanSide, count: number): void {
    if (ctx.playerId === undefined) return
    const campaign = ctx.state.campaign
    assertExists(campaign, "a player's defending plan is used inside a Campaign")
    countKilled(ctx.state, campaign, dying, count)
}

/** R-10.3-H1 — favor a bank would pay the bandits is burned. */
function gainFavorFromBankFor(ctx: BattlePlanContext, suit: Suit, wanted: number): number {
    return ctx.playerId === undefined
        ? burnFavorFromBank(ctx.state, suit, wanted)
        : gainFavorFromBank(ctx.state, ctx.playerId, suit, wanted)
}

function discardAtOutcome(ctx: BattlePlanContext, cardId: string): void {
    const campaign = ctx.state.campaign
    assertExists(campaign, 'an outcome hook runs inside a Campaign')
    if (!campaign.discardAtEnd.includes(cardId))
        campaign.discardAtEnd = [...campaign.discardAtEnd, cardId]
}

// "If you're defeated, kill no warbands in your force. Ignore powers that kill all of your force." Cost: place 1 secret.
registerBattlePlan(
    'denizen.arcane.billowing-fog',
    powerIndexOf('denizen.arcane.billowing-fog', PowerTiming.BattlePlan),
    {
        hooks: { defeatKills: 'none' }
    }
)

// "If you hold the Darkest Secret, ignore all your enemy's rolls of hollow swords." Defender. Cost: place 1 secret.
registerBattlePlan(
    'denizen.arcane.rusting-ray',
    powerIndexOf('denizen.arcane.rusting-ray', PowerTiming.BattlePlan),
    {
        hooks: {
            reasonCannotUse: (ctx) =>
                bannerHolder(ctx.state, Banner.DarkestSecret) === ctx.playerId
                    ? undefined
                    : 'you do not hold the Darkest Secret',
            rollRules: { ignoreHollowSwords: true }
        }
    }
)

// "± attack die per site targeted." Cost: burn 1 secret.
registerBattlePlan(
    'denizen.arcane.cracking-ground',
    powerIndexOf('denizen.arcane.cracking-ground', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => pm(ctx, targeted(ctx).length) }
    }
)

// "±3 attack dice if you hold the Darkest Secret." Cost: place 1 secret.
registerBattlePlan(
    'denizen.arcane.fire-talkers',
    powerIndexOf('denizen.arcane.fire-talkers', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => (holdsDarkestSecretWide(ctx) ? pm(ctx, 3) : undefined) }
    }
)

// "Ignore all skulls you roll. ±X attack dice up to the number of other suits you rule." Cost: place 1 secret.
registerBattlePlan(
    'denizen.arcane.kindred-warriors',
    powerIndexOf('denizen.arcane.kindred-warriors', PowerTiming.BattlePlan),
    {
        hooks: {
            ignoreSkulls: true,
            dice: (ctx) => {
                const suits = new Set(
                    ruledFaceupCardIds(ctx.state, planUser(ctx))
                        .map((id) => suitOf(id))
                        .filter((s) => s !== undefined && s !== Suit.Arcane)
                )
                return pm(ctx, suits.size)
            }
        }
    }
)

// "Ignore all skulls you roll. +2 attack dice if the defense pool has 4+ defense dice." Attacker. Cost: place 1 favor.
registerBattlePlan(
    'denizen.beast.rangers',
    powerIndexOf('denizen.beast.rangers', PowerTiming.BattlePlan),
    {
        hooks: {
            ignoreSkulls: true,
            dice: (ctx) => (ctx.campaign.pools.defensePool >= 4 ? { attack: 2 } : undefined)
        }
    }
)

// "Ignore all attack or defense added by your enemy's rolls of [sword][sword][skull] or [shield][shield]." Cost: place 1 favor.
registerBattlePlan(
    'denizen.beast.war-tortoise',
    powerIndexOf('denizen.beast.war-tortoise', PowerTiming.BattlePlan),
    {
        hooks: {
            rollRules: (ctx) =>
                side(ctx) === BattlePlanSide.Attacker
                    ? { ignoreTwoShieldFaces: true }
                    : { ignoreTwoSwordFaces: true }
        }
    }
)

// "± attack die per beast adviser you have." Cost: place 1 secret.
registerBattlePlan(
    'denizen.beast.nature-worship',
    powerIndexOf('denizen.beast.nature-worship', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: (ctx) =>
                pm(
                    ctx,
                    ctx.state
                        .getPlayerState(planUser(ctx))
                        .faceupAdviserIds()
                        .filter((cardId) => suitOf(cardId) === Suit.Beast).length
                )
        }
    }
)

// "± defense die per beast card at any sites if this site is targeted." Defender, cost-free.
const GARDEN = 'denizen.beast.walled-garden'
registerBattlePlan(GARDEN, powerIndexOf(GARDEN, PowerTiming.BattlePlan), {
    hooks: {
        dice: (ctx) => {
            const here = siteHolding(ctx.state, GARDEN)
            if (!here || !targeted(ctx).includes(here)) return undefined
            const n = denizensOnMap(ctx.state, Suit.Beast).length
            return n > 0 ? { defense: n } : undefined
        }
    }
})

// "If the defending force is larger than your force, each warband you sacrifice will add three (not one)." Attacker. Cost: place 1 favor.
registerBattlePlan(
    'denizen.discord.zealots',
    powerIndexOf('denizen.discord.zealots', PowerTiming.BattlePlan),
    {
        // Its Q&A — judged when used, before any skull kills.
        hooks: {
            rollRules: (ctx) => ({
                zealots:
                    forceTotal(collectDefendingForce(ctx.state, ctx.campaign.parties)) >
                    warbandsOnBoardOf(ctx.state, planUser(ctx))
            })
        }
    }
)

// "If you're victorious and targeted the defender's pawn, they also burn all of the secrets on their board except their last." Attacker.
registerBattlePlan(
    'denizen.discord.book-burning',
    powerIndexOf('denizen.discord.book-burning', PowerTiming.BattlePlan),
    {
        hooks: {
            onOutcome: (ctx, victorious) => {
                const defenderId = ctx.campaign.parties.defenderPlayerId
                if (!victorious || !pawnTargeted(ctx) || !defenderId) return undefined
                const them = ctx.state.getPlayerState(defenderId)
                const burned = burnSecretsFromPlayer(
                    ctx.state,
                    defenderId,
                    Math.max(0, them.secrets - Math.max(0, 1 - them.secretsFacedown))
                )
                return `Book Burning: ${defenderId} burned ${burned} secrets`
            }
        }
    }
)

// "±4 attack dice if your enemy has an arcane adviser." Cost: burn 1 favor, place 1 secret.
registerBattlePlan(
    'denizen.discord.cracked-sage',
    powerIndexOf('denizen.discord.cracked-sage', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => (enemyHasAdviserOf(ctx, Suit.Arcane) ? pm(ctx, 4) : undefined) }
    }
)

// "+4 attack dice if targeting a site that has an order card." Attacker. Cost: place 1 favor, burn 1 favor.
registerBattlePlan(
    'denizen.discord.disgraced-captain',
    powerIndexOf('denizen.discord.disgraced-captain', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: (ctx) =>
                targeted(ctx).some((siteId) => siteHasCardOfSuit(ctx.state, siteId, Suit.Order))
                    ? { attack: 4 }
                    : undefined
        }
    }
)

// "±3 attack dice. If you're defeated while using this power, discard Mercenaries." Cost: place 1 favor.
const MERCENARIES = 'denizen.discord.mercenaries'
registerBattlePlan(MERCENARIES, powerIndexOf(MERCENARIES, PowerTiming.BattlePlan), {
    hooks: {
        dice: (ctx) => pm(ctx, 3),
        onOutcome: (ctx, victorious) => {
            if (victorious) return undefined
            discardAtOutcome(ctx, MERCENARIES)
            return 'Mercenaries: defeated, so it is discarded'
        }
    }
})

// "If you're victorious and targeted the defender's pawn, they burn all of the favor on their board (not half)." Attacker. Cost: place 1 favor.
registerBattlePlan(
    'denizen.discord.slander',
    powerIndexOf('denizen.discord.slander', PowerTiming.BattlePlan),
    {
        hooks: {
            onOutcome: (ctx, victorious) => {
                const defenderId = ctx.campaign.parties.defenderPlayerId
                if (!victorious || !pawnTargeted(ctx) || !defenderId) return undefined
                const onBoard = ctx.state.getPlayerState(defenderId).favor
                const burned = removeFavorFromBoard(ctx.state, defenderId, onBoard)
                burnFavor(ctx.state, burned)
                return `Slander: ${defenderId} burned all ${burned} of their favor`
            }
        }
    }
)

// "If you're defeated, kill no warbands in your force and discard Traveling Doctor. Ignore powers that kill all of your force."
// R-5.5.6: defeated bandits resolve it too. Their force holds no warbands, so only the discard does anything.
const DOCTOR = 'denizen.hearth.traveling-doctor'
function travelingDoctor(ctx: BattlePlanContext, victorious: boolean): string | undefined {
    if (victorious) return undefined
    discardAtOutcome(ctx, DOCTOR)
    return ctx.playerId === undefined
        ? 'Traveling Doctor: discarded, the bandits being defeated'
        : 'Traveling Doctor: defeated, no warbands killed, and it is discarded'
}
registerBattlePlan(DOCTOR, powerIndexOf(DOCTOR, PowerTiming.BattlePlan), {
    hooks: { defeatKills: 'none', onOutcome: travelingDoctor, onBanditOutcome: travelingDoctor }
})

// "±3 attack dice and ignore all skulls you roll, unless your enemy has the People's Favor." Cost: place 2 favor.
registerBattlePlan(
    'denizen.hearth.the-great-levy',
    powerIndexOf('denizen.hearth.the-great-levy', PowerTiming.BattlePlan),
    {
        hooks: {
            reasonCannotUse: (ctx) =>
                enemyHolds(ctx, Banner.PeoplesFavor)
                    ? "your enemy has the People's Favor, so The Great Levy would do nothing"
                    : undefined,
            ignoreSkulls: true,
            dice: (ctx) => pm(ctx, 3)
        }
    }
)

// "±2 attack dice unless your enemy has the People's Favor." Cost-free.
registerBattlePlan(
    'denizen.hearth.village-constable',
    powerIndexOf('denizen.hearth.village-constable', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => (enemyHolds(ctx, Banner.PeoplesFavor) ? undefined : pm(ctx, 2)) }
    }
)

// "Double your total attack roll. At end, discard Lancers." Attacker.
registerBattlePlan(
    'denizen.nomad.lancers',
    powerIndexOf('denizen.nomad.lancers', PowerTiming.BattlePlan),
    {
        hooks: { rollRules: { doubleAttackRoll: true }, discardAtEnd: true }
    }
)

// "The attacker rolls only half the attack dice in their attack pool, rounded down. At end, discard Mounted Patrol." Defender.
registerBattlePlan(
    'denizen.nomad.mounted-patrol',
    powerIndexOf('denizen.nomad.mounted-patrol', PowerTiming.BattlePlan),
    {
        hooks: { rollRules: { halveAttackPool: true }, discardAtEnd: true }
    }
)

// "Ignore all your enemy's rolls of single shields. At end, discard Rain Boots." Attacker.
registerBattlePlan(
    'denizen.nomad.rain-boots',
    powerIndexOf('denizen.nomad.rain-boots', PowerTiming.BattlePlan),
    {
        hooks: { rollRules: { ignoreSingleShields: true }, discardAtEnd: true }
    }
)

// "± attack die per nomad card you rule. At end, discard Great Crusade."
registerBattlePlan(
    'denizen.nomad.great-crusade',
    powerIndexOf('denizen.nomad.great-crusade', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: (ctx) => pm(ctx, ruledCardsOfSuit(ctx.state, planUser(ctx), Suit.Nomad).length),
            discardAtEnd: true
        }
    }
)

// "±3 attack dice. At end, discard Horse Archers."
registerBattlePlan(
    'denizen.nomad.horse-archers',
    powerIndexOf('denizen.nomad.horse-archers', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => pm(ctx, 3), discardAtEnd: true }
    }
)

// "±1 or ±3 attack dice. At end, discard." Its Q&A: discarded only when ±3 is chosen. Cost: place 1 secret.
const choseThree = (ctx: BattlePlanContext): boolean =>
    ctx.choices.some((choice) => choice.kind === PowerChoiceKind.Yes)
registerBattlePlan(
    'denizen.nomad.mountain-giant',
    powerIndexOf('denizen.nomad.mountain-giant', PowerTiming.BattlePlan),
    {
        choices: [optional(PowerChoiceKind.Yes, { what: '±3 instead of ±1, then discard it' })],
        hooks: { dice: (ctx) => pm(ctx, choseThree(ctx) ? 3 : 1), discardAtEnd: choseThree }
    }
)

// "±4 attack dice if your enemy has a nomad adviser. At end, discard Rival Khan."
registerBattlePlan(
    'denizen.nomad.rival-khan',
    powerIndexOf('denizen.nomad.rival-khan', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: (ctx) => (enemyHasAdviserOf(ctx, Suit.Nomad) ? pm(ctx, 4) : undefined),
            discardAtEnd: true
        }
    }
)

// "If you're victorious, gain two favor from the order bank." Its Q&A: the bandits burn it.
function battleHonors(ctx: BattlePlanContext, victorious: boolean): string | undefined {
    if (!victorious) return undefined
    const gained = gainFavorFromBankFor(ctx, Suit.Order, 2)
    return ctx.playerId === undefined
        ? `Battle Honors: burned ${gained} favor from the order bank, the bandits being victorious`
        : `Battle Honors: gained ${gained} favor from the order bank`
}
registerBattlePlan(
    'denizen.order.battle-honors',
    powerIndexOf('denizen.order.battle-honors', PowerTiming.BattlePlan),
    {
        hooks: { onOutcome: battleHonors, onBanditOutcome: battleHonors }
    }
)

// "−1 attack die. Kill one warband on the attacker's board." Defender.
registerBattlePlan(
    'denizen.order.bear-traps',
    powerIndexOf('denizen.order.bear-traps', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: () => ({ attack: -1 }),
            onUse: (ctx) => {
                const attackerId = ctx.campaign.parties.attackerPlayerId
                const { killed } = killWarbandsOnBoard(ctx.state, attackerId, 1)
                countPlanKill(ctx, BattlePlanSide.Attacker, killed)
                return killed
                    ? `Bear Traps: killed a warband on ${attackerId}'s board`
                    : "Bear Traps: no warband on the attacker's board to kill"
            }
        }
    }
)

// "If you're victorious, gain three warbands." Cost: place 1 favor.
registerBattlePlan(
    'denizen.order.field-promotion',
    powerIndexOf('denizen.order.field-promotion', PowerTiming.BattlePlan),
    {
        hooks: {
            onOutcome: (ctx, victorious) =>
                victorious
                    ? `Field Promotion: gained ${gainWarbandsToBoard(ctx.state, ctx.playerId, 3)} warbands`
                    : undefined
        }
    }
)

// "If you're victorious, gain favor from the favor banks matching each adviser of your enemy (including Imperial Allies)."
// Its Q&A: the bandits burn it.
function militaryParade(ctx: BattlePlanContext, victorious: boolean): string | undefined {
    if (!victorious) return undefined
    let gained = 0
    for (const id of enemies(ctx)) {
        for (const cardId of ctx.state.getPlayerState(id).faceupAdviserIds()) {
            const suit = suitOf(cardId)
            if (suit) gained += gainFavorFromBankFor(ctx, suit, 1)
        }
    }
    return ctx.playerId === undefined
        ? `Military Parade: burned ${gained} favor from the banks matching the attacker's advisers, the bandits being victorious`
        : `Military Parade: gained ${gained} favor from the banks matching your enemy's advisers`
}
registerBattlePlan(
    'denizen.order.military-parade',
    powerIndexOf('denizen.order.military-parade', PowerTiming.BattlePlan),
    {
        hooks: { onOutcome: militaryParade, onBanditOutcome: militaryParade }
    }
)

// "+2 defense dice. If you're defeated, kill all of your force." Defender. Cost: place 1 favor.
registerBattlePlan(
    'denizen.order.shield-wall',
    powerIndexOf('denizen.order.shield-wall', PowerTiming.BattlePlan),
    {
        hooks: { dice: () => ({ defense: 2 }), defeatKills: 'all' }
    }
)

// "The defender cannot use battle plans." Attacker. Cost: place 2 favor.
registerBattlePlan(
    'denizen.order.specialist',
    powerIndexOf('denizen.order.specialist', PowerTiming.BattlePlan),
    {
        hooks: { locksEnemyPlans: true }
    }
)

// "+1 defense die if you sacrifice one warband in your force." Defender, cost-free.
// Using it is choosing to sacrifice.
registerBattlePlan(
    'denizen.order.wrestlers',
    powerIndexOf('denizen.order.wrestlers', PowerTiming.BattlePlan),
    {
        hooks: {
            dice: (ctx) => {
                const user = ctx.playerId
                // R-7.6.5 — bandits are never warbands, so the bandits have none to sacrifice.
                if (user === undefined) return undefined
                const force = collectDefendingForce(ctx.state, ctx.campaign.parties).filter(
                    (g) => g.at.kind === 'site' || g.at.playerId === user
                )
                const group = force.find((g) => g.at.kind === 'board') ?? force[0]
                if (!group) return undefined
                const killed = killWarbandGroup(ctx.state, { ...group, count: 1 })
                countPlanKill(ctx, BattlePlanSide.Defender, killed)
                return killed > 0 ? { defense: 1 } : undefined
            }
        }
    }
)

// "±2 attack dice but you cannot use other battle plans." Cost-free.
registerBattlePlan(
    'denizen.order.code-of-honor',
    powerIndexOf('denizen.order.code-of-honor', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => pm(ctx, 2), exclusive: true }
    }
)

// "±2 attack dice if your force is larger than your enemy's." Cost: place 1 favor.
registerBattlePlan(
    'denizen.order.encirclement',
    powerIndexOf('denizen.order.encirclement', PowerTiming.BattlePlan),
    {
        hooks: { dice: (ctx) => (myForce(ctx) > enemyForce(ctx) ? pm(ctx, 2) : undefined) }
    }
)

// "+2 defense dice if this site is targeted." Defender, locked, cost-free.
const KEEP = 'denizen.order.keep'
registerBattlePlan(KEEP, powerIndexOf(KEEP, PowerTiming.BattlePlan), {
    hooks: {
        dice: (ctx) => {
            const here = siteHolding(ctx.state, KEEP)
            return here && targeted(ctx).includes(here) ? { defense: 2 } : undefined
        }
    }
})
