import { assertExists } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { PowerQuestionKind } from '../model/question.js'
import {
    facedownAdviserChoices,
    one,
    PowerChoiceKind,
    type ChoiceDomain
} from '../util/powerChoice.js'
import { askQuestion } from '../util/questions.js'
import { knownDraw } from '../util/knowledge.js'
import { SECOND_WIND_ID, nextActionIndex } from '../util/freeActions.js'
import {
    registerBattlePlan,
    registerEffect,
    registerModifier,
    type EffectContext,
    chosen
} from './registry.js'
import { giveFavor, takeFavorFromPlayer, usableFavor } from '../util/favor.js'
import {
    discardDenizensAtSites,
    faceupSitesInYourRegion,
    pawnSiteId,
    faceupSitesWithCardOfSuit
} from './vocabulary.js'
import { playerChoicesAtYourSite } from './choiceDomains.js'
import { SALT_THE_EARTH } from '../util/capacity.js'
import { reasonPersistentForbidsGivingSecrets } from '../util/persistent.js'
import { siteHolding } from '../util/access.js'
import { handedOver } from '../model/playerState.js'

// "After you're victorious, you may travel and then may campaign, spending no Supply for either." Attacker. Cost: burn 1 favor, place 1 secret.
const SECOND_WIND = SECOND_WIND_ID
registerBattlePlan(SECOND_WIND, powerIndexOf(SECOND_WIND, PowerTiming.BattlePlan), {
    hooks: {
        onOutcome: (ctx, victorious) => {
            if (!victorious) return undefined
            const me = ctx.state.getPlayerState(ctx.playerId)
            // A free Travel taken at that action moves the Campaign's along by one.
            me.freeTravelAtAction = nextActionIndex(ctx.state)
            me.freeCampaignAtAction = nextActionIndex(ctx.state)
            return 'Second Wind: the next Travel, and then a Campaign, cost no Supply'
        }
    }
})

// "Action: Swap any two facedown advisers." Cost: place 2 favor.
const DREAM_THIEF = 'denizen.arcane.dream-thief'
const facedownAdvisers: ChoiceDomain = (state) =>
    state.players.flatMap((p) => facedownAdviserChoices(p))
registerEffect(DREAM_THIEF, powerIndexOf(DREAM_THIEF, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.FacedownAdviser, {
            what: 'a facedown adviser',
            domain: facedownAdvisers
        }),
        one(PowerChoiceKind.FacedownAdviser, {
            what: 'another facedown adviser',
            domain: facedownAdvisers
        })
    ],
    reasonCannotResolve: (ctx) => {
        const [a, b] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        return a && b && a.playerId === b.playerId && a.index === b.index
            ? 'choose two different advisers'
            : undefined
    },
    resolve: (ctx) => {
        const [a, b] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        if (a.playerId === b.playerId)
            return {
                summary: `Dream Thief: both advisers belonged to ${a.playerId}, so nothing moved`
            }
        const pa = ctx.state.getPlayerState(a.playerId)
        const pb = ctx.state.getPlayerState(b.playerId)
        const adviserA = pa.knownAdvisers()[a.index]
        const adviserB = pb.knownAdvisers()[b.index]
        assertExists(adviserA, `${a.playerId} has no adviser at ${a.index}`)
        assertExists(adviserB, `${b.playerId} has no adviser at ${b.index}`)
        pa.replaceAdviser(adviserA.cardId, handedOver(adviserB, pb.playerId, pa.playerId))
        pb.replaceAdviser(adviserB.cardId, handedOver(adviserA, pa.playerId, pb.playerId))
        // R-9.4 — each holder now knows a card they had not seen.
        return {
            summary: `Dream Thief: swapped facedown advisers between ${pa.playerId} and ${pb.playerId}`,
            disclosed: true
        }
    }
})

// "Action: Give [secret] to a player whose pawn is at your site to take [favor][favor] from them,
//  or give [favor][favor] for [secret], any number of times." Cost: place 1 secret.
const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'
registerEffect(WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Player, {
            what: 'a player at your site',
            domain: playerChoicesAtYourSite
        }),
        one(PowerChoiceKind.Count, { what: 'secrets to give, two favor taken for each' }),
        one(PowerChoiceKind.Count, { what: 'pairs of favor to give, a secret taken for each' })
    ],
    reasonCannotResolve: (ctx) => {
        const [them] = chosen(ctx, PowerChoiceKind.Player)
        const [give, take] = chosen(ctx, PowerChoiceKind.Count).map((c) => c.n)
        if (!Number.isInteger(give) || !Number.isInteger(take) || give < 0 || take < 0)
            return 'the counts must be whole numbers'
        if (give + take === 0) return 'name at least one exchange'
        const me = ctx.state.getPlayerState(ctx.playerId)
        const other = ctx.state.getPlayerState(them.playerId)
        if (me.secrets < give) return `you have ${me.secrets} secrets to give, not ${give}`
        if (give > 0) {
            const silenced = reasonPersistentForbidsGivingSecrets(ctx.state, ctx.playerId)
            if (silenced) return silenced
        }
        if (other.favor < 2 * give)
            return `${them.playerId} has ${other.favor} favor, not the ${2 * give} you would take`
        const usable = usableFavor(ctx.state, ctx.playerId)
        if (usable < 2 * take) return `you have ${usable} favor to give, not ${2 * take}`
        if (other.secrets < take)
            return `${them.playerId} has ${other.secrets} secrets, not the ${take} you would take`
        return undefined
    },
    resolve: (ctx) => {
        const [them] = chosen(ctx, PowerChoiceKind.Player)
        const [give, take] = chosen(ctx, PowerChoiceKind.Count).map((c) => c.n)
        const me = ctx.state.getPlayerState(ctx.playerId)
        const other = ctx.state.getPlayerState(them.playerId)
        me.secrets -= give
        other.secrets += give
        takeFavorFromPlayer(ctx.state, ctx.playerId, them.playerId, 2 * give)
        giveFavor(ctx.state, ctx.playerId, them.playerId, 2 * take)
        other.secrets -= take
        me.secrets += take
        return {
            summary: `Witch's Bargain: with ${them.playerId}, gave ${give} secrets for ${2 * give} favor and ${2 * take} favor for ${take} secrets`,
            targetPlayerId: them.playerId
        }
    }
})

// "While your pawn is at this site, you may trade with a card at any site in your region." Site card.
const MAP_LIBRARY = 'denizen.arcane.map-library'
registerModifier(MAP_LIBRARY, powerIndexOf(MAP_LIBRARY, PowerTiming.Modifier), {
    hooks: {
        condition: (ctx) => {
            const here = siteHolding(ctx.state, MAP_LIBRARY)
            return here && ctx.state.getPlayerState(ctx.playerId).siteId === here
                ? undefined
                : 'your pawn is not at the Map Library'
        },
        tradeSites: (ctx) => faceupSitesInYourRegion(ctx.state, ctx.playerId)
    }
})

// "Act as if your pawn is at any site with a [suit:beast] card." Adviser.
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const beastSites = (ctx: EffectContext) => faceupSitesWithCardOfSuit(ctx.state, Suit.Beast)
registerModifier(SMALL_FRIENDS, powerIndexOf(SMALL_FRIENDS, PowerTiming.Modifier), {
    // "(You may use Trade modifiers there.)"
    hooks: { tradeSites: beastSites, actsAsAtSites: beastSites }
})

// "When played, draw a relic. Take it or put it on the bottom of the relic deck." Adviser, locked.
const FAMILY_HEIRLOOM = 'denizen.hearth.family-heirloom'
registerEffect(FAMILY_HEIRLOOM, powerIndexOf(FAMILY_HEIRLOOM, PowerTiming.WhenPlayed), {
    choices: [],
    hidden: () => ({ kind: 'relicDraw', count: 1 }),
    resolve: (ctx) => {
        const drawn = ctx.reveal?.kind === 'relics' ? ctx.reveal.relicCardIds[0] : undefined
        if (!drawn) return { summary: 'Family Heirloom: no relic was drawn' }
        askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.KeepOrBottomRelic,
            cardId: FAMILY_HEIRLOOM,
            askedPlayerId: ctx.playerId,
            ...knownDraw(ctx.reveal),
            relicCardId: drawn
        })
        return {
            summary: 'Family Heirloom: drew a relic — take it, or put it on the bottom',
            peeked: [drawn]
        }
    }
})

// "If playing to a site, you may discard a denizen there first." Search modifier.
// The "may" is answered at the play, with the card to play seen.
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
registerModifier(CROP_ROTATION, powerIndexOf(CROP_ROTATION, PowerTiming.Modifier), {
    hooks: { discardFirstAtSitePlay: true }
})

// "You cannot play Salt the Earth to a site with any locked cards. When played, ignore this site's
//  capacity. Discard all other denizens at this site. This site's capacity is now 1." Site, locked.
registerEffect(SALT_THE_EARTH, powerIndexOf(SALT_THE_EARTH, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        const siteId = pawnSiteId(ctx.state, ctx.playerId)
        const { discarded, pileDeposits } = discardDenizensAtSites(
            ctx.state,
            ctx.playerId,
            [siteId],
            (id) => id !== SALT_THE_EARTH,
            ctx.power.cardId
        )
        ctx.state.siteCapacityOverrides = { ...ctx.state.siteCapacityOverrides, [siteId]: 1 }
        return {
            summary: `Salt the Earth: discarded ${discarded.length} denizens at ${siteId}; its capacity is now 1`,
            pileDeposits
        }
    }
})
