import { HydratedIndonesiaGameState } from '../model/gameState.js'
import {
    applyAtomicDeliveryCandidateToProblem,
    buildDeliveryOperationContext,
    isSafeAtomicDeliveryCandidate
} from './deliveryCandidateContext.js'
import {
    atomicDeliveryCandidateForChoice,
    listAtomicDeliveryCandidatesFromContext
} from './deliveryCandidatePathing.js'
import type {
    AtomicDeliveryCandidate,
    AtomicDeliveryChoice,
    DeliveryOperationContext
} from './deliveryCandidateTypes.js'

export type { AtomicDeliveryCandidate, AtomicDeliveryChoice }
export type { DeliveryOperationContext } from './deliveryCandidateTypes.js'

function safeCandidateEquivalenceKey(candidate: AtomicDeliveryCandidate): string {
    return [
        candidate.zoneId,
        candidate.shippingCompanyId,
        candidate.cityId,
        candidate.seaAreaIds.join('>')
    ].join('|')
}

export function listSafeAtomicDeliveryCandidatesFromContext(
    context: DeliveryOperationContext
): AtomicDeliveryCandidate[] {
    const candidates = listAtomicDeliveryCandidatesFromContext(context)
    const isSafeByEquivalenceKey = new Map<string, boolean>()

    return candidates.filter((candidate) => {
        const equivalenceKey = safeCandidateEquivalenceKey(candidate)
        const cachedIsSafe = isSafeByEquivalenceKey.get(equivalenceKey)
        if (cachedIsSafe !== undefined) {
            return cachedIsSafe
        }

        const isSafe = isSafeAtomicDeliveryCandidate(context, candidate)
        isSafeByEquivalenceKey.set(equivalenceKey, isSafe)
        return isSafe
    })
}

export function listAtomicDeliveryCandidatesForPlayer(
    state: HydratedIndonesiaGameState,
    playerId: string
): AtomicDeliveryCandidate[] {
    const context = buildDeliveryOperationContext(state, playerId)
    if (!context) {
        return []
    }

    return listAtomicDeliveryCandidatesFromContext(context)
}

export function listSafeAtomicDeliveryCandidatesForPlayer(
    state: HydratedIndonesiaGameState,
    playerId: string
): AtomicDeliveryCandidate[] {
    const context = buildDeliveryOperationContext(state, playerId)
    if (!context) {
        return []
    }

    return listSafeAtomicDeliveryCandidatesFromContext(context)
}

export function isSafeAtomicDeliveryChoiceForPlayer(
    state: HydratedIndonesiaGameState,
    playerId: string,
    choice: AtomicDeliveryChoice
): boolean {
    const context = buildDeliveryOperationContext(state, playerId)
    if (!context) {
        return false
    }

    const candidate = atomicDeliveryCandidateForChoice(context, choice)
    if (!candidate) {
        return false
    }

    return isSafeAtomicDeliveryCandidate(context, candidate)
}

export function isValidAtomicDeliveryChoiceForPlayer(
    state: HydratedIndonesiaGameState,
    playerId: string,
    choice: AtomicDeliveryChoice
): boolean {
    const context = buildDeliveryOperationContext(state, playerId)
    if (!context) {
        return false
    }

    return atomicDeliveryCandidateForChoice(context, choice) !== null
}

export { applyAtomicDeliveryCandidateToProblem, buildDeliveryOperationContext }
export { isSafeAtomicDeliveryCandidate } from './deliveryCandidateContext.js'
export { listAtomicDeliveryCandidatesFromContext } from './deliveryCandidatePathing.js'
