import { assertExists } from '@tabletop/common'
import { PowerTiming, TRIBUNAL_ID, powerIndexOf } from '../data/cardPowers.js'
import { isVision } from '../data/cardRegistry.js'
import { PowerQuestionKind, type ExchangeAllowance } from '../model/question.js'
import { one, optional, PowerChoiceKind, type ChoiceDomain } from '../util/powerChoice.js'
import { askQuestion, scheduleGatheringFloor, turnOrderFrom } from '../util/questions.js'
import {
    DEED_WRITER_ALLOWS,
    reasonExchangeInvalid,
    reasonTermsOutsideCard,
    TINKERS_FAIR_ALLOWS
} from '../util/exchange.js'
import { registerEffect, registerPersistent, type EffectDefinition, chosen } from './registry.js'
import { otherPlayersAtYourSite, pawnSiteId } from './vocabulary.js'
import { reasonPersistentForbidsRelicTake } from '../util/persistent.js'

// "When played, each player, following turn order, may burn any number of [favor] to gain an equal number of [secret]."
const REVELATION = 'denizen.arcane.revelation'
registerEffect(REVELATION, powerIndexOf(REVELATION, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        const notes: string[] = []
        for (const playerId of turnOrderFrom(ctx.state, ctx.playerId)) {
            const note = askQuestion(ctx.state, ctx.playerId, {
                kind: PowerQuestionKind.BurnFavorForSecrets,
                cardId: REVELATION,
                askedPlayerId: playerId
            })
            if (note) notes.push(note)
        }
        return {
            summary: `Revelation: each player may burn favor for secrets${notes.length ? ` (${notes.join('; ')})` : ''}`
        }
    }
})

// "When played, choose a relic held by a player whose pawn is at your site. You take the relic unless they give you [favor][favor][favor]."
const BLACKMAIL = 'denizen.discord.blackmail'
const BLACKMAIL_PRICE = 3
// Circlet of Command, Lost Tongue — "cannot target or take … in any way".
const relicsHeldAtYourSite: ChoiceDomain = (state, playerId) =>
    otherPlayersAtYourSite(state, playerId).flatMap((id) =>
        state
            .getPlayerState(id)
            .relicIds.filter(
                (cardId) =>
                    reasonPersistentForbidsRelicTake(state, playerId, id, cardId) === undefined
            )
            .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
    )
registerEffect(BLACKMAIL, powerIndexOf(BLACKMAIL, PowerTiming.WhenPlayed), {
    choices: [
        optional(PowerChoiceKind.Card, {
            what: 'a relic held by a player at your site',
            domain: relicsHeldAtYourSite
        })
    ],
    reasonCannotResolve: (ctx) =>
        chosen(ctx, PowerChoiceKind.Card).length === 0 &&
        relicsHeldAtYourSite(ctx.state, ctx.playerId, ctx.power).length > 0
            ? 'Blackmail must choose a relic while a player at your site holds one'
            : undefined,
    resolve: (ctx) => {
        const [relic] = chosen(ctx, PowerChoiceKind.Card)
        if (!relic) return { summary: 'Blackmail: nobody at your site holds a relic' }
        const holder = ctx.state.relicHolderOf(relic.cardId)
        assertExists(holder, `nobody holds ${relic.cardId}`)
        const note = askQuestion(ctx.state, ctx.playerId, {
            kind: PowerQuestionKind.PayOrLoseRelic,
            cardId: BLACKMAIL,
            askedPlayerId: holder.playerId,
            takerPlayerId: ctx.playerId,
            relicCardId: relic.cardId,
            price: BLACKMAIL_PRICE
        })
        return {
            summary: note
                ? `Blackmail: ${note}`
                : `Blackmail: ${holder.playerId} must give ${BLACKMAIL_PRICE} favor or lose ${relic.cardId}`
        }
    }
})

// "After another player campaigns against a player (not bandits), you gain [favor] from any favor bank."
const HERALD = 'denizen.hearth.herald'
registerPersistent(HERALD, powerIndexOf(HERALD, PowerTiming.Persistent), {
    afterCampaign: (ctx, attackerId, defenderId) => {
        if (!defenderId) return undefined
        const notes: string[] = []
        for (const owner of ctx.ownerIds) {
            if (owner === attackerId) continue
            const note = askQuestion(ctx.state, attackerId, {
                kind: PowerQuestionKind.PickFavorBank,
                cardId: HERALD,
                askedPlayerId: owner,
                amount: 1
            })
            notes.push(note ?? `${owner} gains a favor from a bank of their choice`)
        }
        return notes.length ? `Herald: ${notes.join('; ')}` : undefined
    }
})

// "After another player plays a Vision faceup, you gain [favor][favor] from any one favor bank."
const BOOK_BINDERS = 'denizen.hearth.book-binders'
registerPersistent(BOOK_BINDERS, powerIndexOf(BOOK_BINDERS, PowerTiming.Persistent), {
    afterCardPlayed: (ctx, actorId, cardId) => {
        if (!isVision(cardId)) return undefined
        const notes: string[] = []
        for (const owner of ctx.ownerIds) {
            if (owner === actorId) continue
            const note = askQuestion(ctx.state, actorId, {
                kind: PowerQuestionKind.PickFavorBank,
                cardId: BOOK_BINDERS,
                askedPlayerId: owner,
                amount: 2
            })
            notes.push(note ?? `${owner} gains 2 favor from a bank of their choice`)
        }
        return notes.length ? `Book Binders: ${notes.join('; ')}` : undefined
    }
})

/** "Action: Negotiate a binding exchange of … with any player." */
function negotiator(cardId: string, allows: ExchangeAllowance): EffectDefinition {
    return {
        choices: [one(PowerChoiceKind.Exchange, { what: 'a player and the terms', allows })],
        reasonCannotResolve: (ctx) => {
            const [ex] = chosen(ctx, PowerChoiceKind.Exchange)
            if (!ex) return undefined
            return (
                reasonTermsOutsideCard(ex.terms, allows) ??
                reasonExchangeInvalid(ctx.state, ctx.playerId, ex.withPlayerId, ex.terms)
            )
        },
        resolve: (ctx) => {
            const [ex] = chosen(ctx, PowerChoiceKind.Exchange)
            const note = askQuestion(ctx.state, ctx.playerId, {
                kind: PowerQuestionKind.Exchange,
                cardId,
                askedPlayerId: ex.withPlayerId,
                proposerPlayerId: ctx.playerId,
                terms: ex.terms
            })
            return {
                summary: note
                    ? `${cardId}: ${note}`
                    : `proposed a binding exchange to ${ex.withPlayerId}`
            }
        }
    }
}

// R-11.9 — The Tribunal: favor and secrets only; a promised future action binds no one in the engine (R-7.6.3-H1).
registerEffect(TRIBUNAL_ID, 0, negotiator(TRIBUNAL_ID, {}))

// "Action: Negotiate a binding exchange of [favor], [secret], and relics with any player."
const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'
registerEffect(
    TINKERS_FAIR,
    powerIndexOf(TINKERS_FAIR, PowerTiming.Action),
    negotiator(TINKERS_FAIR, TINKERS_FAIR_ALLOWS)
)

// "Action: Negotiate a binding exchange of [favor], [secret], and ruled sites with any player.
//  Old ruler moves warbands to board, and new ruler moves warbands from board."
const DEED_WRITER = 'denizen.hearth.deed-writer'
registerEffect(
    DEED_WRITER,
    powerIndexOf(DEED_WRITER, PowerTiming.Action),
    negotiator(DEED_WRITER, DEED_WRITER_ALLOWS)
)

// "When Played, any players in turn order may put their pawn on this site. Then, players with
//  pawns here may negotiate binding exchanges of [favor], [secret], relics, and advisers."
const GATHERING = 'denizen.nomad.the-gathering'
registerEffect(GATHERING, powerIndexOf(GATHERING, PowerTiming.WhenPlayed), {
    choices: [],
    resolve: (ctx) => {
        const siteId = pawnSiteId(ctx.state, ctx.playerId)
        for (const playerId of turnOrderFrom(ctx.state, ctx.playerId)) {
            if (playerId === ctx.playerId) continue
            askQuestion(ctx.state, ctx.playerId, {
                kind: PowerQuestionKind.JoinSite,
                cardId: GATHERING,
                askedPlayerId: playerId,
                siteId
            })
        }
        // R-7.6.3-H2 — the proposals come once the pawns have moved.
        scheduleGatheringFloor(ctx.state, ctx.playerId, GATHERING, siteId)
        return { summary: `The Gathering: players may join at ${siteId}, then negotiate` }
    }
})
