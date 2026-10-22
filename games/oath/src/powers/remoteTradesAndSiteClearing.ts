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
    denizensToDiscardAtSites,
    discardDenizensAtSites,
    faceupSitesInYourRegion,
    siteOfPlayedCard,
    faceupSitesWithCardOfSuit
} from './vocabulary.js'
import { bargainChoicesAtYourSite, playerChoicesAtYourSite } from './choiceDomains.js'
import { SALT_THE_EARTH } from '../util/capacity.js'
import { reasonPersistentForbidsGivingSecrets } from '../util/persistent.js'
import { siteHolding } from '../util/access.js'
import { handedOver } from '../model/playerState.js'
import { isAtLeastOathRevision, OathRevision } from '../util/revision.js'
import { secretsToGiveAfterCost, WITCHS_BARGAIN, type BargainEntry } from '../util/witchsBargain.js'

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
// From revision 7 one use deals with several players at the site (its Q&A: "Can I affect multiple
// players at my site with one use of this card power? A: Yes!"), one entry each, and the secret
// the cost places cannot be given (R-7.1.2). Before it, one player and two counts (R-X.4).
const ONE_PLAYER_ONLY = { beforeRevision: OathRevision.EngineFixes3 }
registerEffect(WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Player, {
            what: 'a player at your site',
            domain: playerChoicesAtYourSite,
            ...ONE_PLAYER_ONLY
        }),
        one(PowerChoiceKind.Count, {
            what: 'secrets to give, two favor taken for each',
            ...ONE_PLAYER_ONLY
        }),
        one(PowerChoiceKind.Count, {
            what: 'pairs of favor to give, a secret taken for each',
            ...ONE_PLAYER_ONLY
        }),
        {
            kind: PowerChoiceKind.Bargain,
            // At most one entry for each other player: six seats.
            min: 1,
            max: 5,
            what: 'a player at your site',
            domain: bargainChoicesAtYourSite,
            fromRevision: OathRevision.EngineFixes3
        }
    ],
    reasonCannotResolve: (ctx) =>
        isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes3)
            ? reasonCannotBargain(ctx)
            : reasonCannotBargainWithOne(ctx),
    resolve: (ctx) => {
        const entries = isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes3)
            ? chosen(ctx, PowerChoiceKind.Bargain)
            : [oneEntryOf(ctx)]
        for (const entry of entries) bargainWith(ctx, entry)
        return {
            summary: `Witch's Bargain: ${entries
                .map(
                    (e) =>
                        `with ${e.playerId}, gave ${e.secretsGiven} secrets for ${2 * e.secretsGiven} favor and ${2 * e.pairsGiven} favor for ${e.pairsGiven} secrets`
                )
                .join('; ')}`,
            targetPlayerId: entries[0].playerId
        }
    }
})

/** Before revision 7: one player and two counts, held against the holdings before the cost. */
function oneEntryOf(ctx: EffectContext): BargainEntry {
    const [them] = chosen(ctx, PowerChoiceKind.Player)
    const [give, take] = chosen(ctx, PowerChoiceKind.Count).map((c) => c.n)
    return {
        kind: PowerChoiceKind.Bargain,
        playerId: them.playerId,
        secretsGiven: give,
        pairsGiven: take
    }
}

function reasonCannotBargainWithOne(ctx: EffectContext): string | undefined {
    const { playerId: themId, secretsGiven: give, pairsGiven: take } = oneEntryOf(ctx)
    if (!Number.isInteger(give) || !Number.isInteger(take) || give < 0 || take < 0)
        return 'the counts must be whole numbers'
    if (give + take === 0) return 'name at least one exchange'
    const me = ctx.state.getPlayerState(ctx.playerId)
    const other = ctx.state.getPlayerState(themId)
    if (me.secrets < give) return `you have ${me.secrets} secrets to give, not ${give}`
    if (give > 0) {
        const silenced = reasonPersistentForbidsGivingSecrets(ctx.state, ctx.playerId)
        if (silenced) return silenced
    }
    if (other.favor < 2 * give)
        return `${themId} has ${other.favor} favor, not the ${2 * give} you would take`
    const usable = usableFavor(ctx.state, ctx.playerId)
    if (usable < 2 * take) return `you have ${usable} favor to give, not ${2 * take}`
    if (other.secrets < take)
        return `${themId} has ${other.secrets} secrets, not the ${take} you would take`
    return undefined
}

/** The totals are held together: the user's against what they hold after the cost, each player's against theirs. */
function reasonCannotBargain(ctx: EffectContext): string | undefined {
    const entries = chosen(ctx, PowerChoiceKind.Bargain)
    const whole = (n: number) => Number.isInteger(n) && n >= 0
    if (!entries.every((e) => whole(e.secretsGiven) && whole(e.pairsGiven)))
        return 'the counts must be whole numbers'
    if (entries.every((e) => e.secretsGiven + e.pairsGiven === 0))
        return 'name at least one exchange'
    const idle = entries.find((e) => e.secretsGiven + e.pairsGiven === 0)
    if (idle) return `name at least one exchange with ${idle.playerId}`
    const give = entries.reduce((n, e) => n + e.secretsGiven, 0)
    const pairs = entries.reduce((n, e) => n + e.pairsGiven, 0)
    const left = secretsToGiveAfterCost(ctx.state, ctx.playerId, ctx.power)
    if (left < give) return `you have ${left} secrets to give after the cost, not ${give}`
    if (give > 0) {
        const silenced = reasonPersistentForbidsGivingSecrets(ctx.state, ctx.playerId)
        if (silenced) return silenced
    }
    const usable = usableFavor(ctx.state, ctx.playerId)
    if (usable < 2 * pairs) return `you have ${usable} favor to give, not ${2 * pairs}`
    for (const e of entries) {
        const other = ctx.state.getPlayerState(e.playerId)
        if (other.favor < 2 * e.secretsGiven)
            return `${e.playerId} has ${other.favor} favor, not the ${2 * e.secretsGiven} you would take`
        // Their last secret too (its Q&A: "Can I take someone's last secret? … Yup!").
        if (other.secrets < e.pairsGiven)
            return `${e.playerId} has ${other.secrets} secrets, not the ${e.pairsGiven} you would take`
    }
    return undefined
}

/** In the order named: the secrets given and their favor taken, then the favor given and their secrets taken. */
function bargainWith(ctx: EffectContext, entry: BargainEntry): void {
    const me = ctx.state.getPlayerState(ctx.playerId)
    const other = ctx.state.getPlayerState(entry.playerId)
    me.secrets -= entry.secretsGiven
    other.secrets += entry.secretsGiven
    takeFavorFromPlayer(ctx.state, ctx.playerId, entry.playerId, 2 * entry.secretsGiven)
    giveFavor(ctx.state, ctx.playerId, entry.playerId, 2 * entry.pairsGiven)
    other.secrets -= entry.pairsGiven
    me.secrets += entry.pairsGiven
}

// "While your pawn is at this site, you may trade with a card at any site in your region." Site card.
const MAP_LIBRARY = 'denizen.arcane.map-library'
registerModifier(MAP_LIBRARY, powerIndexOf(MAP_LIBRARY, PowerTiming.Modifier), {
    hooks: {
        // Small Friends from revision 19: the pawn acts as if at its site (`actsAsAt`).
        condition: (ctx) => {
            const here = siteHolding(ctx.state, MAP_LIBRARY)
            const at = ctx.particulars?.actsAsAt ?? ctx.state.getPlayerState(ctx.playerId).siteId
            return here && at === here ? undefined : 'your pawn is not at the Map Library'
        },
        tradeSites: (ctx) => {
            const at = ctx.particulars?.actsAsAt
            if (at === undefined) return faceupSitesInYourRegion(ctx.state, ctx.playerId)
            const region = ctx.state.regionOf(at)
            return ctx.state
                .faceupSiteIds()
                .filter((siteId) => ctx.state.regionOf(siteId) === region)
        }
    }
})

// "Act as if your pawn is at any site with a [suit:beast] card." Adviser.
const SMALL_FRIENDS = 'denizen.beast.small-friends'
// R-X.4 — before revision 19 every such site at once; from it, the one site its use names, and
// only there (its Q&A: "Can I use Trade modifiers at the site my pawn is physically at, in
// addition to the site I am acting as if I am at? Nope! Only the new site.").
const actedAt = (ctx: EffectContext) =>
    isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes15)
        ? chosen(ctx, PowerChoiceKind.Site).map((choice) => choice.siteId)
        : faceupSitesWithCardOfSuit(ctx.state, Suit.Beast)
registerModifier(SMALL_FRIENDS, powerIndexOf(SMALL_FRIENDS, PowerTiming.Modifier), {
    choices: [
        one(PowerChoiceKind.Site, {
            what: 'the site you act as if you are at',
            domain: (state) =>
                faceupSitesWithCardOfSuit(state, Suit.Beast).map((siteId) => ({
                    kind: PowerChoiceKind.Site,
                    siteId
                })),
            fromRevision: OathRevision.EngineFixes15
        })
    ],
    // "(You may use Trade modifiers there.)"
    hooks: {
        tradeSites: actedAt,
        actsAsAtSites: actedAt,
        // From revision 19 its use names a site: with none to name, it is not usable.
        reasonUnusable: (ctx) =>
            isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes15) &&
            faceupSitesWithCardOfSuit(ctx.state, Suit.Beast).length === 0
                ? 'no faceup site has a Beast card'
                : undefined
    }
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
    // Before its play the card is at no site: the play names the one it goes to.
    mapLeaving: (ctx) => {
        const siteId = ctx.mapChanges?.siteId
        assertExists(siteId, 'Salt the Earth is only played to a site')
        return denizensToDiscardAtSites(
            ctx.state,
            ctx.playerId,
            [siteId],
            (id) => id !== SALT_THE_EARTH,
            ctx.mapChanges
        )
    },
    resolve: (ctx) => {
        // "This site": where it was played, which the People's Favor or New Growth may make another site.
        const siteId = siteOfPlayedCard(ctx.state, ctx.playerId, SALT_THE_EARTH)
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
