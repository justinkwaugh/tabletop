import type { Owner } from '../finance/finance.js'
import {
    TrackConstruction,
    type TrackRules,
    type TrackRequest,
    type TrackEvaluation
} from '../construction/trackConstruction.js'
import type { CompanyDecisionState } from './companyDecision.js'
export interface PrivateTrackTerms {
    companyId: string
    locationIds: readonly string[]
    definitionIds: readonly string[]
    payer: Owner
    connected: boolean
}
export interface PrivatePowerRules {
    trackTerms(
        state: CompanyDecisionState,
        privateCompanyId: string,
        playerId: string
    ): PrivateTrackTerms | undefined
    earlyTrainCompany(
        state: CompanyDecisionState,
        privateCompanyId: string,
        playerId: string
    ): string | undefined
}
export function privateTrackConstruction(
    state: CompanyDecisionState,
    terms: PrivateTrackTerms,
    rules: TrackRules
): TrackConstruction {
    return new TrackConstruction(
        { ...state, trackStep: { companyId: terms.companyId, lays: [], completed: false } },
        {
            ...rules,
            allowance: () => ({ cost: 0 }),
            restriction: (_state, request) =>
                terms.locationIds.includes(request.locationId) &&
                terms.definitionIds.includes(request.definitionId)
                    ? undefined
                    : 'This private cannot place that tile here.',
            useful: terms.connected ? rules.useful : () => true
        },
        terms.payer
    )
}
export function evaluatePrivateTrack(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string,
    request: TrackRequest,
    powers: PrivatePowerRules,
    track: TrackRules
): TrackEvaluation {
    const terms = powers.trackTerms(state, privateCompanyId, playerId)
    if (
        !terms ||
        terms.companyId !== request.companyId ||
        state.usedPrivatePowerIds.includes(privateCompanyId)
    )
        return { reason: 'This private tile lay is unavailable.' }
    return privateTrackConstruction(state, terms, track).evaluate(request)
}
