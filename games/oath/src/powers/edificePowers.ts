import { EDIFICE_POWER_INDEX, EdificeFace } from '../data/cardPowers.js'
import { edificeName } from '../data/edifices.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner } from '../model/oathEnums.js'
import { siteHolding } from '../util/access.js'
import { targetedSiteIds } from '../util/campaignSite.js'
import { ownersRuleSite } from '../util/persistent.js'
import { registerBattlePlan, registerEffect, registerPersistent } from './registry.js'
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
