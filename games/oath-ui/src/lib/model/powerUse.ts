import type { PowerUseKey } from '@tabletop/oath'

export function samePowerUse(a: PowerUseKey, b: PowerUseKey): boolean {
    return a.cardId === b.cardId && a.powerIndex === b.powerIndex
}

/** The key alone, so a spread into an action carries no other field of the power. */
export function powerUseKey(power: PowerUseKey): PowerUseKey {
    return { cardId: power.cardId, powerIndex: power.powerIndex }
}
