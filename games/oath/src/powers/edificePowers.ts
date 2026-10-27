import { EDIFICE_POWER_INDEX, EdificeFace } from '../data/cardPowers.js'
import { edificeName } from '../data/edifices.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { siteHolding } from '../util/access.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { FESTIVAL_DISTRICT_ALLOWS } from '../util/exchange.js'
import { regionOfPawn } from '../util/pawn.js'
import { enemyOfOwners, ownersRuleSite } from '../util/persistent.js'
import { one, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { negotiator } from './questionPowers.js'
import {
    chosen,
    registerBattlePlan,
    registerEffect,
    registerModifier,
    registerPersistent
} from './registry.js'
import { drawRelicToKeepOrBottom } from './relicCards.js'

// R-2.9 — each edifice prints a power on each side; only the side showing acts (`powersInPlay`).
const INTACT = EDIFICE_POWER_INDEX[EdificeFace.Intact]
const RUINED = EDIFICE_POWER_INDEX[EdificeFace.Ruined]

const HALL = 'edifice.hearth.hall-of-debate'

// Hall of Debate: "Players cannot target the People's Favor." Persistent. R-5.4.1-H1 — a Campaign's
// target only (R-5.5.2): a Recover of it and the Conspiracy's take stay legal.
registerPersistent(HALL, INTACT, {
    forbidsCampaignTarget: (_ctx, _parties, target) =>
        target.kind === CampaignTargetKind.Banner && target.banner === Banner.PeoplesFavor
            ? `${edificeName(HALL, false)}: the People's Favor cannot be targeted`
            : undefined
})

// Hall of Mockery: "Recovering the People's Favor always flips it to the Mob side." Persistent.
registerPersistent(HALL, RUINED, { recoverFlipsPeoplesFavorToMob: true })

const FORGE = 'edifice.nomad.ancient-forge'

// Ancient Forge: "Action: Draw a relic. Take it or put it on the bottom of the relic deck."
// Cost: place 2 favor, burn 1 secret.
registerEffect(FORGE, INTACT, drawRelicToKeepOrBottom(FORGE, edificeName(FORGE, false)))

// Broken Forge: "Action: Flip this card over." Cost: place 2 favor, place 2 secrets. The tokens stay
// on the card, now intact, until a Rest clears them (R-4.3.1, R-4.3.2).
registerEffect(FORGE, RUINED, {
    choices: [],
    resolve: (ctx) => {
        ctx.state.setEdificeRuined(FORGE, false)
        return {
            summary: `${edificeName(FORGE, true)}: flipped it to ${edificeName(FORGE, false)}`
        }
    }
})

const RAMPART = 'edifice.order.sprawling-rampart'

// Sprawling Rampart: "Each site ruled by Sprawling Rampart's ruler adds one more [defenseDie] when
// targeted." Persistent; its ruler, the bandits included, judged in the Campaign's scope.
registerPersistent(RAMPART, INTACT, {
    siteDefenseBonus: (ctx, siteId) => (ownersRuleSite(ctx, siteId) ? 1 : 0)
})

// Bandit Rampart: "-2 [attackDie] if this site is targeted." Defender, cost-free (R-7.5).
registerBattlePlan(RAMPART, RUINED, {
    hooks: {
        dice: (ctx) => {
            const here = siteHolding(ctx.state, RAMPART)
            return here && targetedSiteIds(ctx.campaign.parties).includes(here)
                ? { attack: -2 }
                : undefined
        }
    }
})

const SPIRE = 'edifice.arcane.great-spire'

// Great Spire: "You may swap any number of denizens you draw with random cards from the Dispossessed."
// Search modifier; cost: place 1 secret. Carried to the Search's own swap step (`SearchSwap`), used once
// after the draw and before the discard.
registerModifier(SPIRE, INTACT, { hooks: { swapsWithDispossessed: true } })

/** Fallen Spire's "up to five". */
const FALLEN_SPIRE_MOST = 5

/**
 * Fallen Spire — the most a use may name, read from public counts alone, since its Q&A lets no one
 * look at the pile first: five, and no more than the pile or the Dispossessed holds.
 */
function fallenSpireMost(state: HydratedOathGameState, playerId: string): number {
    const pile = state.discardPileCounts[regionOfPawn(state, playerId)]
    return Math.min(FALLEN_SPIRE_MOST, pile, state.dispossessedCount)
}

function fallenSpireCounts(state: HydratedOathGameState, playerId: string): PowerChoice[] {
    return Array.from({ length: fallenSpireMost(state, playerId) }, (_, i) => ({
        kind: PowerChoiceKind.Count,
        n: i + 1
    }))
}

// Fallen Spire: "Action: Swap up to five denizens from the top of your region's discard pile (skipping
// Visions) with random cards from the Dispossessed." Cost: place 1 secret, burn 1 secret. The count is
// chosen unseen (its Q&A); each denizen swaps in place (R-10.25), as many as the pile and the
// Dispossessed allow (R-7.1.3). Your region is your pawn's (R-10.30).
registerEffect(SPIRE, RUINED, {
    choices: [one(PowerChoiceKind.Count, { what: 'denizens to swap', domain: fallenSpireCounts })],
    // Choosing none is not a use. With the pile or the Dispossessed empty the domain offers no count.
    reasonCannotResolve: (ctx) => {
        const [count] = chosen(ctx, PowerChoiceKind.Count)
        const most = fallenSpireMost(ctx.state, ctx.playerId)
        if (count && !(Number.isInteger(count.n) && count.n >= 1 && count.n <= most))
            return `${edificeName(SPIRE, true)}: choose 1 to ${most} denizens to swap`
        return undefined
    },
    hidden: (ctx) => {
        const [count] = chosen(ctx, PowerChoiceKind.Count)
        return count
            ? {
                  kind: 'discardPileSwap',
                  region: regionOfPawn(ctx.state, ctx.playerId),
                  count: count.n
              }
            : undefined
    },
    resolve: (ctx) => {
        const region = regionOfPawn(ctx.state, ctx.playerId)
        const swapped = ctx.reveal?.kind === 'swapped' ? ctx.reveal.count : 0
        return {
            summary: `${edificeName(SPIRE, true)}: swapped ${swapped} ${swapped === 1 ? 'denizen' : 'denizens'} on the ${region} discard pile with cards from the Dispossessed`
        }
    }
})

const DISTRICT = 'edifice.discord.festival-district'

// Festival District: "Action: Negotiate a binding exchange of [favor], [secret], and advisers with any
// player." The Gathering's built exchange rules carry the advisers (R-7.6.3, R-7.6.4, R-7.2.2).
registerEffect(
    DISTRICT,
    INTACT,
    negotiator(DISTRICT, FESTIVAL_DISTRICT_ALLOWS, edificeName(DISTRICT, false))
)

// Squalid District: "Whenever the [endDie] is rolled to end the game, Squalid District's ruler may
// increase or decrease this roll by one. Citizens cannot use this power." Persistent; asked after the
// roll (its Q&A). The bandits choose nothing (R-X.1). Of two players who rule its site, the
// Chancellor, else the first seated.
registerPersistent(DISTRICT, RUINED, {
    endDieAdjuster: (ctx) => {
        const able = ctx.ownerIds.filter(
            (id) => ctx.state.getPlayerState(id).status !== PlayerStatus.Citizen
        )
        const chancellor = ctx.state.chancellorId()
        return able.includes(chancellor) ? chancellor : able[0]
    }
})

const TEMPLE = 'edifice.beast.forest-temple'

// Forest Temple: "In the Chronicle, do not discard sites with any [beast] cards." Persistent; whoever
// rules the Temple or the site (its Q&A), read by R-8.3.2's site discard. A ruin shows no suit.
registerPersistent(TEMPLE, INTACT, {
    keepsSiteInChronicle: (ctx, siteId) =>
        ctx.state.denizensAt(siteId).some((cardId) => ctx.state.suitInPlay(cardId) === Suit.Beast)
})

// Ruined Temple: "Enemies of Ruined Temple's ruler cannot play [beast] cards faceup." Persistent; the
// played card's suit, which no Vision shows; the bandits' enemies are every player (Tome Guardians'
// and Gossip's Q&A).
registerPersistent(TEMPLE, RUINED, {
    forbidsFaceupPlay: (ctx, actorId, cardId) =>
        ctx.state.suitInPlay(cardId) === Suit.Beast && enemyOfOwners(ctx, actorId)
            ? `${edificeName(TEMPLE, true)}: enemies of its ruler cannot play beast cards faceup`
            : undefined
})
