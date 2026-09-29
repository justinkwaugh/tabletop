import { assertExists } from '@tabletop/common'
import { Suit, CardKind } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { kindOf, suitOf } from '../data/cardRegistry.js'
import { warbandsOnBoardOf } from '../util/force.js'
import { gainSupply } from '../util/rest.js'
import { totalWarbandsAt } from '../util/rule.js'
import { registerModifier, type EffectContext } from './registry.js'
import {
    gainFavorFromBank,
    gainWarbandsToBoard,
    killWarbandsAtSite,
    killWarbandsOnBoard,
    hasFaceupAdviserOfSuit,
    regionOfPawn
} from './vocabulary.js'
import { siteHolding } from '../util/access.js'

function player(ctx: EffectContext) {
    return ctx.state.getPlayerState(ctx.playerId)
}

const waive = () => 0

// "Spend no Supply if you're traveling to a site in your region." Cost: place 1 favor.
registerModifier('denizen.nomad.tents', powerIndexOf('denizen.nomad.tents', PowerTiming.Modifier), {
    hooks: {
        condition: (ctx) => {
            const to = ctx.particulars?.destinationSiteId
            assertExists(to, 'Tents applies to a Travel, which always names a destination')
            return regionOfPawn(ctx.state, ctx.playerId) === ctx.state.regionOf(to)
                ? undefined
                : `${to} is not in your region`
        },
        supplyCost: waive
    }
})

// "Spend no Supply if you have three or fewer warbands on your board." Cost: place 1 favor.
registerModifier(
    'denizen.nomad.a-fast-steed',
    powerIndexOf('denizen.nomad.a-fast-steed', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                const n = warbandsOnBoardOf(ctx.state, ctx.playerId)
                return n <= 3 ? undefined : `you have ${n} warbands on your board, more than three`
            },
            supplyCost: waive
        }
    }
)

// "Spend no Supply. After traveling, end your Act Phase."
registerModifier(
    'denizen.nomad.special-envoy',
    powerIndexOf('denizen.nomad.special-envoy', PowerTiming.Modifier),
    {
        hooks: {
            supplyCost: waive,
            after: () => ({ summary: 'Special Envoy ends your Act Phase', endsActPhase: true })
        }
    }
)

// "Spend no Supply and ignore the powers of sites if you're traveling to or
// from this site." Cost: place 1 secret.
registerModifier(
    'denizen.arcane.portal',
    powerIndexOf('denizen.arcane.portal', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                const here = siteHolding(ctx.state, 'denizen.arcane.portal')
                const from = player(ctx).siteId
                const to = ctx.particulars?.destinationSiteId
                if (!here) return 'Portal is not at a site'
                return here === from || here === to
                    ? undefined
                    : `you are travelling neither to nor from ${here}, where Portal sits`
            },
            supplyCost: waive,
            ignoresSitePowers: true
        }
    }
)

// "You must kill a warband (even your own) at the site you travel to, if able."
registerModifier(
    'denizen.order.tyrant',
    powerIndexOf('denizen.order.tyrant', PowerTiming.Modifier),
    {
        mandatory: true,
        hooks: {
            condition: (ctx) => {
                const to = ctx.particulars?.destinationSiteId
                assertExists(to, 'Tyrant applies to a Travel, which always names a destination')
                return totalWarbandsAt(ctx.state, to) > 0
                    ? undefined
                    : 'no warband at the destination to kill'
            },
            after: (ctx) => {
                const to = ctx.particulars?.destinationSiteId
                assertExists(to, 'Tyrant applies to a Travel, which always names a destination')
                const [color] = Object.keys(killWarbandsAtSite(ctx.state, to, 1))
                assertExists(color, "Tyrant's condition found a warband at the destination")
                return { summary: `Tyrant killed a ${color} warband at ${to}` }
            }
        }
    }
)

// "Gain one more warband if mustering from Rowdy Pub."
registerModifier(
    'denizen.hearth.rowdy-pub',
    powerIndexOf('denizen.hearth.rowdy-pub', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                ctx.particulars?.cardId === 'denizen.hearth.rowdy-pub'
                    ? undefined
                    : 'you are not mustering on Rowdy Pub',
            musterWarbands: (base) => base + 1
        }
    }
)

// "Spend no Supply if you're mustering on a beast card."
registerModifier(
    'denizen.beast.animal-playmates',
    powerIndexOf('denizen.beast.animal-playmates', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                suitOf(ctx.particulars?.cardId ?? '') === Suit.Beast
                    ? undefined
                    : `${ctx.particulars?.cardId} is not a beast card`,
            supplyCost: waive
        }
    }
)

// "Gain two more warbands if mustering on a card whose favor bank has the
// least favor (not tied)."
registerModifier(
    'denizen.discord.downtrodden',
    powerIndexOf('denizen.discord.downtrodden', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                const suit = suitOf(ctx.particulars?.cardId ?? '')
                if (!suit) return `${ctx.particulars?.cardId} has no favor bank`
                const mine = ctx.state.favorBank[suit]
                const others = Object.entries(ctx.state.favorBank)
                    .filter(([s]) => s !== suit)
                    .map(([, n]) => n)
                return others.every((n) => n > mine)
                    ? undefined
                    : `the ${suit} bank (${mine}) is not strictly the least`
            },
            musterWarbands: (base) => base + 2
        }
    }
)

// "You can muster on cards that have favor or secrets on them."
registerModifier(
    'denizen.order.pressgangs',
    powerIndexOf('denizen.order.pressgangs', PowerTiming.Modifier),
    {
        hooks: { relaxOccupancy: () => true }
    }
)

// "Spend no Supply if you sacrifice one warband from your board."
registerModifier(
    'denizen.hearth.awaited-return',
    powerIndexOf('denizen.hearth.awaited-return', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                warbandsOnBoardOf(ctx.state, ctx.playerId) >= 1
                    ? undefined
                    : 'you have no warband on your board to sacrifice',
            supplyCost: waive,
            before: (ctx) => {
                const { color } = killWarbandsOnBoard(ctx.state, ctx.playerId, 1)
                return `sacrificed a ${color} warband from your board (Awaited Return)`
            }
        }
    }
)

// "Spend no Supply if you're trading with a beast or nomad card."
registerModifier(
    'denizen.beast.birdsong',
    powerIndexOf('denizen.beast.birdsong', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                const suit = suitOf(ctx.particulars?.cardId ?? '')
                return suit === Suit.Beast || suit === Suit.Nomad
                    ? undefined
                    : `${ctx.particulars?.cardId} is neither a beast nor a nomad card`
            },
            supplyCost: waive
        }
    }
)

// "If you gain only one favor, gain one more favor."
registerModifier(
    'denizen.arcane.secret-signal',
    powerIndexOf('denizen.arcane.secret-signal', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) =>
                ctx.particulars?.tradeOption === 'forFavor'
                    ? undefined
                    : 'you are not trading for favor',
            tradeFavor: (base) => (base === 1 ? 2 : base)
        }
    }
)

// "If trading with The Old Oak for secrets, gain one more secret if you have
// any beast advisers."
registerModifier(
    'denizen.beast.the-old-oak',
    powerIndexOf('denizen.beast.the-old-oak', PowerTiming.Modifier),
    {
        hooks: {
            condition: (ctx) => {
                if (ctx.particulars?.cardId !== 'denizen.beast.the-old-oak') {
                    return 'you are not trading with The Old Oak'
                }
                if (ctx.particulars?.tradeOption !== 'forSecrets')
                    return 'you are not trading for secrets'
                const beast = hasFaceupAdviserOfSuit(ctx.state, ctx.playerId, Suit.Beast)
                return beast ? undefined : 'you have no beast adviser'
            },
            tradeSecrets: (base) => base + 1
        }
    }
)

// "Draw one more card. (Stop after a Vision as normal.)"
registerModifier(
    'denizen.arcane.augury',
    powerIndexOf('denizen.arcane.augury', PowerTiming.Modifier),
    {
        hooks: { drawCount: (base) => base + 1 }
    }
)

// R-5.1 — this and Wild Cry apply at the play: `pendingSearchModifiers` carries them to `SearchResolve`.
// "If you play a denizen card that was not a facedown adviser, gain favor from
// the hearth bank." A Search plays from the hand, so every played denizen qualifies.
registerModifier(
    'denizen.hearth.welcoming-party',
    powerIndexOf('denizen.hearth.welcoming-party', PowerTiming.Modifier),
    {
        hooks: {
            after: (ctx) => {
                const played = ctx.particulars?.playedCardId
                if (!played || ctx.particulars?.playedTo === 'discard') return undefined
                if (kindOf(played) !== CardKind.Denizen) return undefined
                const gained = gainFavorFromBank(ctx.state, ctx.playerId, Suit.Hearth, 1)
                return { summary: `Welcoming Party: gained ${gained} favor from the hearth bank` }
            }
        }
    }
)

// "If you play a beast card, gain 1 Supply and 2 warbands."
registerModifier(
    'denizen.beast.wild-cry',
    powerIndexOf('denizen.beast.wild-cry', PowerTiming.Modifier),
    {
        hooks: {
            after: (ctx) => {
                const played = ctx.particulars?.playedCardId
                if (!played || ctx.particulars?.playedTo === 'discard') return undefined
                if (suitOf(played) !== Suit.Beast) return undefined
                const supply = gainSupply(ctx.state, ctx.playerId, 1)
                const warbands = gainWarbandsToBoard(ctx.state, ctx.playerId, 2)
                return { summary: `Wild Cry: gained ${supply} Supply and ${warbands} warbands` }
            }
        }
    }
)
