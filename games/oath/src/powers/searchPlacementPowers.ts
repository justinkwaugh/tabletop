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
    type ChoiceDomain,
    type PowerChoice
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
import type { WarbandGroup } from '../model/campaign.js'
import { ANY_WARBANDS_MOVES } from './choiceDomains.js'

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
//  site). At end, discard Warning Signals." Defender. Messenger's text, so Messenger's moves: each
//  warbands, then the site they go to (none: from a site, to the board), each read on the state the
//  moves before it leave.
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
/** The board first, as Messenger offers it. */
const warningSignalsSources: ChoiceDomain = (state, playerId, power) => [
    ...boardGroups(state, playerId, power),
    ...ruledSiteGroups(state, playerId, power)
]
registerBattlePlan(WARNING_SIGNALS, powerIndexOf(WARNING_SIGNALS, PowerTiming.BattlePlan), {
    choices: Array.from({ length: ANY_WARBANDS_MOVES }, () => [
        optional(PowerChoiceKind.Warbands, {
            what: 'warbands to move',
            domain: warningSignalsSources,
            sequential: true
        }),
        optional(PowerChoiceKind.Site, {
            what: 'a site you rule to move them to',
            domain: ruledSites,
            sequential: true
        })
    ]).flat(),
    stateAfter: (ctx) => warningSignalsOnCopy(ctx.state, ctx.playerId, ctx.choices).state,
    hooks: {
        discardAtEnd: true,
        reasonCannotUse: (ctx) => warningSignalsOnCopy(ctx.state, ctx.playerId, ctx.choices).reason,
        onUse: (ctx) => {
            const { playerId, choices } = ctx
            const notes: string[] = []
            if (choices.length > 0) {
                assertExists(playerId, "the bandits' compelled plans declare no choices")
                notes.push(...applyWarningSignals(ctx.state, playerId, choices, false).notes)
            }
            return `Warning Signals: ${playerId} moved ${notes.join('; ') || 'nothing'}`
        }
    }
})

/**
 * Each warbands choice and the site after it. A use recorded before the moves were paired named
 * its board warbands together, then the one site they all went to: so a board group with no site
 * of its own goes where the board groups after it go.
 */
function warningSignalsMoves(
    choices: readonly PowerChoice[]
): { group: WarbandGroup; to: string | undefined }[] {
    return choices.flatMap((choice, i) => {
        if (choice.kind !== PowerChoiceKind.Warbands) return []
        let next = i + 1
        if (choice.group.at.kind === 'board') {
            while (isBoardGroup(choices[next])) next += 1
        }
        const after = choices[next]
        return [
            {
                group: choice.group,
                to: after?.kind === PowerChoiceKind.Site ? after.siteId : undefined
            }
        ]
    })
}

function isBoardGroup(choice: PowerChoice | undefined): boolean {
    return choice?.kind === PowerChoiceKind.Warbands && choice.group.at.kind === 'board'
}

function warningSignalsOnCopy(
    state: HydratedOathGameState,
    playerId: string,
    choices: readonly PowerChoice[]
): { state: HydratedOathGameState; reason?: string } {
    const copy = new HydratedOathGameState(state.dehydrate())
    return { state: copy, reason: applyWarningSignals(copy, playerId, choices, true).reason }
}

/**
 * R-6.5 with the card's text — the moves in turn. Checked (the declaration, on a copy): refused at
 * the first move the rules or the warbands there do not allow. Unchecked (the plan's use, as it
 * always was): each move moves what it can.
 */
function applyWarningSignals(
    state: HydratedOathGameState,
    playerId: string,
    choices: readonly PowerChoice[],
    checked: boolean
): { reason?: string; notes: string[] } {
    const scope = defendedCampaignScope(state)
    const notes: string[] = []
    const refused = (reason: string) => ({ reason, notes })
    for (const { group, to } of warningSignalsMoves(choices)) {
        const { at, owner, count } = group
        if (checked && to !== undefined && !rulesSite(state, playerId, to, scope)) {
            return refused(`you do not rule ${to}`)
        }
        if (at.kind === 'board') {
            if (to === undefined) {
                if (checked)
                    return refused('warbands on your board need a site you rule to move to')
                continue
            }
            const moved = moveWarbandsBoardToSite(state, playerId, owner, to, count)
            if (checked && moved < count) {
                return refused(`only ${moved} of those warbands on your board to move`)
            }
            notes.push(`${moved} from the board to ${to}`)
            continue
        }
        if (checked && !rulesSite(state, playerId, at.siteId, scope)) {
            return refused(`you do not rule ${at.siteId}`)
        }
        const lifted = moveWarbandsSiteToBoard(state, playerId, owner, at.siteId, count)
        if (checked && lifted < count) {
            return refused(
                `only ${lifted} of those warbands may leave ${at.siteId} (the last must stay)`
            )
        }
        if (to === undefined) {
            notes.push(`${lifted} from ${at.siteId} to the board`)
            continue
        }
        moveWarbandsBoardToSite(state, playerId, owner, to, lifted)
        notes.push(`${lifted} from ${at.siteId} to ${to}`)
    }
    return { notes }
}
