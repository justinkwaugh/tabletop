import { HydratedOathGameState } from '../model/gameState.js'
import { cardPowers, EdificeFace, type CardPower, type PowerTiming } from '../data/cardPowers.js'
import { edificeName } from '../data/edifices.js'

/** R-2.9 — the side of an edifice that is up. */
function faceShowing(state: HydratedOathGameState, cardId: string): EdificeFace {
    return state.isRuined(cardId) ? EdificeFace.Ruined : EdificeFace.Intact
}

function isShowing(state: HydratedOathGameState, power: CardPower): boolean {
    return power.face === undefined || power.face === faceShowing(state, power.cardId)
}

/**
 * R-2.9 — a card's powers as it lies in play: an edifice gives only the power on the side that is
 * up; any other card gives every power it prints.
 */
export function powersInPlay(
    state: HydratedOathGameState,
    cardId: string,
    timing?: PowerTiming
): CardPower[] {
    return cardPowers(cardId).filter(
        (power) => isShowing(state, power) && (timing === undefined || power.timing === timing)
    )
}

/** R-2.9 — the power a use names, unless it is printed on the side of an edifice that is down. */
export function powerInPlay(
    state: HydratedOathGameState,
    cardId: string,
    powerIndex: number
): CardPower | undefined {
    const power = cardPowers(cardId)[powerIndex]
    return power && isShowing(state, power) ? power : undefined
}

/** R-2.9 — why a use names no power in play: the side it is printed on is down. */
export function reasonSideFaceDown(
    state: HydratedOathGameState,
    cardId: string,
    powerIndex: number
): string | undefined {
    const power = cardPowers(cardId)[powerIndex]
    if (!power || isShowing(state, power)) return undefined
    return `${edificeName(cardId, power.face === EdificeFace.Ruined)}: that side of the card is face down`
}
