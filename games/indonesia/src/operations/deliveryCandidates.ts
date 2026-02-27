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
    AtomicDeliveryChoice
} from './deliveryCandidateTypes.js'

export type { AtomicDeliveryCandidate, AtomicDeliveryChoice }

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

    return listAtomicDeliveryCandidatesFromContext(context).filter((candidate) =>
        isSafeAtomicDeliveryCandidate(context, candidate)
    )
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
