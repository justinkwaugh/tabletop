import {
    isAnswerQuestion,
    isCampaignDefeatKills,
    isCampaignResolveVictory,
    isCampaignSacrifice,
    isPlayFacedownAdviser,
    isSearchResolve,
    isUseActionPower,
    isUseRestPower,
    type PileDeposit,
    type UseActionPowerMetadata
} from '@tabletop/oath'
import type { GameAction } from '@tabletop/common'

export type { PileDeposit }
export type MergedPiles = NonNullable<UseActionPowerMetadata['mergePiles']>
type ActorOnlyOutcome = Pick<UseActionPowerMetadata, 'peeked' | 'relicToDeckBottom'>

function powerOutcomeOf(
    action: GameAction
): Pick<UseActionPowerMetadata, 'peeked' | 'relicToDeckBottom' | 'mergePiles'> | undefined {
    if (
        isUseActionPower(action) ||
        isUseRestPower(action) ||
        isSearchResolve(action) ||
        isPlayFacedownAdviser(action)
    ) {
        return action.metadata
    }
    return undefined
}

export function mergedPilesOf(action: GameAction): MergedPiles | undefined {
    return powerOutcomeOf(action)?.mergePiles
}

function outcomeOf(action: GameAction): ActorOnlyOutcome | undefined {
    const powerOutcome = powerOutcomeOf(action)
    if (powerOutcome) return powerOutcome
    if (isAnswerQuestion(action)) {
        return action.metadata ? { relicToDeckBottom: action.metadata.relicToDeckBottom } : {}
    }
    return undefined
}

// R-9.4 — rendered by rule: the actor alone is shown what the action showed them,
// whatever data the client happens to hold.
export function actorOnlyOutcome(
    action: GameAction,
    viewerId: string | undefined
): ActorOnlyOutcome | undefined {
    if (viewerId === undefined || action.playerId !== viewerId) return undefined
    const outcome = outcomeOf(action)
    if (!outcome) return undefined
    const peeked = outcome.peeked && outcome.peeked.length > 0 ? outcome.peeked : undefined
    if (!peeked && outcome.relicToDeckBottom === undefined) return undefined
    return { peeked, relicToDeckBottom: outcome.relicToDeckBottom }
}

export function latestActorOnlyOutcome(
    actions: readonly GameAction[],
    viewerId: string | undefined
): ActorOnlyOutcome | undefined {
    const latest = actions.findLast((action) => action.playerId === viewerId)
    return latest ? actorOnlyOutcome(latest, viewerId) : undefined
}

export function pileDepositsOf(action: GameAction): PileDeposit[] {
    if (
        isUseActionPower(action) ||
        isUseRestPower(action) ||
        isSearchResolve(action) ||
        isPlayFacedownAdviser(action) ||
        isCampaignSacrifice(action) ||
        isCampaignDefeatKills(action) ||
        isCampaignResolveVictory(action) ||
        isAnswerQuestion(action)
    ) {
        return action.metadata?.pileDeposits ?? []
    }
    return []
}

/** R-9.4 — every card this action showed its own player alone, each once, in the order seen. */
export function actorOnlyCards(action: GameAction, viewerId: string | undefined): string[] {
    if (viewerId === undefined || action.playerId !== viewerId) return []
    const seen = actorOnlyOutcome(action, viewerId)
    const cards = [
        ...(seen?.peeked ?? []),
        ...(seen?.relicToDeckBottom !== undefined ? [seen.relicToDeckBottom] : []),
        ...pileDepositsOf(action).flatMap((deposit) => deposit.cardIds),
        ...(isSearchResolve(action) ? (action.metadata?.discardedCardIds ?? []) : [])
    ]
    return [...new Set(cards)]
}

export function latestActorOnlyCards(
    actions: readonly GameAction[],
    viewerId: string | undefined
): string[] {
    const latest = actions.findLast((action) => action.playerId === viewerId)
    return latest ? actorOnlyCards(latest, viewerId) : []
}

export interface ActorNotice {
    /** The card whose power showed the actor these cards, when the record names one. */
    shownBy?: string
    cards: string[]
    relicToDeckBottom?: string
}

function shownBy(action: GameAction): string | undefined {
    if (isUseActionPower(action) || isUseRestPower(action) || isPlayFacedownAdviser(action)) {
        return action.cardId
    }
    if (isSearchResolve(action)) return action.keptCardId
    if (isAnswerQuestion(action)) return action.metadata?.cardId
    return undefined
}

/**
 * R-9.4 — the notice above the action panel shows only what the game showed its actor and
 * nobody else: a peek, or the relic they sent under the deck. Their own discards and kept
 * card are theirs to remember, and the history row pictures those. It shows for the game's
 * latest action alone, so any next action clears it.
 */
export function latestActorNotice(
    actions: readonly GameAction[],
    viewerId: string | undefined
): ActorNotice | undefined {
    const latest = actions.at(-1)
    if (!latest || viewerId === undefined || latest.playerId !== viewerId) return undefined
    const seen = actorOnlyOutcome(latest, viewerId)
    if (!seen) return undefined
    const cards = [
        ...(seen.peeked ?? []),
        ...(seen.relicToDeckBottom !== undefined ? [seen.relicToDeckBottom] : [])
    ]
    if (cards.length === 0) return undefined
    return {
        shownBy: shownBy(latest),
        cards: [...new Set(cards)],
        relicToDeckBottom: seen.relicToDeckBottom
    }
}
