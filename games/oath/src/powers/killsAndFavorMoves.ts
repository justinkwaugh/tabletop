import { bannerHolder } from '../util/oathkeeper.js'
import { spendFavor, usableFavor } from '../util/favor.js'
import { isLockedFor, reasonCannotMoveCardTo } from '../util/locked.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { gainSupply, returnFavorFromCards, returnSecretsToBoard } from '../util/rest.js'
import { ownWarbandOwner, rulersOfSite, sitesRuledBy } from '../util/rule.js'
import { cannotPlaceWarbandsAtSites } from '../util/continuous.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { registerEffect, registerModifier, chosen } from './registry.js'
import { assert, assertExists } from '@tabletop/common'
import {
    cardSuitIsOneOf,
    discardAdviser,
    discardDenizensAtSites,
    gainFavorFromBank,
    gainSecrets,
    gainWarbandsToBoard,
    killWarbandGroup,
    killWarbandsAtSite,
    killWarbandsOnBoard,
    moveFavorBetweenBanks,
    moveWarbandsBoardToSite,
    pawnSiteId,
    regionOfPawn,
    warbandGroupsInRegion,
    siteHasCardOfSuit,
    hasFaceupAdviserOfSuit,
    denizensAtYourSite
} from './vocabulary.js'
import { siteHolding } from '../util/access.js'
import { BANDIT_CHIEF } from '../util/bandits.js'

// "Action: Each player (even you) places one favor per site they rule into
// the arcane bank." (R-7.1.3: as much as each has.)
registerEffect(
    'denizen.arcane.plague-engines',
    powerIndexOf('denizen.arcane.plague-engines', PowerTiming.Action),
    {
        choices: [],
        resolve: (ctx) => {
            let placed = 0
            for (const p of ctx.state.players) {
                const owed = sitesRuledBy(ctx.state, p.playerId).length
                const paid = Math.min(owed, usableFavor(ctx.state, p.playerId))
                spendFavor(ctx.state, p.playerId, paid)
                ctx.state.favorBank[Suit.Arcane] += paid
                placed += paid
            }
            return { summary: `Plague Engines: ${placed} favor placed into the arcane bank` }
        }
    }
)

// "Action: Kill any two warbands in your region (at sites or on boards, even
// yours) if you hold the Darkest Secret."
const groupsInRegion: ChoiceDomain = (state, playerId) =>
    warbandGroupsInRegion(state, playerId).map((group) => ({
        kind: PowerChoiceKind.Warbands,
        group
    }))

registerEffect(
    'denizen.arcane.terror-spells',
    powerIndexOf('denizen.arcane.terror-spells', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Warbands, {
                what: 'warbands in your region to kill',
                domain: groupsInRegion
            }),
            optional(PowerChoiceKind.Warbands, {
                what: 'more warbands in your region to kill',
                domain: groupsInRegion
            })
        ],
        reasonCannotResolve: (ctx) => {
            if (bannerHolder(ctx.state, Banner.DarkestSecret) !== ctx.playerId)
                return 'you do not hold the Darkest Secret'
            const named = chosen(ctx, PowerChoiceKind.Warbands).reduce(
                (n, c) => n + c.group.count,
                0
            )
            const available = warbandGroupsInRegion(ctx.state, ctx.playerId).reduce(
                (n, g) => n + g.count,
                0
            )
            const required = Math.min(2, available)
            return named === required
                ? undefined
                : `Terror Spells kills two warbands: ${named} named, ${required} to kill`
        },
        resolve: (ctx) => {
            let killed = 0
            for (const c of chosen(ctx, PowerChoiceKind.Warbands))
                killed += killWarbandGroup(ctx.state, c.group)
            return {
                summary: `Terror Spells: killed ${killed} warbands in ${ctx.playerId}'s region`
            }
        }
    }
)

// "Spend no Supply and ignore the powers of sites if you're traveling to a
// site with a beast card." Cost: place 1 favor.
registerModifier(
    'denizen.beast.forest-paths',
    powerIndexOf('denizen.beast.forest-paths', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                const to = ctx.particulars?.destinationSiteId
                if (!to) return 'no destination named'
                const beast = siteHasCardOfSuit(ctx.state, to, Suit.Beast)
                return beast ? undefined : `${to} holds no beast card`
            },
            supplyCost: () => 0,
            ignoresSitePowers: true
        }
    }
)

// "You must muster on a card matching any of your advisers, but you gain one
// more warband."
registerModifier(
    'denizen.beast.vow-of-beastkin',
    powerIndexOf('denizen.beast.vow-of-beastkin', PowerTiming.Modifier),
    {
        mandatory: true,
        hooks: {
            forbids: (ctx) => {
                const cardId = ctx.particulars?.cardId
                const suit = cardId ? suitOf(cardId) : undefined
                const matches =
                    suit !== undefined && hasFaceupAdviserOfSuit(ctx.state, ctx.playerId, suit)
                return matches
                    ? undefined
                    : 'Vow of Beastkin: you must muster on a card matching one of your advisers'
            },
            musterWarbands: (base) => base + 1
        }
    }
)

// "Action: Kill one warband on the board of a player who has an order or
// discord adviser to gain one warband."
const playersWithOrderOrDiscordAdviser: ChoiceDomain = (state) =>
    state.players
        .filter((p) =>
            p
                .faceupAdviserIds()
                .some((cardId) => cardSuitIsOneOf(cardId, [Suit.Order, Suit.Discord]))
        )
        .map((p) => ({ kind: PowerChoiceKind.Player, playerId: p.playerId }))

registerEffect(
    'denizen.beast.second-chance',
    powerIndexOf('denizen.beast.second-chance', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: 'a player with an order or discord adviser',
                domain: playersWithOrderOrDiscordAdviser
            })
        ],
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const { killed } = killWarbandsOnBoard(ctx.state, target.playerId, 1)
            if (!killed)
                return {
                    summary: `${target.playerId}'s board held no warband; nothing gained`,
                    targetPlayerId: target.playerId
                }
            const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, 1)
            return {
                summary: `killed a warband on ${target.playerId}'s board and gained ${gained}`,
                targetPlayerId: target.playerId
            }
        }
    }
)

// "When played, kill one warband at each site. While Bandit Chief is faceup,
// each site has two more bandits." The second sentence is `util/bandits.ts`.
registerEffect(BANDIT_CHIEF, powerIndexOf(BANDIT_CHIEF, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        let killed = 0
        for (const siteId of ctx.state.faceupSiteIds()) {
            killed += Object.values(killWarbandsAtSite(ctx.state, siteId, 1)).reduce(
                (n, k) => n + k,
                0
            )
        }
        return {
            summary: `Bandit Chief: killed ${killed} warbands, one per site; the bandits are three per site while it is faceup`
        }
    }
})

// "Action: Swap this card with any faceup adviser." Cost: burn 1 secret.
const ENCHANTRESS = 'denizen.discord.enchantress'
// R-7.2.1, R-7.2.2 — the adviser goes where Enchantress was.
const faceupAdvisersOfAnyone: ChoiceDomain = (state, playerId) => {
    const to = siteHolding(state, ENCHANTRESS) ? 'site' : 'advisers'
    return state.players.flatMap((p) =>
        p
            .faceupAdviserIds()
            .filter(
                (cardId) =>
                    cardId !== ENCHANTRESS &&
                    reasonCannotMoveCardTo(state, playerId, cardId, to) === undefined
            )
            .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
    )
}

registerEffect(ENCHANTRESS, powerIndexOf(ENCHANTRESS, PowerTiming.Action), {
    choices: [
        one(PowerChoiceKind.Card, {
            what: 'a faceup adviser to swap with',
            domain: faceupAdvisersOfAnyone
        })
    ],
    resolve: (ctx) => {
        const [target] = chosen(ctx, PowerChoiceKind.Card)
        const owner = ctx.state.adviserHolderOf(target.cardId)
        assertExists(owner, `${target.cardId} is a faceup adviser`)
        const site = siteHolding(ctx.state, ENCHANTRESS)
        if (site) {
            ctx.state.denizensBySite[site] = ctx.state.denizensBySite[site].map((id) =>
                id === ENCHANTRESS ? target.cardId : id
            )
            owner.replaceAdviser(target.cardId, { cardId: ENCHANTRESS, faceUp: true })
            return {
                summary: `Enchantress went to ${owner.playerId}'s advisers; ${target.cardId} to ${site}`,
                targetPlayerId: owner.playerId
            }
        }
        const holder = ctx.state.adviserHolderOf(ENCHANTRESS)
        assertExists(holder, 'Enchantress is used from a site or as an adviser')
        holder.replaceAdviser(ENCHANTRESS, { cardId: target.cardId, faceUp: true })
        owner.replaceAdviser(target.cardId, { cardId: ENCHANTRESS, faceUp: true })
        return {
            summary: `Enchantress went to ${owner.playerId}'s advisers; ${target.cardId} to ${holder.playerId}'s advisers`,
            targetPlayerId: owner.playerId
        }
    }
})

// "When played, if the ruler's pawn is not at this site, kill any warbands at
// this site, then gain a warband and place it here."
const KEY = 'denizen.discord.key-to-the-city'
registerEffect(KEY, powerIndexOf(KEY, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        const site = siteHolding(ctx.state, KEY)
        if (!site) return { summary: 'Key to the City: played as an adviser, so nothing happens' }
        const rulerHere = rulersOfSite(ctx.state, site).some(
            (id) => ctx.state.getPlayerState(id).siteId === site
        )
        if (rulerHere)
            return { summary: `Key to the City: the ruler's pawn is at ${site}; nothing happens` }
        const killed = Object.values(
            killWarbandsAtSite(ctx.state, site, Number.MAX_SAFE_INTEGER)
        ).reduce((n, k) => n + k, 0)
        const gained = gainWarbandsToBoard(ctx.state, ctx.playerId, 1)
        if (cannotPlaceWarbandsAtSites(ctx.state, ctx.playerId)) {
            return {
                summary: `Key to the City: killed ${killed} at ${site}, gained ${gained}; placed none — ${ctx.playerId} cannot place warbands at sites`
            }
        }
        const own = ownWarbandOwner(ctx.state, ctx.playerId)
        const placed = moveWarbandsBoardToSite(ctx.state, ctx.playerId, own, site, gained)
        return {
            summary: `Key to the City: killed ${killed} at ${site}, gained ${gained} and placed ${placed} there`
        }
    }
})

// "Action: Return all favor and secrets, and flip your secrets, as in the Rest
// Phase, except for the favor here." (R-4.3.1, R-4.3.2.)
const ALE = 'denizen.hearth.a-round-of-ale'
registerEffect(ALE, powerIndexOf(ALE, PowerTiming.Action), {
    choices: [],
    resolve: (ctx) => {
        const keep = ctx.state.tokensOn(ALE).favor
        const favor = returnFavorFromCards(ctx.state) - keep
        if (keep > 0) {
            // R-4.3.1 sent this card's favor to the hearth bank; the card keeps it.
            ctx.state.favorBank[Suit.Hearth] -= keep
            ctx.state.addTokensOn(ALE, { favor: keep })
        }
        const secrets = returnSecretsToBoard(ctx.state, ctx.playerId)
        return {
            summary: `A Round of Ale: returned ${favor} favor to the banks and ${secrets} secrets to ${ctx.playerId}'s board`
        }
    }
})

// "Action: Discard a faceup adviser from a player who holds the Darkest
// Secret but not the People's Favor."
const darkHolders: ChoiceDomain = (state) =>
    state.players
        .filter((p) => bannerHolder(state, Banner.DarkestSecret) === p.playerId)
        .filter((p) => bannerHolder(state, Banner.PeoplesFavor) !== p.playerId)
        .map((p) => ({ kind: PowerChoiceKind.Player, playerId: p.playerId }))

registerEffect(
    'denizen.hearth.armed-mob',
    powerIndexOf('denizen.hearth.armed-mob', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Player, {
                what: "a player holding the Darkest Secret but not the People's Favor",
                domain: darkHolders
            }),
            one(PowerChoiceKind.Card, {
                what: "one of that player's faceup advisers",
                // R-7.2.2 — a locked adviser cannot be discarded.
                domain: (state, playerId, power) =>
                    darkHolders(state, playerId, power).flatMap((c) =>
                        c.kind === PowerChoiceKind.Player
                            ? state
                                  .getPlayerState(c.playerId)
                                  .faceupAdviserIds()
                                  .filter((cardId) => !isLockedFor(state, playerId, cardId))
                                  .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
                            : []
                    )
            })
        ],
        reasonCannotResolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [card] = chosen(ctx, PowerChoiceKind.Card)
            const holds = ctx.state.getPlayerState(target.playerId).isFaceupAdviser(card.cardId)
            return holds
                ? undefined
                : `${card.cardId} is not a faceup adviser of ${target.playerId}`
        },
        resolve: (ctx) => {
            const [target] = chosen(ctx, PowerChoiceKind.Player)
            const [card] = chosen(ctx, PowerChoiceKind.Card)
            return {
                summary: `Armed Mob: discarded ${target.playerId}'s adviser ${card.cardId}`,
                targetPlayerId: target.playerId,
                pileDeposits: discardAdviser(
                    ctx.state,
                    ctx.playerId,
                    target.playerId,
                    card.cardId,
                    regionOfPawn(ctx.state, ctx.playerId)
                )
            }
        }
    }
)

// "Action: Move two favor from the favor bank with the most favor to that
// with the least favor. You decide ties."
registerEffect(
    'denizen.hearth.levelers',
    powerIndexOf('denizen.hearth.levelers', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.FavorBank, { what: 'the bank with the most favor' }),
            one(PowerChoiceKind.FavorBank, { what: 'the bank with the least favor' })
        ],
        reasonCannotResolve: (ctx) => {
            const [from, to] = chosen(ctx, PowerChoiceKind.FavorBank)
            const banks = ctx.state.favorBank
            const most = Math.max(...Object.values(banks))
            const least = Math.min(...Object.values(banks))
            if (banks[from.suit] !== most)
                return `the ${from.suit} bank (${banks[from.suit]}) does not have the most favor (${most})`
            if (banks[to.suit] !== least)
                return `the ${to.suit} bank (${banks[to.suit]}) does not have the least favor (${least})`
            if (from.suit === to.suit) return 'the two banks must differ'
            return undefined
        },
        resolve: (ctx) => {
            const [from, to] = chosen(ctx, PowerChoiceKind.FavorBank)
            const moved = moveFavorBetweenBanks(ctx.state, from.suit, to.suit, 2)
            return {
                summary: `Levelers: moved ${moved} favor from the ${from.suit} bank to the ${to.suit} bank`
            }
        }
    }
)

// "Spend no Supply." Cost: place 2 favor.
registerModifier(
    'denizen.hearth.news-from-afar',
    powerIndexOf('denizen.hearth.news-from-afar', PowerTiming.Modifier),
    {
        hooks: { supplyCost: () => 0 }
    }
)

// "Action: Sacrifice an even number of warbands on your board. For every two
// you sacrifice, gain a secret."
registerEffect(
    'denizen.arcane.blood-pact',
    powerIndexOf('denizen.arcane.blood-pact', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Warbands, { what: 'an even number of warbands on your board' })
        ],
        reasonCannotResolve: (ctx) => {
            const [c] = chosen(ctx, PowerChoiceKind.Warbands)
            if (c.group.at.kind !== 'board' || c.group.at.playerId !== ctx.playerId)
                return 'the warbands must be on your board'
            if (c.group.count < 2 || c.group.count % 2 !== 0)
                return `sacrifice an even number of warbands, not ${c.group.count}`
            return undefined
        },
        resolve: (ctx) => {
            const [c] = chosen(ctx, PowerChoiceKind.Warbands)
            const killed = killWarbandGroup(ctx.state, c.group)
            const secrets = gainSecrets(ctx.state, ctx.playerId, Math.floor(killed / 2))
            return { summary: `Blood Pact: sacrificed ${killed} warbands for ${secrets} secrets` }
        }
    }
)

// "Action: Discard a beast or nomad card at your site to gain two favor from
// the matching favor bank."
const tameable: ChoiceDomain = (state, playerId) => {
    return denizensAtYourSite(state, playerId)
        .filter(
            (id) =>
                cardSuitIsOneOf(id, [Suit.Beast, Suit.Nomad]) && !isLockedFor(state, playerId, id)
        )
        .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
}
registerEffect(
    'denizen.arcane.taming-charm',
    powerIndexOf('denizen.arcane.taming-charm', PowerTiming.Action),
    {
        choices: [
            one(PowerChoiceKind.Card, {
                what: 'a beast or nomad card at your site',
                domain: tameable
            })
        ],
        resolve: (ctx) => {
            const [card] = chosen(ctx, PowerChoiceKind.Card)
            const site = pawnSiteId(ctx.state, ctx.playerId)
            const { discarded, pileDeposits } = discardDenizensAtSites(
                ctx.state,
                ctx.playerId,
                [site],
                (id) => id === card.cardId,
                ctx.power.cardId
            )
            assert(discarded.length > 0, `${card.cardId} is unlocked, so it is discarded`)
            const suit = suitOf(card.cardId)
            assertExists(suit, `${card.cardId} prints no suit to match a favor bank`)
            const gained = gainFavorFromBank(ctx.state, ctx.playerId, suit, 2)
            return {
                summary: `Taming Charm: discarded ${card.cardId} and gained ${gained} favor`,
                pileDeposits
            }
        }
    }
)

// "After you recover a relic, gain 3 Supply." Mandatory: a Recover takes no declaration.
registerModifier(
    'denizen.nomad.relic-worship',
    powerIndexOf('denizen.nomad.relic-worship', PowerTiming.Modifier),
    {
        mandatory: true,
        hooks: {
            after: (ctx) => {
                if (!ctx.particulars?.cardId) return undefined
                return {
                    summary: `Relic Worship: gained ${gainSupply(ctx.state, ctx.playerId, 3)} Supply`
                }
            }
        }
    }
)
