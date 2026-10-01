import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { enemyOfRuler, rulerRulesCard, rulerRulesSite } from '../util/tolls.js'
import { registerPersistent } from './registry.js'
import { pawnSiteId } from './vocabulary.js'

// "Enemies cannot travel to sites ruled by Toll Roads' ruler unless they give [favor] to its ruler."
registerPersistent(
    'denizen.order.toll-roads',
    powerIndexOf('denizen.order.toll-roads', PowerTiming.Persistent),
    {
        tollToTravel: (ctx, actorId, toSiteId) =>
            enemyOfRuler(ctx, actorId) && rulerRulesSite(ctx, toSiteId)
    }
)

// "Enemies cannot trade with cards ruled by Curfew's ruler unless they give [favor] to its ruler."
registerPersistent(
    'denizen.order.curfew',
    powerIndexOf('denizen.order.curfew', PowerTiming.Persistent),
    {
        tollToTrade: (ctx, actorId, cardId) =>
            enemyOfRuler(ctx, actorId) && rulerRulesCard(ctx, cardId)
    }
)

// "Enemies cannot search if their pawn is at any site ruled by Forced Labor's ruler unless they give [favor] to its ruler."
registerPersistent(
    'denizen.order.forced-labor',
    powerIndexOf('denizen.order.forced-labor', PowerTiming.Persistent),
    {
        tollToSearch: (ctx, actorId) => {
            return enemyOfRuler(ctx, actorId) && rulerRulesSite(ctx, pawnSiteId(ctx.state, actorId))
        }
    }
)

// "Spend no Supply if you're traveling to this site and either rule Way Station or choose to give [favor] to its ruler."
registerPersistent(
    'denizen.nomad.way-station',
    powerIndexOf('denizen.nomad.way-station', PowerTiming.Persistent),
    {
        // The ruler's own free Travel is `wayStationRuled`.
        travelFreeForToll: (ctx, actorId, toSiteId) =>
            toSiteId === ctx.siteId && !ctx.ownerIds.includes(actorId)
    }
)
