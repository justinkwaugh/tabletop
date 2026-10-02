import type { Owner } from '../finance/finance.js'
import {
    TrackConstruction,
    type TrackLayDetails,
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
    /** The lay is one of the company's own, within its allowance for the turn. */
    countsAsOrdinaryLay?: true
    /** The lay leaves the power available; the title's terms decide when it is used up. */
    reusable?: true
    terrainDiscount?: number
    restriction?(request: TrackRequest): string | undefined
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
    betweenTurnsPrivateIds?: readonly string[]
    /**
     * Privates whose tile lay lets the company place its next station on that tile, free and
     * unconnected, as its station for the turn.
     */
    stationPrivateIds?: readonly string[]
    /** The title's consequences of a private's tile lay, such as marking the hex. */
    afterTrackLay?(
        state: CompanyDecisionState,
        privateCompanyId: string,
        details: TrackLayDetails
    ): void
    markerTerms?(
        state: CompanyDecisionState,
        privateCompanyId: string,
        playerId: string
    ): PrivateMarkerTerms | undefined
}

/** A private's power to mark one of these locations for its company. */
export interface PrivateMarkerTerms {
    companyId: string
    kind: string
    locationIds: readonly string[]
}
export function privateTrackConstruction(
    state: CompanyDecisionState,
    terms: PrivateTrackTerms,
    rules: TrackRules
): TrackConstruction {
    const trackStep =
        terms.countsAsOrdinaryLay && state.trackStep?.companyId === terms.companyId
            ? state.trackStep
            : { companyId: terms.companyId, lays: [], completed: false }
    const discount = terms.terrainDiscount ?? 0
    return new TrackConstruction(
        { ...state, trackStep },
        {
            ...rules,
            allowance: terms.countsAsOrdinaryLay ? rules.allowance : () => ({ cost: 0 }),
            restriction: (_state, request) =>
                terms.locationIds.includes(request.locationId) &&
                terms.definitionIds.includes(request.definitionId)
                    ? terms.restriction?.(request)
                    : 'This private cannot place that tile here.',
            useful: terms.connected ? rules.useful : () => true,
            terrainCost: (constructionState, request, cost) =>
                Math.max(
                    0,
                    (rules.terrainCost?.(constructionState, request, cost) ?? cost) - discount
                )
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
