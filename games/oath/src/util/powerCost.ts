import { burnFavor } from './burn.js'
import { spendFavor, usableFavor } from './favor.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { reasonPersistentForbidsSecretCost } from './persistent.js'
import { isFree, PowerTiming, type CardPower, type PowerCost } from '../data/cardPowers.js'
import { suitOf } from '../data/cardRegistry.js'
import { holdsTheTurn } from './turn.js'

/** R-7.1.2.a — the bar is on the card; R-7.5.3's exemption is `reasonCannotPayPowerCost`'s. */
export function reasonCannotPlaceOn(
    state: HydratedOathGameState,
    cardId: string
): string | undefined {
    const tokens = state.tokensOn(cardId)
    if (tokens.favor > 0 || tokens.secrets > 0) {
        return `${cardId} already has favor or secrets on it`
    }
    return undefined
}

function placedTokens(cost: PowerCost): number {
    return cost.placeFavor + cost.placeSecret
}

/** R-7.1.2 */
export function favorNeeded(cost: PowerCost): number {
    return cost.placeFavor + cost.burnFavor
}

/** R-7.1.2 */
export function secretsNeeded(cost: PowerCost): number {
    return cost.placeSecret + cost.burnSecret
}

/** Gleaming Armor, Insect Swarm — a printed cost with the extra an enemy's card adds. */
export function addCosts(a: PowerCost, b: PowerCost): PowerCost {
    return {
        placeFavor: a.placeFavor + b.placeFavor,
        burnFavor: a.burnFavor + b.burnFavor,
        placeSecret: a.placeSecret + b.placeSecret,
        burnSecret: a.burnSecret + b.burnSecret
    }
}

export function reasonCannotPayPowerCost(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): string | undefined {
    const player = state.getPlayerState(playerId)

    const cost = power.cost
    if (isFree(cost)) return undefined

    // R-7.1.2.a — facedown secrets cannot pay; `player.secrets` counts faceup ones only.
    const favor = favorNeeded(cost)
    const usable = usableFavor(state, playerId)
    if (usable < favor) {
        return `costs ${favor} favor, player has ${usable}`
    }
    const secrets = secretsNeeded(cost)
    if (player.secrets < secrets) {
        return `costs ${secrets} secrets, player has ${player.secrets} faceup`
    }
    // R-7.1.4 — Spell Breaker bars its ruler's enemies from secret costs.
    if (secrets > 0) {
        const barred = reasonPersistentForbidsSecretCost(state, playerId)
        if (barred) return barred
    }

    if (placedTokens(cost) === 0) return undefined

    // R-7.1.2.a — a suitless card has no bank to take an out-of-turn placement; R-7.5.3 does not lift that.
    if (cost.placeFavor > 0 && !holdsTheTurn(state, playerId) && !suitOf(power.cardId)) {
        return (
            `${power.cardId} shows no suit, so R-7.1.2.a has no matching ` +
            `favor bank for an out-of-turn payment`
        )
    }

    // R-7.5.3 — keyed on the power's timing: a card's Action power beside its battle plan is not exempt.
    if (power.timing === PowerTiming.BattlePlan) return undefined

    // R-7.1.2.a-H1 — the bar is tested once, before anything is placed.
    return reasonCannotPlaceOn(state, power.cardId)
}

/** R-7.1.2, R-7.1.2.a, R-10.4. Throws: paying half a cost would leave the board wrong. */
export function payPowerCost(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): void {
    const reason = reasonCannotPayPowerCost(state, playerId, power)
    if (reason) {
        throw Error(`Cannot pay power cost: ${reason}`)
    }
    payCostOnCard(state, playerId, power.cardId, power.cost)
}

/** R-7.1.2, R-7.1.2.a, R-10.4 — onto the card on your turn; out of turn, to its bank and your board. */
export function payCostOnCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    cost: PowerCost
): void {
    if (isFree(cost)) return

    const player = state.getPlayerState(playerId)
    const outOfTurn = !holdsTheTurn(state, playerId)

    // R-10.4, R-9.3 — burned favor returns to the shared bank; a burned secret leaves play.
    spendFavor(state, playerId, favorNeeded(cost))
    player.secrets -= secretsNeeded(cost)
    burnFavor(state, cost.burnFavor)

    if (cost.placeFavor > 0) {
        if (outOfTurn) {
            // R-7.1.2.a — "the matching favor bank" is the card's suit, as in R-10.5.
            const suit = suitOf(cardId)
            if (!suit) {
                throw Error(
                    `Cannot pay power cost: ${cardId} shows no suit, so ` +
                        `R-7.1.2.a has no matching favor bank to move the favor to`
                )
            }
            state.favorBank[suit] += cost.placeFavor
        } else {
            state.addTokensOn(cardId, { favor: cost.placeFavor })
        }
    }

    if (cost.placeSecret > 0) {
        if (outOfTurn) {
            // R-7.1.2.a — facedown on the board, inert until R-4.3.2 turns them over.
            player.secretsFacedown += cost.placeSecret
        } else {
            state.addTokensOn(cardId, { secrets: cost.placeSecret })
        }
    }
}
