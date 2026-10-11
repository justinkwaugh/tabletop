import { assertExists } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { CONSPIRACY_ID, suitOf } from '../data/cardRegistry.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    facedownAdviserChoices,
    one,
    optional,
    PowerChoiceKind,
    type ChoiceDomain
} from '../util/powerChoice.js'
import { askQuestion } from '../util/questions.js'
import {
    type ImperialScope,
    rulesSite,
    rulingWarbandOwners,
    sitesRuledBy,
    warbandsFreeToLeave
} from '../util/rule.js'
import { battleScopeOf } from '../util/campaign.js'
import { partiesOf } from '../util/campaignRoll.js'
import { receiveFavor } from '../util/favor.js'
import { areEnemies } from '../util/persistent.js'
import {
    registerBattlePlan,
    registerEffect,
    registerModifier,
    registerPersistent,
    chosen
} from './registry.js'
import {
    moveWarbandsBoardToSite,
    moveWarbandsSiteToBoard,
    otherPlayersAtYourSite,
    regionOfPawn
} from './vocabulary.js'
import { warbandEntries } from '../util/warbands.js'

// "Action: Peek at an adviser of a player whose pawn is at your site. If it is the Conspiracy, you play it
//  or discard it. If it is not, give them the [favor] here." Cost: place 1 favor.
const INQUISITOR = 'denizen.arcane.inquisitor'
const facedownAdvisersHere: ChoiceDomain = (state, playerId) =>
    otherPlayersAtYourSite(state, playerId).flatMap((id) =>
        facedownAdviserChoices(state.getPlayerState(id))
    )
registerEffect(INQUISITOR, powerIndexOf(INQUISITOR, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.FacedownAdviser, {
            what: 'a facedown adviser of a player at your site',
            domain: facedownAdvisersHere
        })
    ],
    hidden: (ctx) => {
        const [adviser] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        return { kind: 'facedownAdviser', playerId: adviser.playerId, index: adviser.index }
    },
    resolve: (ctx) => {
        const [adviser] = chosen(ctx, PowerChoiceKind.FacedownAdviser)
        const holder = ctx.state.getPlayerState(adviser.playerId)
        const cardId = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds[0] : undefined
        assertExists(cardId, 'Inquisitor resolves only once the host has shown the adviser')
        if (cardId === CONSPIRACY_ID) {
            // The favor given or kept shows every player which branch this is, so the Conspiracy is public.
            askQuestion(ctx.state, ctx.playerId, {
                kind: PowerQuestionKind.PlayOrDiscardConspiracy,
                cardId: INQUISITOR,
                askedPlayerId: ctx.playerId,
                holderPlayerId: holder.playerId,
                index: adviser.index
            })
            return {
                summary: `Inquisitor: ${holder.playerId}'s adviser is the Conspiracy — play it, or discard it`,
                peeked: [cardId]
            }
        }
        holder.markShown(cardId, ctx.playerId)
        holder.markNotConspiracy(cardId)
        // "Give them the favor here" — the favor the cost just placed.
        const given = Math.min(1, ctx.state.tokensOn(INQUISITOR).favor)
        ctx.state.addTokensOn(INQUISITOR, { favor: -given })
        receiveFavor(ctx.state, holder.playerId, given)
        return {
            summary: `Inquisitor: peeked at ${holder.playerId}'s adviser, not the Conspiracy; gave ${holder.playerId} ${given} favor`,
            peeked: [cardId]
        }
    }
})

// "Your enemies act as if denizens and relics at sites you rule are locked." Adviser, persistent.
const ANCIENT_BLOODLINE = 'denizen.nomad.ancient-bloodline'
registerPersistent(ANCIENT_BLOODLINE, powerIndexOf(ANCIENT_BLOODLINE, PowerTiming.Persistent), {
    locksSiteFor: (ctx, actorId, siteId) =>
        !ctx.ownerIds.includes(actorId) &&
        ctx.ownerIds.some((owner) => rulesSite(ctx.state, owner, siteId)) &&
        ctx.ownerIds.some((owner) => areEnemies(ctx.state, owner, actorId))
})

// "You may put all the cards you discard on the bottom of the world deck." Search modifier, relic.
const CRACKED_HORN = 'relic.cracked-horn'
registerModifier(CRACKED_HORN, powerIndexOf(CRACKED_HORN, PowerTiming.Modifier), {
    hooks: {
        discardTo: (ctx) => ({
            region: regionOfPawn(ctx.state, ctx.playerId),
            bottom: false,
            worldDeck: true
        })
    }
})

// "You may play [suit:beast] and [suit:hearth] cards to any site (that has space)." Search modifier.
const NEW_GROWTH = 'denizen.beast.new-growth'
registerModifier(NEW_GROWTH, powerIndexOf(NEW_GROWTH, PowerTiming.Modifier), {
    hooks: {
        playAnywhere: (ctx) => {
            const suit = ctx.particulars?.playedCardId
                ? suitOf(ctx.particulars.playedCardId)
                : undefined
            return suit === Suit.Beast || suit === Suit.Hearth
        }
    }
})

// "You may play two cards you draw (instead of one) if you play at least one card to a site." Search modifier. Cost: place 1 favor.
const LAND_WARDEN = 'denizen.hearth.land-warden'
registerModifier(LAND_WARDEN, powerIndexOf(LAND_WARDEN, PowerTiming.Modifier), {
    hooks: { secondPlay: true }
})

// "Move any warbands to and from your board and any sites you rule (except the last warband from a
//  site). At end, discard Warning Signals." Defender. Warbands to a site all go to the one site named.
const WARNING_SIGNALS = 'denizen.nomad.warning-signals'
/** R-5.5.1.a — a defender's plan, so the Campaign it is used in is under way. */
function defendedCampaignScope(state: HydratedOathGameState): ImperialScope | undefined {
    const campaign = state.campaign
    assertExists(campaign, 'Warning Signals is used by a defender, once the Campaign is mustered')
    return battleScopeOf(state, partiesOf(state, campaign))
}
const ruledSiteGroups: ChoiceDomain = (state, playerId) => {
    const scope = defendedCampaignScope(state)
    return sitesRuledBy(state, playerId, scope).flatMap((siteId) =>
        rulingWarbandOwners(state, playerId, scope)
            .map((owner) => ({ owner, free: warbandsFreeToLeave(state, playerId, siteId, owner) }))
            .filter(({ free }) => free > 0)
            .map(({ owner, free }) => ({
                kind: PowerChoiceKind.Warbands,
                group: { at: { kind: 'site' as const, siteId }, owner, count: free }
            }))
    )
}
const ruledSites: ChoiceDomain = (state, playerId) =>
    sitesRuledBy(state, playerId, defendedCampaignScope(state)).map((siteId) => ({
        kind: PowerChoiceKind.Site,
        siteId
    }))
const boardGroups: ChoiceDomain = (state, playerId) =>
    warbandEntries(state.getPlayerState(playerId).warbandsOnBoard)
        .filter(([, count]) => count > 0)
        .map(([owner, count]) => ({
            kind: PowerChoiceKind.Warbands,
            group: { at: { kind: 'board' as const, playerId }, owner, count }
        }))
registerBattlePlan(WARNING_SIGNALS, powerIndexOf(WARNING_SIGNALS, PowerTiming.BattlePlan), {
    choices: [
        optional(PowerChoiceKind.Warbands, {
            what: 'warbands at sites you rule to move to your board (never the last)',
            domain: ruledSiteGroups,
            max: 16
        }),
        optional(PowerChoiceKind.Warbands, {
            what: 'warbands on your board to move to a site',
            domain: boardGroups,
            max: 8
        }),
        optional(PowerChoiceKind.Site, {
            what: 'the site you rule they go to',
            domain: ruledSites
        })
    ],
    hooks: {
        discardAtEnd: true,
        reasonCannotUse: (ctx) => {
            const toSite = chosen(ctx, PowerChoiceKind.Warbands).some(
                ({ group }) => group.at.kind === 'board'
            )
            const [to] = chosen(ctx, PowerChoiceKind.Site)
            if (toSite && !to) return 'name the site you rule the board warbands go to'
            if (!toSite && to) return 'name the board warbands to move to that site'
            return undefined
        },
        onUse: (ctx) => {
            const groups = chosen(ctx, PowerChoiceKind.Warbands)
            const [to] = chosen(ctx, PowerChoiceKind.Site)
            const notes: string[] = []
            for (const { group } of groups) {
                assertExists(ctx.playerId, "the bandits' compelled plans declare no choices")
                const fromSite = group.at.kind === 'site' ? group.at.siteId : undefined
                const siteId = fromSite ?? to?.siteId
                if (!siteId) continue
                const move = fromSite ? moveWarbandsSiteToBoard : moveWarbandsBoardToSite
                const moved = move(ctx.state, ctx.playerId, group.owner, siteId, group.count)
                const route = fromSite
                    ? `from ${siteId} to the board`
                    : `from the board to ${siteId}`
                notes.push(`${moved} ${route}`)
            }
            return `Warning Signals: moved ${notes.join('; ') || 'nothing'}`
        }
    }
})
