import {
    HydratedTrade,
    TradeOption,
    defaultTolls,
    suitOf,
    type HydratedOathGameState,
    type ModifierUse,
    type Suit
} from '@tabletop/oath'

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
}

/** A card at the player's site with the trades it allows, in the strip's order. */
export type TradeRow = { cardId: string; suit: Suit; choices: TradeChoice[] }

const OPTIONS = [TradeOption.ForFavor, TradeOption.ForSecrets]

/** Every trade the player can make now, read from the engine's own plan (R-5.3.2, R-7.4). */
export function tradeRows(
    state: HydratedOathGameState,
    playerId: string,
    modifiers: ModifierUse[]
): TradeRow[] {
    return HydratedTrade.legalCards(state, playerId, modifiers).flatMap((cardId) => {
        const suit = suitOf(cardId)
        if (!suit) return []
        const tolls = defaultTolls(state, playerId, { kind: 'trade', cardId })
        const choices = OPTIONS.flatMap((option): TradeChoice[] => {
            const plan = HydratedTrade.plan(state, playerId, cardId, option, modifiers, tolls)
            if (plan.reason) return []
            const matching = HydratedTrade.matchingAdvisers(state, playerId, cardId, plan.active)
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
                    sideFavor: HydratedTrade.sideFavor(state, playerId, cardId, option, plan.active)
                }
            ]
        })
        return choices.length === 0 ? [] : [{ cardId, suit, choices }]
    })
}
