import { isLockedFor, ownCardLockedFor } from '../util/locked.js'
import { assert } from '@tabletop/common'
import { Suit } from '../model/oathEnums.js'
import type { HydratedOathGameState } from '../model/gameState.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { gainSupply } from '../util/rest.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { registerEffect, chosen, type PlayMapChanges } from './registry.js'
import { sitesRuledBy } from '../util/rule.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'
import { persistentMatchingAdvisers } from '../util/persistent.js'
import {
    burnSecretsFromDarkestSecret,
    denizensOnMap,
    denizensToDiscardAtSites,
    discardDenizensAtSites,
    faceupSitesInYourRegion,
    favorObtainableFromPicks,
    gainFavorFromBank,
    gainedWarbandsWords,
    gainWarbandsToBoard,
    moveWarbandsBoardToSite,
    regionOfPawn,
    pawnSiteId,
    ruledCardsOfSuit,
    swapPlayedCardWithSiteCard,
    takeFavorFromPlayer,
    warbandOwnerGainedByPower
} from './vocabulary.js'

// "When played, gain [favor][favor][favor]—one each from three different favor banks."
registerEffect(
    'denizen.hearth.salad-days',
    powerIndexOf('denizen.hearth.salad-days', PowerTiming.WhenPlayed),
    {
        choices: Array.from({ length: 3 }, () =>
            one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })
        ),
        reasonCannotResolve: (ctx) => {
            const suits = chosen(ctx, PowerChoiceKind.FavorBank).map((b) => b.suit)
            if (new Set(suits).size !== suits.length)
                return 'the three favor banks must be different'
            if (!isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes4)) return undefined
            // R-7.3.3 — judged on the banks the play leaves: its site favor and Homeland taken, the favor on a card
            // it discards given back. Before revision 16, on the banks before the play.
            const banks =
                (isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes12)
                    ? ctx.mapChanges?.gains?.favorBank
                    : undefined) ?? ctx.state.favorBank
            // R-7.1.3 — a favor from each of three banks that hold favor, or from every one that does.
            const holding = Object.values(banks).filter((n) => n > 0).length
            const required = Math.min(3, holding)
            const obtainable = favorObtainableFromPicks(banks, suits)
            return obtainable < required
                ? `Salad Days gains a favor from each of three banks: the banks named yield ${obtainable}, and ${required} can be had`
                : undefined
        },
        resolve: (ctx) => {
            let gained = 0
            for (const bank of chosen(ctx, PowerChoiceKind.FavorBank)) {
                gained += gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, 1)
            }
            return { summary: `gained ${gained} favor, one from each chosen bank` }
        }
    }
)

// "When played, take X[favor] equal to the number of [suit:hearth] cards you
// rule (including Fabled Feast), from any one favor bank."
registerEffect(
    'denizen.hearth.fabled-feast',
    powerIndexOf('denizen.hearth.fabled-feast', PowerTiming.WhenPlayed),
    {
        choices: [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })],
        resolve: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            // "(including Fabled Feast)": counted as one of the hearth cards you rule, an adviser or at a site
            // you rule. Before revision 10 it also counted itself at a site you do not rule.
            const ruled = ruledCardsOfSuit(ctx.state, ctx.playerId, Suit.Hearth)
            const cards =
                isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes6) ||
                ruled.includes('denizen.hearth.fabled-feast')
                    ? ruled.length
                    : ruled.length + 1
            // R-2.2.2-H1 — from revision 16 Marriage, "two hearth advisers", is two hearth cards you
            // rule, as Trade, the Conspiracy and Military Parade count it.
            const x = isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes12)
                ? cards + persistentMatchingAdvisers(ctx.state, ctx.playerId, Suit.Hearth)
                : cards
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, x)
            return {
                summary: `took ${gained} favor (of ${x} hearth cards ruled) from the ${bank.suit} bank`
            }
        }
    }
)

/**
 * Dazzle, Threatening Roar — "discard all [suit] and [suit] cards at sites in your region": the cards it discards
 * are the ones its play leaves there, so Land Warden's second card sees them gone.
 */
function registerRegionDiscard(cardId: string, suits: readonly [Suit, Suit]): void {
    const matches = (id: string) => suits.some((suit) => suitOf(id) === suit)
    registerEffect(cardId, powerIndexOf(cardId, PowerTiming.WhenPlayed), {
        choices: [],
        mapLeaving: (ctx) =>
            denizensToDiscardAtSites(
                ctx.state,
                ctx.playerId,
                faceupSitesInYourRegion(ctx.state, ctx.playerId),
                matches,
                ctx.mapChanges
            ),
        resolve: (ctx) => {
            const { discarded, pileDeposits } = discardDenizensAtSites(
                ctx.state,
                ctx.playerId,
                faceupSitesInYourRegion(ctx.state, ctx.playerId),
                matches,
                ctx.power.cardId
            )
            return {
                summary: `discarded ${discarded.length} ${suits[0]} and ${suits[1]} cards in the region`,
                pileDeposits
            }
        }
    })
}

// "When played, discard all [suit:hearth] and [suit:order] cards at sites in your region."
registerRegionDiscard('denizen.arcane.dazzle', [Suit.Hearth, Suit.Order])

// "When played, gain warbands equal to the total number of [suit:beast] cards
// (including Animal Host) at any sites (regardless of rule)."
registerEffect(
    'denizen.beast.animal-host',
    powerIndexOf('denizen.beast.animal-host', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const onMap = denizensOnMap(ctx.state, Suit.Beast)
            // "(including Animal Host) at any sites": counted when played to a site, not as an adviser.
            // Before revision 10 it also counted itself as an adviser.
            const x =
                isAtLeastOathRevision(ctx.state, OathRevision.EngineFixes6) ||
                onMap.includes('denizen.beast.animal-host')
                    ? onMap.length
                    : onMap.length + 1
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, x)
            const words =
                gainedWarbandsWords(ctx.state, ctx.playerId, gained) ?? `${gained} warbands`
            return { summary: `gained ${words} (${x} beast cards at sites)` }
        }
    }
)

// "When played, discard all [suit:nomad] and [suit:beast] cards at sites in your
// region." R-9.1, read literally: played to a site in your region it discards itself.
registerRegionDiscard('denizen.beast.threatening-roar', [Suit.Nomad, Suit.Beast])

// "When played, gain four warbands."
registerEffect(
    'denizen.discord.a-small-favor',
    powerIndexOf('denizen.discord.a-small-favor', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, 4)
            const words =
                gainedWarbandsWords(ctx.state, ctx.playerId, gained) ?? `${gained} warbands`
            return { summary: `gained ${words}` }
        }
    }
)

// "When played, burn all [secret] but one from the Darkest Secret."
registerEffect(
    'denizen.discord.charlatan',
    powerIndexOf('denizen.discord.charlatan', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const burned = burnSecretsFromDarkestSecret(ctx.state, Number.MAX_SAFE_INTEGER)
            return { summary: `burned ${burned} secrets from the Darkest Secret, leaving one` }
        }
    }
)

// "When Played, gain 4 Supply."
registerEffect(
    'denizen.nomad.faithful-friend',
    powerIndexOf('denizen.nomad.faithful-friend', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => ({ summary: `gained ${gainSupply(ctx.state, ctx.playerId, 4)} Supply` })
    }
)

// "When Played, you may swap Great Herd with a [suit:nomad] card at any site."
const GREAT_HERD = 'denizen.nomad.great-herd'
const nomadCardsAtSites: ChoiceDomain = (state, playerId) =>
    denizensOnMap(state, Suit.Nomad)
        .filter((id) => id !== GREAT_HERD && !isLockedFor(state, playerId, id))
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))

/**
 * R-7.2.2 — Great Herd's Q&A: "A locked card cannot be discarded, moved or swapped". It is still in hand when the play
 * is judged, so its lock is read at the site it is played to (from revision 16).
 */
function herdLockedWherePlayed(
    state: HydratedOathGameState,
    playerId: string,
    mapChanges: PlayMapChanges | undefined
): string | undefined {
    const siteId = mapChanges?.siteId
    return siteId !== undefined && ownCardLockedFor(state, playerId, GREAT_HERD, siteId)
        ? siteId
        : undefined
}

registerEffect(GREAT_HERD, powerIndexOf(GREAT_HERD, PowerTiming.WhenPlayed), {
    choices: [
        optional(PowerChoiceKind.Card, {
            what: 'a Nomad card at a site to swap with',
            domain: nomadCardsAtSites,
            offered: (state, playerId, mapChanges) =>
                herdLockedWherePlayed(state, playerId, mapChanges) === undefined
        })
    ],
    reasonCannotResolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Card)
        if (!target) return undefined
        // R-5.1.4.I, R-11.10 — the domain reads the map before the play; a card the play discards first is no
        // longer at a site when Great Herd resolves.
        if (ctx.mapChanges?.leaving.includes(target.cardId))
            return `${target.cardId} is discarded before Great Herd is played, so it is no longer at a site`
        const lockedAt = herdLockedWherePlayed(ctx.state, ctx.playerId, ctx.mapChanges)
        return lockedAt !== undefined
            ? `Great Herd is locked at ${lockedAt} once played there, so it cannot be swapped`
            : undefined
    },
    resolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Card)
        if (!target) return { summary: 'kept Great Herd where it was played' }
        // Where it now stands, its lock is exact; the check above refused the swap on the site it was played to.
        assert(
            !ownCardLockedFor(ctx.state, ctx.playerId, GREAT_HERD),
            'Great Herd is locked where it was played, so it cannot be swapped'
        )
        // R-10.25 — with the Nomad card at its own site, the two swap to the same place: nothing moves.
        return swapPlayedCardWithSiteCard(ctx.state, ctx.playerId, GREAT_HERD, target.cardId)
            ? { summary: `swapped Great Herd with ${target.cardId}` }
            : {
                  summary: `kept Great Herd where it was played, at the same site as ${target.cardId}`
              }
    }
})

// "When played, gain one warband per site you rule, and put one warband from
// your board on each site you rule."
registerEffect(
    'denizen.order.garrison',
    powerIndexOf('denizen.order.garrison', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const ruled = sitesRuledBy(ctx.state, ctx.playerId)
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, ruled.length)
            const owner = warbandOwnerGainedByPower(ctx.state, ctx.playerId)
            const words =
                gainedWarbandsWords(ctx.state, ctx.playerId, gained) ?? `${gained} warbands`
            // Ring of Devotion: "You cannot place warbands at sites" (R-9.2).
            if (cannotPlaceWarbandsAtSites(ctx.state, ctx.playerId)) {
                return {
                    summary: `gained ${words}; placed none — ${ctx.playerId} cannot place warbands at sites`
                }
            }
            let placed = 0
            for (const siteId of ruled) {
                placed += moveWarbandsBoardToSite(ctx.state, ctx.playerId, owner, siteId, 1)
            }
            return {
                summary: `gained ${words} and placed ${placed} across ${ruled.length} ruled sites`
            }
        }
    }
)

// "When played, take [favor][favor] from each player whose pawn is at a site
// you rule in your pawn's region."
registerEffect(
    'denizen.order.royal-tax',
    powerIndexOf('denizen.order.royal-tax', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const region = regionOfPawn(ctx.state, ctx.playerId)
            const ruledHere = new Set(
                sitesRuledBy(ctx.state, ctx.playerId).filter(
                    (s) => ctx.state.regionOf(s) === region
                )
            )
            let taken = 0
            for (const p of ctx.state.players) {
                if (p.playerId === ctx.playerId) continue
                if (!ruledHere.has(pawnSiteId(ctx.state, p.playerId))) continue
                taken += takeFavorFromPlayer(ctx.state, ctx.playerId, p.playerId, 2)
            }
            return {
                summary: `taxed ${taken} favor from players at ${ctx.playerId}'s ruled sites in the region`
            }
        }
    }
)
