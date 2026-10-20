import {
    offeredChoices,
    type BattlePlanUse,
    type CardPower,
    type HydratedOathGameState,
    type LegalChoice
} from '@tabletop/oath'
import {
    emptyPicks,
    picksComplete,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import {
    isPowerMoves,
    moveChoices,
    powerMoves,
    powerMovesComplete,
    type PowerMoves
} from './powerMoves.js'

/**
 * R-5.5.3 — the choices a battle plan's text opens (Mountain Giant's ±3, Warning Signals' moves),
 * less one asked only while it has an option and with none now (Wrestlers with no warband in the
 * force): there is nothing to name, and the plan is declared without it.
 */
export function planChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): LegalChoice[] {
    return offeredChoices(state, playerId, power).filter(
        (legal) => !legal.spec.askedIfAny || legal.options.length > 0
    )
}

/** Warning Signals' moves, one at a time as Messenger's are; undefined for a plan whose picks are not moves. */
export function planMoves(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    picks: PowerChoicePicks | undefined
): PowerMoves | undefined {
    return isPowerMoves(planChoices(state, playerId, power))
        ? powerMoves(state, playerId, power, picks?.moves ?? [])
        : undefined
}

/** A plan's picks are complete: for moves, a whole move and none half-built. */
export function planPicksComplete(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    picks: PowerChoicePicks | undefined
): boolean {
    const moves = planMoves(state, playerId, power, picks)
    if (moves) return powerMovesComplete(moves)
    return picksComplete(planChoices(state, playerId, power), picks ?? emptyPicks())
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
    if (legal.length === 0) return use
    const moves = planMoves(state, playerId, power, picks)
    return {
        ...use,
        choices: moves ? moveChoices(moves.whole) : powerChoicesFrom(legal, picks ?? emptyPicks())
    }
}
