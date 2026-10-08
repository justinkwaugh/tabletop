import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { cardDefinition, suitOf } from '../data/cardRegistry.js'
import { ruledFaceupCardIds } from '../util/access.js'
import { banditsRuleSite, type ImperialScope } from '../util/rule.js'
import { battleScopeOf } from '../util/campaign.js'
import { isLockedFor } from '../util/locked.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { registerBattlePlan, registerPersistent } from './registry.js'

const WILD_MOUNTS = 'denizen.nomad.wild-mounts'

/** R-10.21, R-10.14 — a facedown adviser has no suit (R-5.1.4.II), and a locked card cannot be discarded (R-7.2.2). */
function beastCardsToDiscard(
    state: HydratedOathGameState,
    playerId: string,
    scope: ImperialScope | undefined
): string[] {
    return ruledFaceupCardIds(state, playerId, scope).filter(
        (cardId) => suitOf(cardId) === Suit.Beast && !isLockedFor(state, playerId, cardId)
    )
}

/**
 * Its Q&A, R-7.5-H1 — the first beast card the bandits rule, site by site from the top of the
 * Cradle down through the regions. No player rules those sites, so only a printed lock applies.
 */
function banditsFirstBeastCard(state: HydratedOathGameState): string | undefined {
    for (const siteId of state.allSiteIds()) {
        if (!banditsRuleSite(state, siteId)) continue
        const found = state
            .denizensAt(siteId)
            .find((cardId) => suitOf(cardId) === Suit.Beast && !cardDefinition(cardId)?.locked)
        if (found) return found
    }
    return undefined
}

// It prints no "At end, discard" of its own, so R-5.5.8 never reaches it.
registerBattlePlan(WILD_MOUNTS, powerIndexOf(WILD_MOUNTS, PowerTiming.BattlePlan), {
    hooks: {
        sparesEndDiscards: (ctx, owedCardIds) => {
            const planCardIds = owedCardIds.filter((cardId) => suitOf(cardId) === Suit.Nomad)
            const insteadCardIds = beastCardsToDiscard(
                ctx.state,
                ctx.playerId,
                battleScopeOf(ctx.state, ctx.campaign.parties)
            )
            return planCardIds.length > 0 && insteadCardIds.length > 0
                ? { planCardIds, insteadCardIds }
                : undefined
        },
        // Its Q&A: "If they would discard two or more Nomads, they discard the first Beast card they rule."
        banditSparesEndDiscards: (ctx, owedCardIds) => {
            const planCardIds = owedCardIds.filter((cardId) => suitOf(cardId) === Suit.Nomad)
            if (planCardIds.length < 2) return undefined
            const insteadCardId = banditsFirstBeastCard(ctx.state)
            return insteadCardId ? { planCardIds, insteadCardId } : undefined
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
