import { Banner } from '../model/oathEnums.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { rulesSite, sitesRuledBy } from '../util/rule.js'
import { warbandsOnBoardOf } from '../util/force.js'
import { registerBattlePlan, registerModifier, registerPersistent } from './registry.js'

// "[plusMinus][attackDie]" — Longbows prints nothing but the icons. Either side.
const LONGBOWS = 'denizen.order.longbows'
registerBattlePlan(LONGBOWS, powerIndexOf(LONGBOWS, PowerTiming.BattlePlan), {
    hooks: {
        dice: (ctx) => ({
            attack: ctx.campaign.side === BattlePlanSide.Attacker ? 1 : -1
        })
    }
})

// "In campaigns, warbands at sites you rule add to your attacking force. You cannot travel
//  from a site you rule if any warbands are on your board." Adviser, locked.
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
registerPersistent(VOW_OF_UNION, powerIndexOf(VOW_OF_UNION, PowerTiming.Persistent), {
    extraForceSites: (ctx, attackerId) =>
        ctx.ownerIds.includes(attackerId) ? sitesRuledBy(ctx.state, attackerId) : undefined,
    forbidsTravel: (ctx, actorId, fromSiteId) => {
        if (!ctx.ownerIds.includes(actorId) || !fromSiteId) return undefined
        if (!rulesSite(ctx.state, actorId, fromSiteId)) return undefined
        return warbandsOnBoardOf(ctx.state, actorId) > 0
            ? 'Vow of Union: you cannot travel from a site you rule while any warbands are on your board'
            : undefined
    }
})

// "You cannot recover the People's Favor. Whenever any player burns [favor], you take the [favor] instead." Adviser, locked.
const VOW_OF_RENEWAL = 'denizen.discord.vow-of-renewal'
registerPersistent(VOW_OF_RENEWAL, powerIndexOf(VOW_OF_RENEWAL, PowerTiming.Persistent), {
    forbidsBannerTake: (ctx, actorId, banner) =>
        banner === Banner.PeoplesFavor && ctx.ownerIds.includes(actorId)
            ? "Vow of Renewal: you cannot recover the People's Favor"
            : undefined,
    takesBurnedFavor: (ctx) => ctx.ownerIds[0]
})

// "If recovering the Darkest Secret, gain [secret][secret] and add them to any other [secret] you're
//  paying to recover it (even none)." Recover modifier. Cost: place 2 favor.
const MAGICIANS_CODE = 'denizen.arcane.magicians-code'
registerModifier(MAGICIANS_CODE, powerIndexOf(MAGICIANS_CODE, PowerTiming.Modifier), {
    hooks: {
        condition: (ctx) =>
            ctx.particulars?.banner === Banner.DarkestSecret
                ? undefined
                : "Magician's Code applies only when recovering the Darkest Secret",
        recoverSecrets: (base) => base + 2
    }
})
