import {
    legalChoices,
    type BattlePlanUse,
    type CardPower,
    type HydratedOathGameState,
    type LegalChoice
} from '@tabletop/oath'
import { emptyPicks, powerChoicesFrom, type PowerChoicePicks } from './powerChoices.js'

/** R-5.5.3 — the choices a battle plan's text opens (Mountain Giant's ±3, Warning Signals' moves). */
export function planChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): LegalChoice[] {
    return legalChoices(state, playerId, power)
}

/** The plan as declared, carrying its picks when its text asks for any. */
export function declaredPlan(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    picks: PowerChoicePicks | undefined
): BattlePlanUse {
    const use = { cardId: power.cardId, powerIndex: power.powerIndex }
    const legal = planChoices(state, playerId, power)
    return legal.length === 0
        ? use
        : { ...use, choices: powerChoicesFrom(legal, picks ?? emptyPicks()) }
}
