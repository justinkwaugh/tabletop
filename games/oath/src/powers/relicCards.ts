import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { Banner } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { giveFavor, usableFavor } from '../util/favor.js'
import {
    facedownAdviserChoices,
    one,
    optional,
    PowerChoiceKind,
    type ChoiceDomain,
    reliquarySlotChoices
} from '../util/powerChoice.js'
import { askQuestion } from '../util/questions.js'
import { gainSupply } from '../util/rest.js'
import { rulesSite } from '../util/rule.js'
import {
    registerBattlePlan,
    registerContinuous,
    registerEffect,
    registerModifier,
    registerPersistent,
    chosen
} from './registry.js'
import {
    gainWarbandsToBoard,
    pawnSiteId,
    swapPlayedCardWithSiteCard,
    hasFaceupAdviserOfSuit
} from './vocabulary.js'
import { cardChoicesAtYourSite } from './choiceDomains.js'
import { opposingLeadId } from '../util/battlePlans.js'
import { releaseRelic } from '../util/relics.js'
import { reasonPersistentForbidsGivingSecrets } from '../util/persistent.js'
import { reasonCannotMoveCardTo } from '../util/locked.js'
import { reasonCannotTravelByPower, travelByPower } from '../util/powerTravel.js'

// "Action: Put this relic on the bottom of the relic deck to gain 4 Supply."
registerEffect('relic.map', powerIndexOf('relic.map', PowerTiming.Action), {
    choices: [],
    resolve: (ctx) => {
        releaseRelic(ctx.state, ctx.playerId, 'relic.map')
        const gained = gainSupply(ctx.state, ctx.playerId, 4)
        return {
            summary: `Map: returned to the bottom of the relic deck; gained ${gained} Supply`,
            relicToDeckBottom: 'relic.map'
        }
    }
})

// "After traveling, gain one warband."
registerModifier(
    'relic.dragonskin-drum',
    powerIndexOf('relic.dragonskin-drum', PowerTiming.Modifier),
    {
        hooks: {
            after: (ctx) => ({
                summary: `Dragonskin Drum: gained ${gainWarbandsToBoard(ctx.state, ctx.playerId, 1)} warband`
            })
        }
    }
)

// "Spend no Supply if you're trading with a card that matches any of your advisers."
registerModifier('relic.cup-of-plenty', powerIndexOf('relic.cup-of-plenty', PowerTiming.Modifier), {
    hooks: {
        condition: (ctx) => {
            const cardId = ctx.particulars?.cardId
            const suit = cardId ? suitOf(cardId) : undefined
            const matches =
                suit !== undefined && hasFaceupAdviserOfSuit(ctx.state, ctx.playerId, suit)
            return matches ? undefined : `${ctx.particulars?.cardId} matches none of your advisers`
        },
        supplyCost: () => 0
    }
})

// "You cannot place warbands at sites. When mustering, you gain two more warbands."
registerContinuous(
    'relic.ring-of-devotion',
    powerIndexOf('relic.ring-of-devotion', PowerTiming.Continuous),
    {
        cannotPlaceWarbandsAtSites: true,
        musterWarbandsBonus: 2
    }
)

// "Action: Draw a relic. Take it or put it on the bottom of the relic deck." Cost: burn 2 favor, place 1 secret.
const DOWSING_STICKS = 'relic.dowsing-sticks'
registerEffect(DOWSING_STICKS, powerIndexOf(DOWSING_STICKS, PowerTiming.Action), {
    choices: [],
    hidden: () => ({ kind: 'relicDraw', count: 1 }),
    resolve: (ctx) => {
        const drawn = ctx.reveal?.kind === 'relics' ? ctx.reveal.relicCardIds[0] : undefined
        if (!drawn) return { summary: 'Dowsing Sticks: no relic was drawn' }
        askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.KeepOrBottomRelic,
            cardId: DOWSING_STICKS,
            askedPlayerId: ctx.playerId,
            relicCardId: drawn
        })
        return {
            summary: 'Dowsing Sticks: drew a relic — take it, or put it on the bottom',
            peeked: [drawn]
        }
    }
})

// "Action: Swap one of your faceup advisers with a card at your site." Cost: place 1 secret.
const HORNED_MASK = 'relic.horned-mask'
// R-7.2.1, R-7.2.2 — the adviser goes to the site and the site's card to the advisers.
const ownFaceupAdvisers: ChoiceDomain = (state, playerId) =>
    state
        .getPlayerState(playerId)
        .faceupAdviserIds()
        .filter((cardId) => reasonCannotMoveCardTo(state, playerId, cardId, 'site') === undefined)
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
const movableCardsAtYourSite: ChoiceDomain = (state, playerId) =>
    cardChoicesAtYourSite(state, playerId).filter(
        (choice) =>
            choice.kind === PowerChoiceKind.Card &&
            reasonCannotMoveCardTo(state, playerId, choice.cardId, 'advisers') === undefined
    )
registerEffect(HORNED_MASK, powerIndexOf(HORNED_MASK, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Card, {
            what: 'one of your faceup advisers',
            domain: ownFaceupAdvisers
        }),
        one(PowerChoiceKind.Card, { what: 'a card at your site', domain: movableCardsAtYourSite })
    ],
    resolve: (ctx) => {
        const [adviser, site] = chosen(ctx, PowerChoiceKind.Card)
        swapPlayedCardWithSiteCard(ctx.state, ctx.playerId, adviser.cardId, site.cardId)
        return { summary: `Horned Mask: swapped ${adviser.cardId} with ${site.cardId}` }
    }
})

// "Action: Peek at the top three cards of the world deck."
const ORACULAR_PIG = 'relic.oracular-pig'
registerEffect(ORACULAR_PIG, powerIndexOf(ORACULAR_PIG, PowerTiming.Action), {
    choices: [],
    hidden: () => ({ kind: 'worldDeckPeek', count: 3 }),
    resolve: (ctx) => {
        const seen = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : []
        // R-9.4 — the world deck's size is private, so the public summary names no count.
        return {
            summary: 'Oracular Pig: peeked at the top of the world deck',
            peeked: seen
        }
    }
})

// "Action: Choose a pawn at another site. They must travel to your site if able, spending no Supply.
//  If they do, give them the [secret] here." Cost: place 1 secret.
const WHISTLE = 'relic.whistle'
const pawnsElsewhere: ChoiceDomain = (state, playerId) => {
    const here = pawnSiteId(state, playerId)
    return state.players
        .filter((p) => p.playerId !== playerId && pawnSiteId(state, p.playerId) !== here)
        .map((p) => ({ kind: PowerChoiceKind.Player, playerId: p.playerId }))
}
registerEffect(WHISTLE, powerIndexOf(WHISTLE, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Player, {
            what: 'a player whose pawn is at another site',
            domain: pawnsElsewhere
        })
    ],
    resolve: (ctx) => {
        const [them] = chosen(ctx, PowerChoiceKind.Player)
        const here = pawnSiteId(ctx.state, ctx.playerId)
        const other = ctx.state.getPlayerState(them.playerId)
        // "If able" — its Q&A: the Travel rules bind (Narrow Pass, The Hidden Place, Vow of Union); unable, nothing happens.
        const unable = reasonCannotTravelByPower(ctx.state, them.playerId, here)
        if (unable) return { summary: `Whistle: ${them.playerId} cannot travel here (${unable})` }
        const { notes } = travelByPower(ctx.state, them.playerId, here)
        // Vow of Silence — "cannot give anyone secrets": the pull still happens.
        const silenced = reasonPersistentForbidsGivingSecrets(ctx.state, ctx.playerId)
        const given = silenced ? 0 : Math.min(1, ctx.state.tokensOn(WHISTLE).secrets)
        ctx.state.addTokensOn(WHISTLE, { secrets: -given })
        other.secrets += given
        return {
            summary: `Whistle: ${them.playerId} travelled to ${here} and was given ${given} secret${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`
        }
    }
})

// "Action: If the Chancellor rules your site, peek at any one relic in the Imperial Reliquary, and you may take it." Cost: place 1 secret, burn 1 secret.
const SKELETON_KEY = 'relic.skeleton-key'
registerEffect(SKELETON_KEY, powerIndexOf(SKELETON_KEY, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.RelicSlot, { what: 'a Reliquary relic', domain: reliquarySlotChoices })
    ],
    reasonCannotResolve: (ctx) => {
        return rulesSite(ctx.state, ctx.state.chancellorId(), pawnSiteId(ctx.state, ctx.playerId))
            ? undefined
            : 'Skeleton Key: the Chancellor does not rule your site'
    },
    hidden: (ctx) => {
        const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
        return slot ? { kind: 'relicPeekAtSlot', slotId: slot.slotId } : undefined
    },
    resolve: (ctx) => {
        const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
        const relicCardId = ctx.reveal?.kind === 'relic' ? ctx.reveal.relicCardId : undefined
        if (!relicCardId) return { summary: 'Skeleton Key: nothing was seen' }
        ctx.state.getPlayerState(ctx.playerId).recordPeek(slot.slotId, relicCardId)
        askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.TakeOrLeaveRelic,
            cardId: SKELETON_KEY,
            askedPlayerId: ctx.playerId,
            slotId: slot.slotId,
            relicCardId
        })
        return {
            summary: 'Skeleton Key: peeked at a Reliquary relic — take it, or leave it',
            peeked: [relicCardId]
        }
    }
})

// "Action: Peek at any facedown site, adviser, or relic at any site." Cost: place 1 secret.
const IVORY_EYE = 'relic.ivory-eye'
const facedownAdvisersAnywhere: ChoiceDomain = (state) =>
    state.players.flatMap((p) => facedownAdviserChoices(p))
const facedownRelicsAnywhere: ChoiceDomain = (state) =>
    state
        .allSiteIds()
        .flatMap((siteId) =>
            state
                .relicSlotsAt(siteId)
                .map((s) => ({ kind: PowerChoiceKind.RelicSlot, slotId: s.slotId }))
        )
const facedownSites: ChoiceDomain = (state) =>
    state
        .allSiteIds()
        .filter((siteId) => !state.isSiteFaceup(siteId))
        .map((siteId) => ({ kind: PowerChoiceKind.Site, siteId }))
registerEffect(IVORY_EYE, powerIndexOf(IVORY_EYE, PowerTiming.Action), {
    choices: [
        optional(PowerChoiceKind.FacedownAdviser, {
            what: 'a facedown adviser',
            domain: facedownAdvisersAnywhere
        }),
        optional(PowerChoiceKind.RelicSlot, {
            what: 'a facedown relic at a site',
            domain: facedownRelicsAnywhere
        }),
        optional(PowerChoiceKind.Site, { what: 'a facedown site', domain: facedownSites })
    ],
    reasonCannotResolve: (ctx) =>
        ctx.choices.length === 1 ? undefined : 'Ivory Eye: choose exactly one thing to peek at',
    hidden: (ctx) => {
        const [adviser] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        if (adviser)
            return { kind: 'facedownAdviser', playerId: adviser.playerId, index: adviser.index }
        const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
        if (slot) return { kind: 'relicPeekAtSlot', slotId: slot.slotId }
        const [site] = chosen(ctx, PowerChoiceKind.Site)
        if (site) return { kind: 'siteAtSlot', slotId: site.siteId }
        return undefined
    },
    resolve: (ctx) => {
        const [adviser] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        if (adviser) {
            const seen = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : []
            return { summary: 'Ivory Eye: peeked at a facedown adviser', peeked: seen }
        }
        const [slot] = chosen(ctx, PowerChoiceKind.RelicSlot)
        if (slot) {
            const relicCardId = ctx.reveal?.kind === 'relic' ? ctx.reveal.relicCardId : undefined
            if (!relicCardId) return { summary: 'Ivory Eye: nothing was seen' }
            ctx.state.getPlayerState(ctx.playerId).recordPeek(slot.slotId, relicCardId)
            return {
                summary: `Ivory Eye: peeked at the relic at ${slot.slotId}`,
                peeked: [relicCardId]
            }
        }
        const siteCardId = ctx.reveal?.kind === 'site' ? ctx.reveal.siteCardId : undefined
        return {
            summary: 'Ivory Eye: peeked at a facedown site',
            peeked: siteCardId ? [siteCardId] : []
        }
    }
})

// "You may choose to draw two more cards. If you do, you must reveal every card you draw and the card you keep." Search modifier.
const TRUTHFUL_HARP = 'relic.truthful-harp'
registerModifier(TRUTHFUL_HARP, powerIndexOf(TRUTHFUL_HARP, PowerTiming.Modifier), {
    hooks: { drawCount: (base) => base + 2, revealsDraw: true }
})

// "You must gain [secret] instead of [favor] when you play to a site." Search modifier, mandatory.
const BOOK_OF_RECORDS = 'relic.book-of-records'
registerModifier(BOOK_OF_RECORDS, powerIndexOf(BOOK_OF_RECORDS, PowerTiming.Modifier), {
    mandatory: true,
    hooks: { sitePlayGainsSecret: true }
})

// "If you're victorious, gain one warband per enemy warband killed in this campaign." Either side.
const CURSED_CAULDRON = 'relic.cursed-cauldron'
registerBattlePlan(CURSED_CAULDRON, powerIndexOf(CURSED_CAULDRON, PowerTiming.BattlePlan), {
    hooks: {
        onOutcome: (ctx, victorious) => {
            if (!victorious) return undefined
            const killed = ctx.state.campaign?.defeatKilled ?? 0
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, killed)
            return `Cursed Cauldron: gained ${gained} warbands, one per enemy warband killed`
        }
    }
})

// "If you're victorious, you may kill all the warbands in your enemy's force. If you do, you must give them [favor] if able." Either side.
const STICKY_FIRE = 'relic.sticky-fire'
registerBattlePlan(STICKY_FIRE, powerIndexOf(STICKY_FIRE, PowerTiming.BattlePlan), {
    hooks: {
        killsEnemyForce: true,
        onOutcome: (ctx, victorious) => {
            if (!victorious) return undefined
            const campaign = ctx.campaign
            const enemyId = opposingLeadId(campaign.parties, campaign.side)
            if (!enemyId) return 'Sticky Fire: the bandits have nobody to pay'
            const given = Math.min(1, usableFavor(ctx.state, ctx.playerId))
            giveFavor(ctx.state, ctx.playerId, enemyId, given)
            return `Sticky Fire: the enemy force was killed entirely; gave ${enemyId} ${given} favor`
        }
    }
})

// "Players cannot target or take your banners or your other relics. In campaigns, banishing your pawn and favor adds one more [defenseDie]." Persistent.
const CIRCLET = 'relic.circlet-of-command'
registerPersistent(CIRCLET, powerIndexOf(CIRCLET, PowerTiming.Persistent), {
    forbidsBannerTake: (ctx, actorId, banner, holderId) =>
        holderId !== undefined && ctx.ownerIds.includes(holderId) && actorId !== holderId
            ? `Circlet of Command: ${holderId}'s ${banner === Banner.PeoplesFavor ? "People's Favor" : 'Darkest Secret'} cannot be targeted or taken`
            : undefined,
    forbidsRelicTake: (ctx, actorId, holderId, relicCardId) =>
        ctx.ownerIds.includes(holderId) && actorId !== holderId && relicCardId !== CIRCLET
            ? `Circlet of Command: ${holderId}'s other relics cannot be targeted or taken`
            : undefined,
    pawnDefenseBonus: (ctx, holderId) => (ctx.ownerIds.includes(holderId) ? 1 : undefined)
})
