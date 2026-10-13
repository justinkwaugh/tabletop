import {
    ActionType,
    HydratedTrade,
    TradeOption,
    defaultTolls,
    disguisedAs,
    suitOf,
    type HydratedOathGameState,
    type ModifierUse,
    type Suit
} from '@tabletop/oath'
import { fittingModifiers } from './modifierFit.js'

/** R-5.3.2 — what each option places on the card: a secret, or two favor. */
export const TRADE_PRICE: Record<TradeOption, number> = {
    [TradeOption.ForFavor]: 1,
    [TradeOption.ForSecrets]: 2
}

/** One trade the engine accepts: what it places, what it gains, and the favor it gains beside that. */
export type TradeChoice = {
    option: TradeOption
    pay: number
    gain: number
    sideFavor: number
    /** The cards in use that fit this trade: it is counted and sent with them. */
    modifiers: ModifierUse[]
}

/** A card at the player's site with the trades it allows, in the strip's order. */
export type TradeRow = { cardId: string; suit: Suit; choices: TradeChoice[] }

const OPTIONS = [TradeOption.ForFavor, TradeOption.ForSecrets]

/** R-7.4 — the cards in use a Trade with this card for this option is judged and sent with. */
export function tradeModifiers(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    option: TradeOption,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    // Master of Disguise — whose advisers the Trade acts with is read from the cards judged with it.
    return fittingModifiers(state, playerId, ActionType.Trade, declared, (uses) => ({
        cardId,
        tradeOption: option,
        advisersOf: disguisedAs(ActionType.Trade, uses)
    }))
}

/** Every trade the player can make now, read from the engine's own plan (R-5.3.2, R-7.4). */
export function tradeRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[]
): TradeRow[] {
    const own = state.getPlayerState(playerId).siteId
    if (own === undefined) return []
    // Small Friends and Map Library reach other sites; the pawn's own cards come first.
    const sites = [own, ...state.faceupSiteIds().filter((siteId) => siteId !== own)]
    return sites.flatMap((siteId) =>
        state.denizensAt(siteId).flatMap((cardId): TradeRow[] => {
            const suit = suitOf(cardId)
            if (!suit) return []
            const tolls = defaultTolls(state, playerId, { kind: 'trade', cardId })
            const choices = OPTIONS.flatMap((option): TradeChoice[] => {
                const modifiers = tradeModifiers(state, playerId, cardId, option, declared)
                const plan = HydratedTrade.plan(state, playerId, cardId, option, modifiers, tolls)
                if (plan.reason) return []
                const matching = HydratedTrade.matchingAdvisers(
                    state,
                    playerId,
                    cardId,
                    plan.active
                )
                const wanted = HydratedTrade.wanted(
                    state,
                    playerId,
                    cardId,
                    option,
                    plan.active,
                    matching
                )
                return [
                    {
                        option,
                        pay: TRADE_PRICE[option],
                        gain:
                            option === TradeOption.ForFavor
                                ? Math.min(wanted, state.favorBank[suit])
                                : wanted,
                        sideFavor: HydratedTrade.sideFavor(
                            state,
                            playerId,
                            cardId,
                            option,
                            plan.active,
                            modifiers
                        ),
                        modifiers
                    }
                ]
            })
            return choices.length === 0 ? [] : [{ cardId, suit, choices }]
        })
    )
}
