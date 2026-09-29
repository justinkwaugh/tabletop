import { bannerHolder } from '../util/oathkeeper.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { becomeCitizenByPower, visionDeposits } from '../util/citizenship.js'
import {
    registerBattlePlan,
    registerEffect,
    registerModifier,
    type EffectContext,
    chosen
} from './registry.js'
import { gainFavorFromBank, siteHasCardOfSuit, hasFaceupAdviserOfSuit } from './vocabulary.js'
import { siteHolding } from '../util/access.js'
import { otherRegionChoices } from './choiceDomains.js'
import { opposingLeadId } from '../util/battlePlans.js'

// "After traveling, gain favor from one favor bank that matches both a card at your site and one of your advisers."
registerModifier(
    'denizen.nomad.hospitality',
    powerIndexOf('denizen.nomad.hospitality', PowerTiming.Modifier),
    {
        choices: [
            one(PowerChoiceKind.FavorBank, {
                what: 'a bank matching a card at your destination and one of your advisers'
            })
        ],
        hooks: {
            condition: (ctx) => {
                const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
                const to = ctx.particulars?.destinationSiteId
                if (!bank || !to) return 'no destination named'
                const atSite = siteHasCardOfSuit(ctx.state, to, bank.suit)
                const held = hasFaceupAdviserOfSuit(ctx.state, ctx.playerId, bank.suit)
                if (!atSite) return `no ${bank.suit} card at ${to}`
                if (!held) return `you have no ${bank.suit} adviser`
                return undefined
            },
            after: (ctx) => {
                const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
                return {
                    summary: `Hospitality: gained ${gainFavorFromBank(ctx.state, ctx.playerId, bank.suit, 1)} favor from the ${bank.suit} bank`
                }
            }
        }
    }
)

// "Act as if you had another player's advisers instead. (You can't use your other advisers.)" Cost: place 1 secret.
registerModifier(
    'denizen.arcane.master-of-disguise',
    powerIndexOf('denizen.arcane.master-of-disguise', PowerTiming.Modifier),
    {
        choices: [
            one(PowerChoiceKind.Player, { what: 'the player whose advisers you trade with' })
        ],
        hooks: { matchingAdvisersOf: (ctx) => chosen(ctx, PowerChoiceKind.Player)[0]?.playerId }
    }
)

// "Act as if the Acting Troupe is a beast or order card instead."
const TROUPE = 'denizen.arcane.acting-troupe'
const beastOrOrder: ChoiceDomain = () =>
    [Suit.Beast, Suit.Order].map((suit) => ({ kind: PowerChoiceKind.FavorBank, suit }))
registerModifier(TROUPE, powerIndexOf(TROUPE, PowerTiming.Modifier), {
    choices: [
        one(PowerChoiceKind.FavorBank, {
            what: 'beast or order, the suit the Troupe plays',
            domain: beastOrOrder
        })
    ],
    hooks: {
        adviserSuitOverride: (ctx) => {
            const [bank] = chosen(ctx, PowerChoiceKind.FavorBank)
            return bank ? { cardId: TROUPE, suit: bank.suit } : undefined
        }
    }
})

// "You may draw from a discard pile in a different region instead of yours." Cost: place 1 favor.
registerModifier(
    'denizen.beast.errand-boy',
    powerIndexOf('denizen.beast.errand-boy', PowerTiming.Modifier),
    {
        choices: [
            one(PowerChoiceKind.Region, {
                what: "another region's discard pile",
                domain: otherRegionChoices
            })
        ],
        hooks: {
            condition: (ctx) =>
                ctx.particulars?.drawFrom === 'discard'
                    ? undefined
                    : 'you are not searching a discard pile',
            drawRegion: (ctx) => chosen(ctx, PowerChoiceKind.Region)[0]?.region
        }
    }
)

// "While your pawn is here, you may draw from any one discard pile."
const OBSERVATORY = 'denizen.arcane.observatory'
registerModifier(OBSERVATORY, powerIndexOf(OBSERVATORY, PowerTiming.Modifier), {
    choices: [one(PowerChoiceKind.Region, { what: 'the discard pile to draw from' })],
    hooks: {
        condition: (ctx) => {
            if (ctx.particulars?.drawFrom !== 'discard')
                return 'you are not searching a discard pile'
            const here = siteHolding(ctx.state, OBSERVATORY)
            return here && ctx.state.getPlayerState(ctx.playerId).siteId === here
                ? undefined
                : 'your pawn is not at the Observatory'
        },
        drawRegion: (ctx) => chosen(ctx, PowerChoiceKind.Region)[0]?.region
    }
})

function isExile(ctx: EffectContext, playerId = ctx.playerId): boolean {
    return ctx.state.getPlayerState(playerId).status === PlayerStatus.Exile
}

// "Action: If you're an Exile and have the People's Favor, become a Citizen — take no relic, end your Act Phase, and refresh Supply to full."
registerEffect(
    'denizen.hearth.ballot-box',
    powerIndexOf('denizen.hearth.ballot-box', PowerTiming.Action),
    {
        choices: [],
        reasonCannotResolve: (ctx) => {
            if (!isExile(ctx)) return 'only an Exile can take the Ballot Box'
            return bannerHolder(ctx.state, Banner.PeoplesFavor) === ctx.playerId
                ? undefined
                : "you do not hold the People's Favor"
        },
        resolve: (ctx) => {
            const c = becomeCitizenByPower(ctx.state, ctx.playerId)
            return {
                summary: `Ballot Box: became a Citizen (${c.recoloredCount} warbands turned purple); Supply refreshed, Act Phase over`,
                endsActPhase: true,
                pileDeposits: visionDeposits(c)
            }
        }
    }
)

// "When played, if you're an Exile, you may become a Citizen — take no relic, end your Act Phase, and refresh Supply to full."
registerEffect(
    'denizen.beast.long-lost-heir',
    powerIndexOf('denizen.beast.long-lost-heir', PowerTiming.WhenPlayed),
    {
        choices: [optional(PowerChoiceKind.Yes, { what: 'becoming a Citizen' })],
        reasonCannotResolve: (ctx) =>
            chosen(ctx, PowerChoiceKind.Yes).length > 0 && !isExile(ctx)
                ? 'only an Exile can become a Citizen'
                : undefined,
        resolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length === 0)
                return { summary: 'Long-Lost Heir: stayed an Exile' }
            const c = becomeCitizenByPower(ctx.state, ctx.playerId)
            return {
                summary: `Long-Lost Heir: became a Citizen (${c.recoloredCount} warbands turned purple); Supply refreshed, Act Phase over`,
                endsActPhase: true,
                pileDeposits: visionDeposits(c)
            }
        }
    }
)

// "When played, if you're an Exile and have more secrets (even on cards) than the Chancellor, you may become a Citizen — …"
function secretsOf(ctx: EffectContext, playerId: string): number {
    const p = ctx.state.getPlayerState(playerId)
    // R-7.1.2 places tokens on the card whose power is used, which a facedown adviser has not.
    const onCards = p
        .faceupAdviserIds()
        .reduce((n, cardId) => n + ctx.state.tokensOn(cardId).secrets, 0)
    return p.secrets + p.secretsFacedown + onCards
}
registerEffect(
    'denizen.arcane.bewitch',
    powerIndexOf('denizen.arcane.bewitch', PowerTiming.WhenPlayed),
    {
        choices: [optional(PowerChoiceKind.Yes, { what: 'becoming a Citizen' })],
        reasonCannotResolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length === 0) return undefined
            if (!isExile(ctx)) return 'only an Exile can become a Citizen'
            const chancellorId = ctx.state.chancellorId()
            const mine = secretsOf(ctx, ctx.playerId)
            const theirs = secretsOf(ctx, chancellorId)
            return mine > theirs
                ? undefined
                : `you have ${mine} secrets, not more than the Chancellor's ${theirs}`
        },
        resolve: (ctx) => {
            if (chosen(ctx, PowerChoiceKind.Yes).length === 0)
                return { summary: 'Bewitch: stayed an Exile' }
            const c = becomeCitizenByPower(ctx.state, ctx.playerId)
            return {
                summary: `Bewitch: became a Citizen (${c.recoloredCount} warbands turned purple); Supply refreshed, Act Phase over`,
                endsActPhase: true,
                pileDeposits: visionDeposits(c)
            }
        }
    }
)

// "If you're an Exile and defeat another Exile, you may become a Citizen — take no relic, end your Act Phase, and refresh Supply to full."
// Using the plan is the "may": it is free and does nothing else.
registerBattlePlan(
    'denizen.order.martial-culture',
    powerIndexOf('denizen.order.martial-culture', PowerTiming.BattlePlan),
    {
        hooks: {
            reasonCannotUse: (ctx) =>
                isExile(ctx) ? undefined : 'only an Exile can take Martial Culture',
            onOutcome: (ctx, victorious) => {
                if (!victorious || !isExile(ctx)) return undefined
                const enemyId = opposingLeadId(ctx.campaign.parties, ctx.campaign.side)
                if (!enemyId || !isExile(ctx, enemyId))
                    return 'Martial Culture: the defeated party was not an Exile'
                const c = becomeCitizenByPower(ctx.state, ctx.playerId)
                if (ctx.campaign.side === BattlePlanSide.Attacker && ctx.state.campaign)
                    ctx.state.campaign.endsActPhaseAfter = true
                return {
                    note: `Martial Culture: became a Citizen (${c.recoloredCount} warbands turned purple); Supply refreshed`,
                    pileDeposits: visionDeposits(c)
                }
            }
        }
    }
)
