import { assert } from '@tabletop/common'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { PowerQuestionKind } from '../model/question.js'
import { discardCards, returnTokensFrom } from '../util/discard.js'
import { isLockedFor } from '../util/locked.js'
import { askQuestion } from '../util/questions.js'
import { registerEffect, type EffectContext } from './registry.js'
import { pawnSiteId, regionOfPawn } from './vocabulary.js'

const PILGRIMAGE = 'denizen.nomad.pilgrimage'

/** R-7.2.2-H1, R-9.2 — a locked card cannot be moved, and "cannot" beats the card's "all". */
function denizensLeaving(ctx: EffectContext): string[] {
    const siteId = pawnSiteId(ctx.state, ctx.playerId)
    return ctx.state
        .denizensAt(siteId)
        .filter((cardId) => !isLockedFor(ctx.state, ctx.playerId, cardId))
}

// "When Played, move all denizens at your site to the Dispossessed. Shuffle and draw denizens from
//  the Dispossessed equal to the number you moved. Peek at them and put them on your region's discard pile."
registerEffect(PILGRIMAGE, powerIndexOf(PILGRIMAGE, PowerTiming.WhenPlayed), {
    choices: [],
    hidden: (ctx) => {
        const cardIds = denizensLeaving(ctx)
        return cardIds.length > 0 ? { kind: 'dispossessedExchange', cardIds } : undefined
    },
    resolve: (ctx) => {
        const siteId = pawnSiteId(ctx.state, ctx.playerId)
        const leaving = denizensLeaving(ctx)
        if (leaving.length === 0)
            return { summary: `Pilgrimage: no denizens at ${siteId} could be moved` }

        const drawn = ctx.reveal?.kind === 'peek' ? ctx.reveal.cardIds : []
        assert(
            drawn.length === leaving.length,
            `Pilgrimage moved ${leaving.length} denizens but the Dispossessed gave ${drawn.length}`
        )

        ctx.state.denizensBySite[siteId] = ctx.state
            .denizensAt(siteId)
            .filter((cardId) => !leaving.includes(cardId))
        // R-10.5-H1 — tokens cannot follow a card out of play.
        for (const cardId of leaving) returnTokensFrom(ctx.state, ctx.playerId, cardId)

        // R-10.30 — the card names the pawn's own region, not R-10.5's next one.
        const region = regionOfPawn(ctx.state, ctx.playerId)
        const moved = `Pilgrimage: moved ${leaving.join(', ')} from ${siteId} to the Dispossessed; drew ${drawn.length} from it, peeked`
        if (drawn.length === 1) {
            return {
                summary: `${moved}, and put it on the ${region} discard pile`,
                peeked: drawn,
                pileDeposits: discardCards(ctx.state, ctx.playerId, drawn, region, {
                    region,
                    bottom: false
                })
            }
        }
        // Law Glossary "Discard" — the player stacks the cards in the order they choose.
        askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.OrderDrawnCards,
            cardId: PILGRIMAGE,
            askedPlayerId: ctx.playerId,
            region,
            cardIds: drawn
        })
        return {
            summary: `${moved}, and will stack them on the ${region} discard pile`,
            peeked: drawn
        }
    }
})
