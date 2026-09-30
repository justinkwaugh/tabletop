import { pawnSiteId } from './pawn.js'
import { cardPowers } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus, type Suit } from '../model/oathEnums.js'
import { type ImperialScope, rulesSite } from './rule.js'
import { uncoveredReliquarySpaces } from './imperial.js'
import { relicPersistentsHeldBy } from './heldPersistents.js'
import type { PersistentInPlay } from './persistent.js'

/** R-7.1.1 gates every activated power; R-7.1.4's persistent powers ignore access. */

function cardRuleHooksInPlay(state: HydratedOathGameState): PersistentInPlay[] {
    return state.players
        .flatMap((player) => relicPersistentsHeldBy(state, player))
        .filter(({ hooks }) => hooks.cardRuleAt !== undefined)
}

function cardRuleOverride(
    overrides: readonly PersistentInPlay[],
    playerId: string,
    cardId: string,
    siteId: string,
    scope?: ImperialScope
): boolean | undefined {
    for (const { ctx, hooks } of overrides) {
        const ruled = hooks.cardRuleAt?.(ctx, playerId, cardId, siteId, scope)
        if (ruled !== undefined) return ruled
    }
    return undefined
}

function siteCardsRuledBy(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    const overrides = cardRuleHooksInPlay(state)
    const ruled: string[] = []
    for (const [siteId, cardIds] of Object.entries(state.denizensBySite)) {
        const siteRuled = rulesSite(state, playerId, siteId, scope)
        if (!siteRuled && overrides.length === 0) continue
        for (const cardId of cardIds) {
            if (cardRuleOverride(overrides, playerId, cardId, siteId, scope) ?? siteRuled)
                ruled.push(cardId)
        }
    }
    return ruled
}

/** R-10.21 */
export function rulesCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    scope?: ImperialScope
): boolean {
    const player = state.getPlayerState(playerId)

    // R-10.21 — "rules their advisers", unconditionally and wherever the pawn is.
    if (player.isFaceupAdviser(cardId)) return true

    // R-10.21 — "rules any cards at sites they rule".
    const siteId = siteHolding(state, cardId)
    if (siteId !== undefined) {
        return (
            cardRuleOverride(cardRuleHooksInPlay(state), playerId, cardId, siteId, scope) ??
            rulesSite(state, playerId, siteId, scope)
        )
    }

    // R-9.4 — last, since only the holder and the host know a facedown adviser.
    return player.hasAdviser(cardId)
}

/** R-10.21, R-5.1.4.II, R-10.14 */
export function ruledFaceupCardIds(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    const player = state.getPlayerState(playerId)
    return [...new Set([...player.faceupAdviserIds(), ...siteCardsRuledBy(state, playerId, scope)])]
}

/** R-7.1.1 */
export function hasAccessToCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    scope?: ImperialScope
): boolean {
    if (rulesCard(state, playerId, cardId, scope)) {
        return true
    }
    const player = state.getPlayerState(playerId)

    // R-7.1.1-H1, R-9.1 — a held relic grants access only; `rulesCard` stays false for it.
    if (player.relicIds.includes(cardId)) {
        return true
    }

    // R-11.9 — a site's own Action: whoever rules the site or stands there.
    const siteId = siteOfSiteCard(state, cardId)
    if (siteId !== undefined) {
        return siteId === pawnSiteId(state, playerId) || rulesSite(state, playerId, siteId, scope)
    }

    return siteHolding(state, cardId) === pawnSiteId(state, playerId)
}

function siteOfSiteCard(state: HydratedOathGameState, cardId: string): string | undefined {
    return state.allSiteIds().find((siteId) => state.siteCardAt(siteId) === cardId)
}

/** R-11.9 — the site cards whose printed Action is in reach: the pawn's site and every site ruled. */
function siteCardsWithActions(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    return state
        .allSiteIds()
        .filter(
            (siteId) =>
                siteId === pawnSiteId(state, playerId) || rulesSite(state, playerId, siteId, scope)
        )
        .flatMap((siteId) => {
            const siteCardId = state.siteCardAt(siteId)
            return siteCardId && cardPowers(siteCardId).length > 0 ? [siteCardId] : []
        })
}

/** R-5.1.4.II — a facedown adviser has no power, even for the player who holds it. */
export function isFacedownAdviserOf(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): boolean {
    const player = state.getPlayerState(playerId)
    return !player.isFaceupAdviser(cardId) && player.hasAdviser(cardId)
}

/** R-7.1.1, R-2.3, R-6.6.2.a — the Chancellor's seat, not every Imperial player. */
export function hasReliquaryPowerAccess(state: HydratedOathGameState, playerId: string): boolean {
    if (uncoveredReliquarySpaces(state) === 0) return false
    return state.getPlayerState(playerId).status === PlayerStatus.Chancellor
}

export function siteHolding(state: HydratedOathGameState, cardId: string): string | undefined {
    for (const [siteId, cardIds] of Object.entries(state.denizensBySite)) {
        if (cardIds.includes(cardId)) {
            return siteId
        }
    }
    return undefined
}

/** R-7.1.1 */
export function cardsWithinReach(state: HydratedOathGameState, playerId: string): string[] {
    const player = state.getPlayerState(playerId)
    return [
        ...player.faceupAdviserIds(),
        ...player.relicIds,
        ...state.denizensAt(pawnSiteId(state, playerId))
    ]
}

/** R-7.1.1, R-7.1.1-H1 — a facedown adviser has no power (R-5.1.4.II). */
export function poweredCardIds(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    return [
        ...new Set<string>([
            ...cardsWithinReach(state, playerId),
            ...siteCardsRuledBy(state, playerId, scope),
            ...siteCardsWithActions(state, playerId, scope)
        ])
    ]
}

/** R-7.1.1 */
export function accessibleCardIds(
    state: HydratedOathGameState,
    playerId: string,
    scope?: ImperialScope
): string[] {
    const player = state.getPlayerState(playerId)
    return [...new Set([...poweredCardIds(state, playerId, scope), ...player.facedownAdviserIds()])]
}

export function denizensOnMap(state: HydratedOathGameState, suit?: Suit): string[] {
    return Object.values(state.denizensBySite)
        .flat()
        .filter((id) => suit === undefined || suitOf(id) === suit)
}
