import { isLockedFor } from '../util/locked.js'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { gainSupply } from '../util/rest.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { registerEffect, chosen } from './registry.js'
import { ownWarbandOwner, sitesRuledBy } from '../util/rule.js'
import {
    burnSecretsFromDarkestSecret,
    denizensOnMap,
    discardDenizensAtSites,
    faceupSitesInYourRegion,
    gainFavorFromBank,
    gainWarbandsToBoard,
    moveWarbandsBoardToSite,
    regionOfPawn,
    pawnSiteId,
    ruledCardsOfSuit,
    swapPlayedCardWithSiteCard,
    takeFavorFromPlayer
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
            return new Set(suits).size === suits.length
                ? undefined
                : 'the three favor banks must be different'
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
            // "(including Fabled Feast)": counted even when played to a site you do not rule.
            const ruled = ruledCardsOfSuit(ctx.state, ctx.playerId, Suit.Hearth)
            const x = ruled.includes('denizen.hearth.fabled-feast')
                ? ruled.length
                : ruled.length + 1
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, x)
            return {
                summary: `took ${gained} favor (of ${x} hearth cards ruled) from the ${bank.suit} bank`
            }
        }
    }
)

// "When played, discard all [suit:hearth] and [suit:order] cards at sites in your region."
registerEffect(
    'denizen.arcane.dazzle',
    powerIndexOf('denizen.arcane.dazzle', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const { discarded, pileDeposits } = discardDenizensAtSites(
                ctx.state,
                ctx.playerId,
                faceupSitesInYourRegion(ctx.state, ctx.playerId),
                (id) => suitOf(id) === Suit.Hearth || suitOf(id) === Suit.Order,
                ctx.power.cardId
            )
            return {
                summary: `discarded ${discarded.length} hearth and order cards in the region`,
                pileDeposits
            }
        }
    }
)

// "When played, gain warbands equal to the total number of [suit:beast] cards
// (including Animal Host) at any sites (regardless of rule)."
registerEffect(
    'denizen.beast.animal-host',
    powerIndexOf('denizen.beast.animal-host', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const onMap = denizensOnMap(ctx.state, Suit.Beast)
            // Played as an adviser it is not "at a site"; the card still counts itself.
            const x = onMap.includes('denizen.beast.animal-host') ? onMap.length : onMap.length + 1
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, x)
            return { summary: `gained ${gained} warbands (${x} beast cards at sites)` }
        }
    }
)

// "When played, discard all [suit:nomad] and [suit:beast] cards at sites in your
// region." R-9.1, read literally: played to a site in your region it discards itself.
registerEffect(
    'denizen.beast.threatening-roar',
    powerIndexOf('denizen.beast.threatening-roar', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => {
            const { discarded, pileDeposits } = discardDenizensAtSites(
                ctx.state,
                ctx.playerId,
                faceupSitesInYourRegion(ctx.state, ctx.playerId),
                (id) => suitOf(id) === Suit.Nomad || suitOf(id) === Suit.Beast,
                ctx.power.cardId
            )
            return {
                summary: `discarded ${discarded.length} nomad and beast cards in the region`,
                pileDeposits
            }
        }
    }
)

// "When played, gain four warbands."
registerEffect(
    'denizen.discord.a-small-favor',
    powerIndexOf('denizen.discord.a-small-favor', PowerTiming.WhenPlayed),
    {
        choices: [],
        resolve: (ctx) => ({
            summary: `gained ${gainWarbandsToBoard(ctx.state, ctx.playerId, 4)} warbands`
        })
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
const nomadCardsAtSites: ChoiceDomain = (state, playerId) =>
    denizensOnMap(state, Suit.Nomad)
        .filter((id) => id !== 'denizen.nomad.great-herd' && !isLockedFor(state, playerId, id))
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))

registerEffect(
    'denizen.nomad.great-herd',
    powerIndexOf('denizen.nomad.great-herd', PowerTiming.WhenPlayed),
    {
        choices: [
            optional(PowerChoiceKind.Card, {
                what: 'a Nomad card at a site to swap with',
                domain: nomadCardsAtSites
            })
        ],
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Card)
            if (!target) return { summary: 'kept Great Herd where it was played' }
            swapPlayedCardWithSiteCard(
                ctx.state,
                ctx.playerId,
                'denizen.nomad.great-herd',
                target.cardId
            )
            return { summary: `swapped Great Herd with ${target.cardId}` }
        }
    }
)

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
            const own = ownWarbandOwner(ctx.state, ctx.playerId)
            // Ring of Devotion: "You cannot place warbands at sites" (R-9.2).
            if (cannotPlaceWarbandsAtSites(ctx.state, ctx.playerId)) {
                return {
                    summary: `gained ${gained} warbands; placed none — ${ctx.playerId} cannot place warbands at sites`
                }
            }
            let placed = 0
            for (const siteId of ruled) {
                placed += moveWarbandsBoardToSite(ctx.state, ctx.playerId, own, siteId, 1)
            }
            return {
                summary: `gained ${gained} warbands and placed ${placed} across ${ruled.length} ruled sites`
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
