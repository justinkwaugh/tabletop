import { isLockedFor } from '../util/locked.js'
import { categoryAt } from '../util/sitePowers.js'
import { Banner, Suit } from '../model/oathEnums.js'
import type { PileDeposit } from '../model/hidden.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { cardDefinition, suitOf } from '../data/cardRegistry.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import {
    registerContinuous,
    registerEffect,
    registerModifier,
    type EffectContext,
    chosen
} from './registry.js'
import { assert, assertExists } from '@tabletop/common'
import {
    denizensOnMap,
    discardDenizensAtSites,
    moveAdviserToSite,
    moveFavorBetweenBanks,
    pawnSiteId,
    regionOfPawn,
    siteHasRoom,
    takeFavorFromPlayer
} from './vocabulary.js'
import { siteHolding } from '../util/access.js'
import { nextActionIndex } from '../util/freeActions.js'
import { playerChoicesAtYourSite } from './choiceDomains.js'
import { reasonCannotTravelByPower, travelByPower } from '../util/powerTravel.js'
import { shroudedWoodChooser } from '../util/siteTravel.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'

// "Action: Move all favor from any one favor bank to the hearth bank." Cost: burn 1 secret.
registerEffect(
    'denizen.hearth.memory-of-home',
    powerIndexOf('denizen.hearth.memory-of-home', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.FavorBank, { what: 'a favor bank to empty into the hearth bank' })
        ],
        reasonCannotResolve: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            return bank.suit === Suit.Hearth
                ? 'the hearth bank cannot be emptied into itself'
                : undefined
        },
        resolve: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            const moved = moveFavorBetweenBanks(
                ctx.state,
                bank.suit,
                Suit.Hearth,
                Number.MAX_SAFE_INTEGER
            )
            return {
                summary: `Memory of Home: moved ${moved} favor from the ${bank.suit} bank to the hearth bank`
            }
        }
    }
)

// "Action: Move one of your faceup advisers to your site."
const ownFaceupDenizenAdvisers: ChoiceDomain = (state, playerId) =>
    state
        .getPlayerState(playerId)
        .faceupAdviserIds()
        .filter(
            (cardId) =>
                !isLockedFor(state, playerId, cardId) &&
                cardDefinition(cardId)?.placement !== 'adviser' &&
                suitOf(cardId) !== undefined
        )
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))

// R-11.10 — the Great Slum lets a card here be discarded before one is moved here.
const slumCardsAtYourSite: ChoiceDomain = (state, playerId) => {
    const here = pawnSiteId(state, playerId)
    if (categoryAt(state, here) !== 'greatSlum') return []
    return state.denizensAt(here).map((cardId) => ({
        kind: PowerChoiceKind.Card,
        cardId
    }))
}
registerEffect(
    'denizen.hearth.homesteaders',
    powerIndexOf('denizen.hearth.homesteaders', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Card, {
                what: 'one of your faceup advisers',
                domain: ownFaceupDenizenAdvisers
            }),
            optional(PowerChoiceKind.Card, {
                what: 'a denizen at the Great Slum to discard first',
                domain: slumCardsAtYourSite
            })
        ],
        reasonCannotResolve: (ctx) => {
            const site = pawnSiteId(ctx.state, ctx.playerId)
            const [, first] = chosen(ctx, PowerChoiceKind.Card)
            return siteHasRoom(ctx.state, site) || first
                ? undefined
                : 'your site has no room for another denizen'
        },
        resolve: (ctx) => {
            const [card, first] = chosen(ctx, PowerChoiceKind.Card)
            const site = pawnSiteId(ctx.state, ctx.playerId)
            const { discarded, pileDeposits } = first
                ? discardDenizensAtSites(
                      ctx.state,
                      ctx.playerId,
                      [site],
                      (id) => id === first.cardId,
                      ctx.power.cardId
                  )
                : { discarded: [], pileDeposits: [] }
            // R-7.2.2, R-7.1.3 — a locked card chosen to go first stays, so the site may still be full.
            if (!siteHasRoom(ctx.state, site))
                return { summary: `${card.cardId} could not be moved`, pileDeposits }
            moveAdviserToSite(ctx.state, ctx.playerId, card.cardId, site)
            return {
                summary: `Homesteaders: ${discarded.length ? `discarded ${discarded[0]} first; ` : ''}moved ${card.cardId} to ${site}`,
                pileDeposits
            }
        }
    }
)

// "Action: Discard a denizen card at any other site and move this card there." Cost: place 1 secret.
const ROVING = 'denizen.beast.roving-terror'
const denizensAtOtherSites: ChoiceDomain = (state, playerId) => {
    const here = siteHolding(state, ROVING)
    return Object.entries(state.denizensBySite)
        .filter(([siteId]) => siteId !== here && state.isSiteFaceup(siteId))
        .flatMap(([, cards]) => cards)
        .filter((id) => id !== ROVING && !isLockedFor(state, playerId, id))
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
}
// R-11.10 — a second discard at the destination, when it is the Great Slum.
const slumCardsElsewhere: ChoiceDomain = (state, playerId) =>
    state
        .allSiteIds()
        .filter((siteId) => state.isSiteFaceup(siteId) && categoryAt(state, siteId) === 'greatSlum')
        .flatMap((siteId) =>
            state
                .denizensAt(siteId)
                .filter((id) => id !== ROVING && !isLockedFor(state, playerId, id))
        )
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
registerEffect(ROVING, powerIndexOf(ROVING, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Card, {
            what: 'a denizen at another site to discard',
            domain: denizensAtOtherSites
        }),
        optional(PowerChoiceKind.Card, {
            what: 'another denizen at that Great Slum to discard first',
            domain: slumCardsElsewhere
        })
    ],
    reasonCannotResolve: (ctx) => {
        const [target, first] = chosen(ctx, PowerChoiceKind.Card)
        if (!first) return undefined
        return siteHolding(ctx.state, first.cardId) === siteHolding(ctx.state, target.cardId) &&
            first.cardId !== target.cardId
            ? undefined
            : 'the Great Slum discard must be at the destination'
    },
    resolve: (ctx) => {
        const [target, first] = chosen(ctx, PowerChoiceKind.Card)
        const pileDeposits: PileDeposit[] = []
        if (first) {
            const firstSite = siteHolding(ctx.state, first.cardId)
            assertExists(firstSite, `${first.cardId} is no longer at a site`)
            const slum = discardDenizensAtSites(
                ctx.state,
                ctx.playerId,
                [firstSite],
                (id) => id === first.cardId,
                ctx.power.cardId
            )
            pileDeposits.push(...slum.pileDeposits)
        }
        const to = siteHolding(ctx.state, target.cardId)
        assertExists(to, `${target.cardId} is a denizen at another site`)
        const from = siteHolding(ctx.state, ROVING)
        // Horned Mask can swap Roving Terror into a player's advisers, and then it has no site to leave.
        if (!from) return { summary: 'Roving Terror: nothing to move between', pileDeposits }
        const gone = discardDenizensAtSites(
            ctx.state,
            ctx.playerId,
            [to],
            (id) => id === target.cardId,
            ctx.power.cardId
        )
        pileDeposits.push(...gone.pileDeposits)
        assert(gone.discarded.length > 0, `${target.cardId} is unlocked, so it is discarded`)
        ctx.state.denizensBySite[from] = ctx.state.denizensBySite[from].filter(
            (id) => id !== ROVING
        )
        ctx.state.denizensBySite[to] = [...ctx.state.denizensAt(to), ROVING]
        return {
            pileDeposits,
            summary: `Roving Terror: discarded ${target.cardId} at ${to} and moved there from ${from}`
        }
    }
})

// "This card ignores the adviser limit. / Action: Move this card to any other
// player's advisers. Take two favor from them." Cost: place 1 secret.
const PIPER = 'denizen.beast.pied-piper'
registerContinuous(PIPER, powerIndexOf(PIPER, PowerTiming.Continuous), {
    ignoresAdviserLimit: true
})
registerEffect(PIPER, powerIndexOf(PIPER, PowerTiming.Action), {
    choices: [one(PowerChoiceKind.Player, { what: 'another player to send the Piper to' })],
    reasonCannotResolve: (ctx) =>
        ctx.state.getPlayerState(ctx.playerId).hasAdviser(PIPER)
            ? undefined
            : 'Pied Piper is not among your advisers',
    resolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Player)
        const me = ctx.state.getPlayerState(ctx.playerId)
        const them = ctx.state.getPlayerState(target.playerId)
        me.removeAdviser(PIPER)
        them.addAdviser(PIPER, true)
        const taken = takeFavorFromPlayer(ctx.state, ctx.playerId, target.playerId, 2)
        return {
            summary: `Pied Piper: moved to ${target.playerId}'s advisers and took ${taken} favor from them`
        }
    }
})

// "When played, if the People's Favor is on the Mob side, discard all other cards of the most common suit on the map.
// If there is a tie, you choose among the tied suits."
const RIOTS = 'denizen.discord.riots'
function riotSuits(ctx: EffectContext): { most: Suit[]; count: number } {
    const counts = new Map<Suit, number>()
    for (const id of denizensOnMap(ctx.state)) {
        if (id === RIOTS) continue
        const suit = suitOf(id)
        if (suit) counts.set(suit, (counts.get(suit) ?? 0) + 1)
    }
    const count = Math.max(0, ...counts.values())
    const most = [...counts.entries()].filter(([, n]) => n === count).map(([s]) => s)
    return { most, count }
}
registerEffect(RIOTS, powerIndexOf(RIOTS, PowerTiming.WhenPlayed), {
    choices: [optional(PowerChoiceKind.FavorBank, { what: 'the tied suit to riot against' })],
    reasonCannotResolve: (ctx) => {
        if (!ctx.state.isOnMobSide(Banner.PeoplesFavor)) return undefined
        const { most, count } = riotSuits(ctx)
        if (count === 0) return undefined
        const [pick] = chosen(ctx, PowerChoiceKind.FavorBank)
        if (most.length > 1 && !pick)
            return `the most common suit is tied (${most.join(', ')}); name one`
        if (pick && !most.includes(pick.suit))
            return `${pick.suit} is not the most common suit on the map (${most.join(', ')})`
        return undefined
    },
    resolve: (ctx) => {
        if (!ctx.state.isOnMobSide(Banner.PeoplesFavor))
            return { summary: "Riots: the People's Favor is not on the Mob side; nothing happens" }
        const { most, count } = riotSuits(ctx)
        if (count === 0) return { summary: 'Riots: no other cards on the map' }
        const [pick] = chosen(ctx, PowerChoiceKind.FavorBank)
        const suit = pick?.suit ?? most[0]
        assertExists(suit, 'Riots: a map with other cards has a most common suit')
        const { discarded, pileDeposits } = discardDenizensAtSites(
            ctx.state,
            ctx.playerId,
            ctx.state.faceupSiteIds(),
            (id) => id !== RIOTS && suitOf(id) === suit,
            ctx.power.cardId
        )
        return {
            summary: `Riots: discarded ${discarded.length} ${suit} cards from the map`,
            pileDeposits
        }
    }
})

// "You can only have one adviser that is not a nomad. You can have any number
// of nomad advisers — they ignore your adviser limit."
registerContinuous(
    'denizen.nomad.family-wagon',
    powerIndexOf('denizen.nomad.family-wagon', PowerTiming.Continuous),
    {
        adviserLimit: 1,
        adviserLimitExemptSuit: Suit.Nomad
    }
)

// "Move all of your favor to the nomad bank. Any favor you gain or take is put in the nomad
// bank. You can use favor in the nomad bank as if it is on your board."
registerContinuous(
    'denizen.nomad.vow-of-kinship',
    powerIndexOf('denizen.nomad.vow-of-kinship', PowerTiming.Continuous),
    { keepsFavorInBank: Suit.Nomad }
)

// "When Played, you may swap this card with a faceup nomad adviser of another player."
const TWIN = 'denizen.nomad.twin-brother'
const othersFaceupNomadAdvisers: ChoiceDomain = (state, playerId) =>
    state.players
        .filter((p) => p.playerId !== playerId)
        .flatMap((p) =>
            p
                .faceupAdviserIds()
                .filter(
                    (cardId) =>
                        suitOf(cardId) === Suit.Nomad && !isLockedFor(state, playerId, cardId)
                )
                .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
        )
registerEffect(TWIN, powerIndexOf(TWIN, PowerTiming.WhenPlayed), {
    choices: [
        optional(PowerChoiceKind.Card, {
            what: "another player's faceup nomad adviser to swap with",
            domain: othersFaceupNomadAdvisers
        })
    ],
    resolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Card)
        if (!target) return { summary: 'Twin Brother stays where it was played' }
        const me = ctx.state.getPlayerState(ctx.playerId)
        const them = ctx.state.adviserHolderOf(target.cardId)
        assertExists(them, `${target.cardId} is another player's faceup adviser`)
        assert(me.hasAdviser(TWIN), "Twin Brother resolves as one of its player's advisers")
        me.replaceAdviser(TWIN, { cardId: target.cardId, faceUp: true })
        them.replaceAdviser(target.cardId, { cardId: TWIN, faceUp: true })
        return {
            summary: `Twin Brother went to ${them.playerId}'s advisers; ${target.cardId} to yours`
        }
    }
})

// "After mustering, you may campaign, spending no Supply."
registerModifier(
    'denizen.order.knights-errant',
    powerIndexOf('denizen.order.knights-errant', PowerTiming.Modifier),
    {
        hooks: {
            after: (ctx) => {
                ctx.state.getPlayerState(ctx.playerId).freeCampaignAtAction = nextActionIndex(
                    ctx.state
                )
                return {
                    summary:
                        'Knights Errant: your next action may be a Campaign that spends no Supply'
                }
            }
        }
    }
)

// "After searching the world deck, you may campaign, spending no Supply."
// R-5.1.4 — "after searching" is the Search's resolve.
registerModifier(
    'denizen.order.hunting-party',
    powerIndexOf('denizen.order.hunting-party', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                ctx.particulars?.drawFrom === 'worldDeck'
                    ? undefined
                    : 'you are not searching the world deck',
            after: (ctx) => {
                ctx.state.getPlayerState(ctx.playerId).freeCampaignAtAction = nextActionIndex(
                    ctx.state
                )
                return {
                    summary:
                        'Hunting Party: your next action may be a Campaign that spends no Supply'
                }
            }
        }
    }
)

// "Action: Choose a player whose pawn is at your site. Put your pawn on a site that they can travel to. Make them travel to that site, spending no Supply."
// R-5.6.2 — a facedown site is revealed from the vault as they arrive.
const otherSites: ChoiceDomain = (state, playerId) => {
    const here = state.getPlayerState(playerId).siteId
    return state
        .allSiteIds()
        .filter((siteId) => siteId !== here)
        .map((siteId) => ({ kind: PowerChoiceKind.Site, siteId }))
}
registerEffect(
    'denizen.order.palanquin',
    powerIndexOf('denizen.order.palanquin', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: 'a player at your site',
                domain: playerChoicesAtYourSite
            }),
            one(PowerChoiceKind.Site, {
                what: 'a site to carry you both to',
                domain: otherSites
            })
        ],
        hidden: (ctx) => {
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            return site && !ctx.state.isSiteFaceup(site.siteId)
                ? { kind: 'siteFlip', siteId: site.siteId }
                : undefined
        },
        // "A site that they can travel to" — every restriction but the price binds them.
        reasonCannotResolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            return target && site
                ? reasonCannotTravelByPower(ctx.state, target.playerId, site.siteId)
                : undefined
        },
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [site] = chosen(ctx, PowerChoiceKind.Site)
            const chooser = shroudedWoodChooser(ctx.state, target.playerId)
            // "Put your pawn" is no travel; "make them travel" is, so its after-travel powers fire.
            ctx.state.getPlayerState(ctx.playerId).siteId = site.siteId
            // R-11.7 — leaving an enemy's Shrouded Wood, its ruler chooses where they travel.
            if (chooser !== undefined) {
                const fromSiteId = pawnSiteId(ctx.state, target.playerId)
                const note = askQuestion(ctx.state, ctx.playerId, {
                    kind: PowerQuestionKind.ShroudedWoodDestination,
                    cardId: ctx.state.siteCardAt(fromSiteId) ?? fromSiteId,
                    askedPlayerId: chooser,
                    travelerPlayerId: target.playerId,
                    fromSiteId
                })
                return {
                    summary: `Palanquin: you went to ${site.siteId}; ${note ?? `the Shrouded Wood's ruler chooses where ${target.playerId} goes`}`
                }
            }
            const { notes } = travelByPower(ctx.state, target.playerId, site.siteId)
            return {
                summary: `Palanquin: you and ${target.playerId} went to ${site.siteId}, spending no Supply${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`
            }
        }
    }
)
