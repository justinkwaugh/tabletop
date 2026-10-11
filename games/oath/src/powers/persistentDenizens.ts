import { bannerHolder } from '../util/oathkeeper.js'
import { spendFavor, usableFavor } from '../util/favor.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import type { CampaignParties } from '../util/campaign.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { ruledFaceupCardIds, rulesCard } from '../util/access.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import {
    areEnemies,
    enemyOfOwners,
    ownersRuleSite,
    type PersistentContext
} from '../util/persistent.js'
import { registerEffect, registerModifier, registerPersistent } from './registry.js'
import {
    gainFavorFromBank,
    gainSecrets,
    killWarbandsOnBoard,
    takeFavorFromPlayer,
    hasFaceupAdviserOfSuit,
    pawnSiteId
} from './vocabulary.js'
import { defendingPlayerIds, partySideOf } from '../util/battlePlans.js'
import { cannotRecoverForbids } from '../util/seize.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

/** "Against you" */
function againstOwner(
    ctx: PersistentContext,
    userId: string,
    parties: CampaignParties,
    side: BattlePlanSide
): string | undefined {
    return ctx.ownerIds.find((owner) => {
        const theirs = partySideOf(parties, owner)
        return theirs !== undefined && theirs !== side && owner !== userId
    })
}

// "Enemies of Forest Council's ruler cannot trade with or muster from beast cards."
const FOREST_COUNCIL = 'denizen.beast.forest-council'
registerPersistent(FOREST_COUNCIL, powerIndexOf(FOREST_COUNCIL, PowerTiming.Persistent), {
    forbidsTrade: (ctx, actorId, cardId) =>
        enemyOfOwners(ctx, actorId) && suitOf(cardId) === Suit.Beast
            ? 'Forest Council: enemies of its ruler cannot trade with beast cards'
            : undefined,
    forbidsMuster: (ctx, actorId, cardId) =>
        enemyOfOwners(ctx, actorId) && suitOf(cardId) === Suit.Beast
            ? 'Forest Council: enemies of its ruler cannot muster from beast cards'
            : undefined
})

// "Enemies of Gossip's ruler cannot play cards as facedown advisers."
registerPersistent(
    'denizen.discord.gossip',
    powerIndexOf('denizen.discord.gossip', PowerTiming.Persistent),
    {
        forbidsFacedownAdviser: (ctx, actorId) =>
            enemyOfOwners(ctx, actorId)
                ? 'Gossip: enemies of its ruler cannot play cards as facedown advisers'
                : undefined
    }
)

// "Enemies cannot play Visions faceup while their pawn is at any site ruled by Secret Police's ruler."
registerPersistent(
    'denizen.order.secret-police',
    powerIndexOf('denizen.order.secret-police', PowerTiming.Persistent),
    {
        forbidsFaceupVision: (ctx, actorId) => {
            if (!enemyOfOwners(ctx, actorId)) return undefined
            const here = pawnSiteId(ctx.state, actorId)
            return ownersRuleSite(ctx, here)
                ? 'Secret Police: you cannot play Visions faceup at a site its ruler rules'
                : undefined
        }
    }
)

// "Players cannot play Visions, except the Conspiracy, faceup unless their pawn is at this site."
registerPersistent(
    'denizen.nomad.sacred-ground',
    powerIndexOf('denizen.nomad.sacred-ground', PowerTiming.Persistent),
    {
        forbidsFaceupVision: (ctx, actorId, cardId) => {
            if (cardId === CONSPIRACY_ID) return undefined
            return ctx.state.getPlayerState(actorId).siteId === ctx.siteId
                ? undefined
                : 'Sacred Ground: Visions can only be played faceup by a player standing on it'
        }
    }
)

// "Enemies of Tome Guardians' ruler cannot target or take the Darkest Secret in any way."
registerPersistent(
    'denizen.order.tome-guardians',
    powerIndexOf('denizen.order.tome-guardians', PowerTiming.Persistent),
    {
        forbidsBannerTake: (ctx, actorId, banner) =>
            banner === Banner.DarkestSecret && enemyOfOwners(ctx, actorId)
                ? 'Tome Guardians: enemies of its ruler cannot take the Darkest Secret'
                : undefined
    }
)

// "Other players cannot target or take your relics or banners in any way unless they rule a nomad card."
const LOST_TONGUE = 'denizen.nomad.lost-tongue'
function lostTongue(
    ctx: PersistentContext,
    actorId: string,
    holderId: string | undefined
): string | undefined {
    if (!holderId || !ctx.ownerIds.includes(holderId) || actorId === holderId) return undefined
    const rulesNomad = ruledFaceupCardIds(ctx.state, actorId).some(
        (id) => suitOf(id) === Suit.Nomad
    )
    return rulesNomad
        ? undefined
        : "Lost Tongue: its holder's relics and banners cannot be taken without ruling a nomad card"
}
registerPersistent(LOST_TONGUE, powerIndexOf(LOST_TONGUE, PowerTiming.Persistent), {
    forbidsBannerTake: (ctx, actorId, _banner, _how, holderId) =>
        lostTongue(ctx, actorId, holderId),
    forbidsRelicTake: (ctx, actorId, holderId) => lostTongue(ctx, actorId, holderId)
})

// "Enemies of Spell Breaker's ruler cannot use powers that cost any secret or burn-secret."
registerPersistent(
    'denizen.nomad.spell-breaker',
    powerIndexOf('denizen.nomad.spell-breaker', PowerTiming.Persistent),
    {
        forbidsSecretCosts: (ctx, actorId) =>
            enemyOfOwners(ctx, actorId)
                ? 'Spell Breaker: enemies of its ruler cannot use powers that cost secrets'
                : undefined
    }
)

// "You cannot campaign. Attackers cannot sacrifice warbands to increase their attack against you."
registerPersistent(
    'denizen.hearth.vow-of-peace',
    powerIndexOf('denizen.hearth.vow-of-peace', PowerTiming.Persistent),
    {
        forbidsCampaign: (ctx, actorId) =>
            ctx.ownerIds.includes(actorId) ? 'Vow of Peace: you cannot campaign' : undefined,
        forbidsSacrifice: (ctx, _attackerId, defenderId) =>
            defenderId && ctx.ownerIds.includes(defenderId)
                ? 'Vow of Peace: attackers cannot sacrifice against its holder'
                : undefined
    }
)

// "If you're a Citizen, you cannot be exiled, even by yourself."
registerPersistent(
    'denizen.order.council-seat',
    powerIndexOf('denizen.order.council-seat', PowerTiming.Persistent),
    {
        forbidsExile: (ctx, citizenId) =>
            ctx.ownerIds.includes(citizenId)
                ? 'Council Seat: this Citizen cannot be exiled'
                : undefined
    }
)

// "You cannot recover the Darkest Secret or give anyone secrets. Whenever a player recovers it, you gain X secrets equal to the number they placed."
registerPersistent(
    'denizen.arcane.vow-of-silence',
    powerIndexOf('denizen.arcane.vow-of-silence', PowerTiming.Persistent),
    {
        forbidsBannerTake: (ctx, actorId, banner, how) =>
            banner === Banner.DarkestSecret &&
            ctx.ownerIds.includes(actorId) &&
            cannotRecoverForbids(ctx.state, how)
                ? 'Vow of Silence: you cannot recover the Darkest Secret'
                : undefined,
        forbidsGivingSecrets: (ctx, actorId) =>
            ctx.ownerIds.includes(actorId)
                ? 'Vow of Silence: you cannot give anyone secrets'
                : undefined,
        afterBannerRecovered: (ctx, actorId, banner, placed) => {
            if (banner !== Banner.DarkestSecret) return undefined
            const notes: string[] = []
            for (const owner of ctx.ownerIds) {
                if (owner === actorId) continue
                notes.push(
                    `Vow of Silence: ${owner} gained ${gainSecrets(ctx.state, owner, placed)} secrets`
                )
            }
            return notes.length > 0 ? notes.join('; ') : undefined
        }
    }
)

// "Players who target this site cannot use battle plans."
const MARSH_SPIRIT = 'denizen.beast.marsh-spirit'
registerPersistent(MARSH_SPIRIT, powerIndexOf(MARSH_SPIRIT, PowerTiming.Persistent), {
    forbidsBattlePlan: (ctx, userId, _power, parties, side) =>
        side === BattlePlanSide.Attacker &&
        userId === parties.attackerPlayerId &&
        ctx.siteId &&
        targetedSiteIds(parties).includes(ctx.siteId)
            ? 'Marsh Spirit: players who target its site cannot use battle plans'
            : undefined
})

// "Enemies cannot use beast or nomad battle plans against you."
registerPersistent(
    'denizen.discord.beast-tamer',
    powerIndexOf('denizen.discord.beast-tamer', PowerTiming.Persistent),
    {
        forbidsBattlePlan: (ctx, userId, power, parties, side) => {
            const owner = againstOwner(ctx, userId, parties, side)
            if (!owner || !areEnemies(ctx.state, owner, userId)) return undefined
            const suit = suitOf(power.cardId)
            return suit === Suit.Beast || suit === Suit.Nomad
                ? `Beast Tamer: ${owner}'s enemies cannot use beast or nomad battle plans against them`
                : undefined
        }
    }
)

// "Your enemy cannot use battle plans that match any of your advisers against you."
registerPersistent(
    'denizen.beast.true-names',
    powerIndexOf('denizen.beast.true-names', PowerTiming.Persistent),
    {
        forbidsBattlePlan: (ctx, userId, power, parties, side) => {
            const owner = againstOwner(ctx, userId, parties, side)
            if (!owner) return undefined
            const suit = suitOf(power.cardId)
            const matches = suit !== undefined && hasFaceupAdviserOfSuit(ctx.state, owner, suit)
            return matches
                ? `True Names: ${owner}'s enemy cannot use a ${suit} battle plan against them`
                : undefined
        }
    }
)

// "Your enemy's battle plans have an added cost of a secret."
registerPersistent(
    'denizen.arcane.gleaming-armor',
    powerIndexOf('denizen.arcane.gleaming-armor', PowerTiming.Persistent),
    {
        battlePlanExtraCost: (ctx, userId, parties, side) =>
            againstOwner(ctx, userId, parties, side) ? { placeSecret: 1 } : undefined
    }
)

// "Your enemy's battle plans each have an added cost of burning a favor."
registerPersistent(
    'denizen.beast.insect-swarm',
    powerIndexOf('denizen.beast.insect-swarm', PowerTiming.Persistent),
    {
        battlePlanExtraCost: (ctx, userId, parties, side) =>
            againstOwner(ctx, userId, parties, side) ? { burnFavor: 1 } : undefined
    }
)

// "Your relics add one more defense die when targeted."
registerPersistent(
    'denizen.arcane.sealing-ward',
    powerIndexOf('denizen.arcane.sealing-ward', PowerTiming.Persistent),
    {
        relicDefenseBonus: (ctx, holderId) => (ctx.ownerIds.includes(holderId) ? 1 : 0)
    }
)

// Its Q&A — the Chancellor holding it binds an attack on a Citizen, being an ally from the
// declaration; a Citizen holding it does not, joining only after the targets (R-5.5.2.a).
function pythonHolderAttacked(ctx: PersistentContext, parties: CampaignParties): boolean {
    const attacked = defendingPlayerIds(
        isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes2)
            ? parties
            : { defenderPlayerId: parties.defenderPlayerId, allyPlayerIds: [] }
    )
    return attacked.some((playerId) => ctx.ownerIds.includes(playerId))
}

// "Whenever a player attacks you, they must declare targets that add an even total of defense dice to your defense pool."
registerPersistent(
    'denizen.beast.giant-python',
    powerIndexOf('denizen.beast.giant-python', PowerTiming.Persistent),
    {
        forbidsTargets: (ctx, parties, targetDice) =>
            pythonHolderAttacked(ctx, parties) && targetDice % 2 !== 0
                ? `Giant Python: the targets must add an even total of defense dice, not ${targetDice}`
                : undefined
    }
)

// "Enemies traveling from any site ruled by Grasping Vines' ruler must kill one warband on their board if able."
registerPersistent(
    'denizen.beast.grasping-vines',
    powerIndexOf('denizen.beast.grasping-vines', PowerTiming.Persistent),
    {
        afterTravel: (ctx, actorId, from) => {
            if (!from || !enemyOfOwners(ctx, actorId)) return undefined
            if (!ownersRuleSite(ctx, from)) return undefined
            const { killed } = killWarbandsOnBoard(ctx.state, actorId, 1)
            return killed ? `Grasping Vines: killed a warband on ${actorId}'s board` : undefined
        }
    }
)

// "If you travel to this site and do not rule this card, you must kill two warbands on your board if able."
const BOILING_LAKE = 'denizen.discord.boiling-lake'
registerPersistent(BOILING_LAKE, powerIndexOf(BOILING_LAKE, PowerTiming.Persistent), {
    afterTravel: (ctx, actorId, _from, to) => {
        if (to !== ctx.siteId || rulesCard(ctx.state, actorId, BOILING_LAKE)) return undefined
        const { killed } = killWarbandsOnBoard(ctx.state, actorId, 2)
        return killed ? `Boiling Lake: killed ${killed} warbands on ${actorId}'s board` : undefined
    }
})

// "After another player takes the Oathkeeper title, you take favor from them."
registerPersistent(
    'denizen.discord.chaos-cult',
    powerIndexOf('denizen.discord.chaos-cult', PowerTiming.Persistent),
    {
        afterTitleTaken: (ctx, newHolderId) => {
            const notes: string[] = []
            for (const owner of ctx.ownerIds) {
                if (owner === newHolderId) continue
                notes.push(
                    `Chaos Cult: ${owner} took ${takeFavorFromPlayer(ctx.state, owner, newHolderId, 1)} favor from ${newHolderId}`
                )
            }
            return notes.length > 0 ? notes.join('; ') : undefined
        }
    }
)

// "After another player plays a nomad or order card, you gain two favor from the matching favor bank."
registerPersistent(
    'denizen.hearth.saddle-makers',
    powerIndexOf('denizen.hearth.saddle-makers', PowerTiming.Persistent),
    {
        afterCardPlayed: (ctx, actorId, cardId) => {
            const suit = suitOf(cardId)
            if (suit !== Suit.Nomad && suit !== Suit.Order) return undefined
            const notes: string[] = []
            for (const owner of ctx.ownerIds) {
                if (owner === actorId) continue
                notes.push(
                    `Saddle Makers: ${owner} gained ${gainFavorFromBank(ctx.state, owner, suit, 2)} favor from the ${suit} bank`
                )
            }
            return notes.length > 0 ? notes.join('; ') : undefined
        }
    }
)

// "Marriage counts as two hearth advisers, but only counts as one toward your adviser limit."
registerPersistent(
    'denizen.hearth.marriage',
    powerIndexOf('denizen.hearth.marriage', PowerTiming.Persistent),
    {
        extraMatchingAdvisers: (ctx, holderId, suit) =>
            suit === Suit.Hearth && ctx.ownerIds.includes(holderId) ? 1 : 0
    }
)

// "To muster, you must place a secret instead of favor." Mandatory Muster modifier.
registerModifier(
    'denizen.arcane.initiation-rite',
    powerIndexOf('denizen.arcane.initiation-rite', PowerTiming.Modifier),
    {
        mandatory: true,
        hooks: { musterPlacesSecret: true }
    }
)

// "When played, each player, except the holder of the People's Favor, places one favor on this card for each suit of card they rule."
const DISSENT = 'denizen.discord.dissent'
registerEffect(DISSENT, powerIndexOf(DISSENT, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        const holder = bannerHolder(ctx.state, Banner.PeoplesFavor)
        let placed = 0
        for (const p of ctx.state.players) {
            if (p.playerId === holder) continue
            const suits = new Set(
                ruledFaceupCardIds(ctx.state, p.playerId)
                    .map((id) => suitOf(id))
                    .filter((s) => s !== undefined)
            )
            const pay = Math.min(suits.size, usableFavor(ctx.state, p.playerId))
            spendFavor(ctx.state, p.playerId, pay)
            placed += pay
        }
        ctx.state.addTokensOn(DISSENT, { favor: placed })
        return { summary: `Dissent: ${placed} favor placed on it, one per suit each player rules` }
    }
})
