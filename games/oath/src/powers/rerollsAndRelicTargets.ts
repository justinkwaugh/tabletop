import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { PowerQuestionKind } from '../model/question.js'
import { askQuestion } from '../util/questions.js'
import { registerBattlePlan, registerEffect, registerPersistent } from './registry.js'
import { siteHasCardOfSuit, regionOfPawn } from './vocabulary.js'
import { nextActionIndex } from '../util/freeActions.js'
import { reasonCannotTravelByPower } from '../util/powerTravel.js'
import { canPayPowerMoveToll } from '../util/powerMoveTolls.js'
import { seeDiscardPile } from '../util/knowledge.js'

// "You may target facedown relics at targeted sites, adding 1 [defenseDie] per relic.
//  You may put any relics you take on the bottom of the relic deck." Attacker.
const RELIC_HUNTER = 'denizen.order.relic-hunter'
registerBattlePlan(RELIC_HUNTER, powerIndexOf(RELIC_HUNTER, PowerTiming.BattlePlan), {
    hooks: { targetsSiteRelics: true }
})

// "Action: Reveal the top card of your discard pile. Travel to a site with a card of this suit.
//  If unable, travel as normal. In either case, spend no Supply." Cost: place 1 secret.
const BRASS_HORSE = 'relic.brass-horse'
registerEffect(BRASS_HORSE, powerIndexOf(BRASS_HORSE, PowerTiming.Action), {
    choices: [],
    // Its Q&A — nothing to reveal, so the power cannot be used.
    reasonCannotResolve: (ctx) =>
        ctx.state.discardPileCounts[regionOfPawn(ctx.state, ctx.playerId)] > 0
            ? undefined
            : 'your discard pile is empty',
    hidden: (ctx) => ({
        kind: 'discardPeek',
        region: regionOfPawn(ctx.state, ctx.playerId),
        count: 1
    }),
    resolve: (ctx) => {
        const me = ctx.state.getPlayerState(ctx.playerId)
        const top = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds[0] : undefined
        // "Reveal" — the whole table sees the top card.
        if (top) seeDiscardPile(ctx.state, 'everyone', regionOfPawn(ctx.state, ctx.playerId), [top])
        const suit = top ? suitOf(top) : undefined
        // Its Q&A — the Travel rules bind; a site that cannot be travelled to is "unable".
        const sites = suit
            ? ctx.state
                  .faceupSiteIds()
                  .filter(
                      (siteId) =>
                          siteHasCardOfSuit(ctx.state, siteId, suit) &&
                          reasonCannotTravelByPower(ctx.state, ctx.playerId, siteId) ===
                              undefined &&
                          canPayPowerMoveToll(ctx.state, ctx.playerId, siteId)
                  )
            : []
        if (sites.length > 0) {
            askQuestion(ctx.state, ctx.playerId, {
                kind: PowerQuestionKind.TravelFreeTo,
                cardId: BRASS_HORSE,
                askedPlayerId: ctx.playerId,
                siteIds: sites
            })
            return {
                summary: `Brass Horse: revealed ${top} (${suit}); travel to a site with a ${suit} card, for no Supply`,
                peeked: top ? [top] : []
            }
        }
        // "If unable, travel as normal" — the next Travel, for no Supply.
        me.freeTravelAtAction = nextActionIndex(ctx.state)
        return {
            summary: `Brass Horse: revealed ${top ?? 'nothing'}; no site holds that suit, so the next Travel costs no Supply`,
            peeked: top ? [top] : []
        }
    }
})

// "If you rule Jinx, after you roll [attackDie] or [defenseDie] for any reason, you may use this power
//  to reroll all those dice once. (This is not a battle plan!)" Persistent. Cost: place 1 secret.
const JINX = 'denizen.arcane.jinx'
registerPersistent(JINX, powerIndexOf(JINX, PowerTiming.Persistent), {
    offersReroll: (ctx, rollerId) => ctx.ownerIds.includes(rollerId)
})
