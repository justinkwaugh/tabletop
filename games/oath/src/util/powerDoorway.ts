import { HydratedOathGameState } from '../model/gameState.js'
import type { HiddenRequest, HiddenReveal } from '../model/hidden.js'
import type { PowerOutcome } from '../model/powerOutcome.js'
import { assertExists } from '@tabletop/common'
import { hasAccessToCard, isFacedownAdviserOf, poweredCardIds } from './access.js'
import { cardPowers, powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { SearchPlay } from '../model/oathEnums.js'
import { payPowerCost, reasonCannotPayPowerCost } from './powerCost.js'
import {
    legalChoices,
    PowerChoice,
    reasonChoicesInvalid,
    type LegalPowerUse
} from './powerChoice.js'
import { effectFor, hasEffect, type EffectResult } from '../powers/registry.js'

/** R-7.1.1 to R-7.1.3 */

type DoorwayTiming = PowerTiming.Action | PowerTiming.Rest

const LABEL: Record<DoorwayTiming, { noun: string; article: string }> = {
    [PowerTiming.Action]: { noun: '"Action:"', article: 'an' },
    [PowerTiming.Rest]: { noun: '"Rest:"', article: 'a' }
}

export function reasonCannotUsePower(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    powerIndex: number,
    timing: DoorwayTiming,
    choices?: readonly PowerChoice[]
): string | undefined {
    const { noun: label, article } = LABEL[timing]

    // R-7.1.1 first, so a player without access learns nothing about the card's powers.
    if (!hasAccessToCard(state, playerId, cardId)) {
        return `you neither rule ${cardId} nor is your pawn at its site`
    }
    if (isFacedownAdviserOf(state, playerId, cardId)) {
        return `${cardId} is one of your facedown advisers, which have no power (R-5.1.4.II)`
    }

    if (powersWithTiming(cardId, timing).length === 0) {
        return `${cardId} prints no ${label} power`
    }

    const power = cardPowers(cardId)[powerIndex]
    if (!power) {
        return `${cardId} has no power at index ${powerIndex}`
    }
    if (power.timing !== timing) {
        return `${cardId}'s power ${powerIndex} is ${power.timing}, not ${article} ${label} power`
    }

    const unpayable = reasonCannotPayPowerCost(state, playerId, power)
    if (unpayable) return unpayable

    const badChoice = reasonChoicesInvalid(state, playerId, power, choices)
    if (badChoice) return badChoice

    // An unbuilt effect refuses last, after every rules check.
    const effect = effectFor(power)
    if (!effect) {
        return `card power effects are not implemented yet; ${cardId} power ${powerIndex} would resolve nothing`
    }

    // Before payment, so a refusal costs nothing.
    return effect.reasonCannotResolve?.({ state, playerId, power, choices: choices ?? [] })
}

/** R-7.1.2, R-7.1.3 — the caller has already validated. */
export function usePower(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    powerIndex: number,
    choices: readonly PowerChoice[] | undefined,
    reveal?: HiddenReveal
): EffectResult {
    const power = cardPowers(cardId)[powerIndex]
    const effect = effectFor(power)
    assertExists(effect, `${cardId} power ${powerIndex} has no built effect`)
    payPowerCost(state, playerId, power)
    return effect.resolve({ state, playerId, power, choices: choices ?? [], reveal })
}

export function powerOutcomeOf(result: EffectResult): PowerOutcome {
    const pileDeposits = (result.pileDeposits ?? []).filter((d) => d.cardIds.length > 0)
    return {
        rolled: result.rolled || undefined,
        relicToDeckBottom: result.relicToDeckBottom,
        relicSlotToBottom: result.relicSlotToBottom,
        disclosed: result.disclosed || undefined,
        peeked: result.peeked,
        mergePiles: result.mergePiles,
        pileDeposits: pileDeposits.length > 0 ? pileDeposits : undefined
    }
}

/** R-X.3 — the PRNG and the vault are never rolled back. */
export function isIrreversible(outcome: PowerOutcome): boolean {
    return (
        outcome.rolled === true ||
        outcome.relicToDeckBottom !== undefined ||
        outcome.relicSlotToBottom !== undefined ||
        outcome.disclosed === true ||
        outcome.mergePiles !== undefined ||
        outcome.pileDeposits !== undefined
    )
}

/** R-7.3.3, R-7.2 — a When Played power fires only for a card played faceup. */
export function isFaceupPlay(play: SearchPlay, faceUp: boolean | undefined): boolean {
    return play === SearchPlay.Site || (play === SearchPlay.Adviser && faceUp === true)
}

export function hiddenRequestFor(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    powerIndex: number,
    choices: readonly PowerChoice[] | undefined
): HiddenRequest | undefined {
    const power = cardPowers(cardId)[powerIndex]
    if (!power) return undefined
    return effectFor(power)?.hidden?.({ state, playerId, power, choices: choices ?? [] })
}

/** R-7.1.1 */
export function legalPowers(
    state: HydratedOathGameState,
    playerId: string,
    timing: PowerTiming
): LegalPowerUse[] {
    const candidates = poweredCardIds(state, playerId)
    const usable: LegalPowerUse[] = []
    for (const cardId of candidates) {
        for (const power of powersWithTiming(cardId, timing)) {
            if (!hasEffect(power)) continue
            if (reasonCannotPayPowerCost(state, playerId, power)) continue
            usable.push({
                cardId,
                powerIndex: power.powerIndex,
                choices: legalChoices(state, playerId, power)
            })
        }
    }
    return usable
}
