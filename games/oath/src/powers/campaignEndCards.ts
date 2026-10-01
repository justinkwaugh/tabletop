import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { ruledFaceupCardIds } from '../util/access.js'
import { isLockedFor } from '../util/locked.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { registerBattlePlan, registerPersistent } from './registry.js'

const WILD_MOUNTS = 'denizen.nomad.wild-mounts'

/** R-10.21, R-10.14 — a facedown adviser has no suit (R-5.1.4.II), and a locked card cannot be discarded (R-7.2.2). */
function beastCardsToDiscard(state: HydratedOathGameState, playerId: string): string[] {
    return ruledFaceupCardIds(state, playerId).filter(
        (cardId) => suitOf(cardId) === Suit.Beast && !isLockedFor(state, playerId, cardId)
    )
}

// It prints no "At end, discard" of its own, so R-5.5.8 never reaches it.
registerBattlePlan(WILD_MOUNTS, powerIndexOf(WILD_MOUNTS, PowerTiming.BattlePlan), {
    hooks: {
        sparesEndDiscards: (ctx, owedCardIds) => {
            const planCardIds = owedCardIds.filter((cardId) => suitOf(cardId) === Suit.Nomad)
            const insteadCardIds = beastCardsToDiscard(ctx.state, ctx.playerId)
            return planCardIds.length > 0 && insteadCardIds.length > 0
                ? { planCardIds, insteadCardIds }
                : undefined
        }
    }
})

const SNEAK_ATTACK = 'denizen.discord.sneak-attack'

// R-7.1.4-H2 — a persistent-braided "you may" is a trigger: it is asked, never evaluated.
// Its Q&A: it resolves before the attacker's Second Wind, whose free action waits for it.
registerPersistent(SNEAK_ATTACK, powerIndexOf(SNEAK_ATTACK, PowerTiming.Persistent), {
    afterCampaign: (ctx, attackerId) => {
        const notes = ctx.ownerIds
            .filter((holderPlayerId) => holderPlayerId !== attackerId)
            .map((holderPlayerId) => {
                const refused = askQuestion(ctx.state, attackerId, {
                    kind: PowerQuestionKind.SneakAttack,
                    cardId: SNEAK_ATTACK,
                    askedPlayerId: holderPlayerId,
                    defenderPlayerId: attackerId
                })
                return refused
                    ? `Sneak Attack: ${holderPlayerId} cannot campaign against ${attackerId} (${refused})`
                    : `Sneak Attack: ${holderPlayerId} may campaign against ${attackerId} for no Supply`
            })
        return notes.length > 0 ? notes.join('; ') : undefined
    }
})
