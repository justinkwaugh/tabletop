import { HydratedOathGameState } from '../model/gameState.js'
import { usableFavor } from './favor.js'
import { favorNeeded, secretsNeeded } from './powerCost.js'
import type { ActiveModifier } from './modifiers.js'

/** R-7.1.2 — favor and secrets an action takes from its player, wherever they go. */
export interface ActionPayment {
    favor: number
    secrets: number
}

export function favorPayment(favor: number): ActionPayment {
    return { favor, secrets: 0 }
}

export function secretPayment(secrets: number): ActionPayment {
    return { favor: 0, secrets }
}

/** R-7.4.1 — a mandatory modifier is not declared, so it is not paid. */
export function modifierPayment(active: readonly ActiveModifier[]): ActionPayment {
    const declared = active.filter((m) => !m.mandatory)
    return {
        favor: declared.reduce((n, m) => n + favorNeeded(m.power.cost), 0),
        secrets: declared.reduce((n, m) => n + secretsNeeded(m.power.cost), 0)
    }
}

/** R-7.1.4 — a favor for each toll listed. */
export function tollPayment(tolls: readonly string[] | undefined): ActionPayment {
    return favorPayment(new Set(tolls).size)
}

/** R-7.1.2, R-7.1.2.a — every payment is checked against one holding before any of it is made. */
export function reasonCannotPayInAll(
    state: HydratedOathGameState,
    playerId: string,
    payments: readonly ActionPayment[]
): string | undefined {
    const favor = payments.reduce((n, p) => n + p.favor, 0)
    const heldFavor = usableFavor(state, playerId)
    if (favor > heldFavor) return `costs ${favor} favor in all, you hold ${heldFavor}`
    const secrets = payments.reduce((n, p) => n + p.secrets, 0)
    const heldSecrets = state.getPlayerState(playerId).secrets
    if (secrets > heldSecrets) {
        return `costs ${secrets} ${secrets === 1 ? 'secret' : 'secrets'} in all, you hold ${heldSecrets}`
    }
    return undefined
}
