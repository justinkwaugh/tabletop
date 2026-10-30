import { stateWith } from '../game/stateWith.js'
import {
    TrackConstruction,
    type TrackEvaluation,
    type TrackLayDetails,
    type TrackLayEffects,
    type TrackRequest,
    type TrackRules
} from '../construction/trackConstruction.js'
import type { Owner } from '../finance/finance.js'
import type { CompanyDecisionState } from './companyDecision.js'
import { privatePowerUsed } from './companyDecision.js'
export interface PrivateTrackTerms {
    companyId: string
    locationIds: readonly string[]
    definitionIds: readonly string[]
    payer: Owner
    connected: boolean
    countsAsOrdinaryLay?: true
    // Several lays: the title's terms, not the family, decide when the power is used up.
    reusable?: true
    /**
     * The open places are laid together: the power starts only when each has a lay, and once
     * one is laid the rest must follow before the player does anything else.
     */
    together?: true
    terrainDiscount?: number
    free?: true
    restriction?(request: TrackRequest): string | undefined
    relabels?: true
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
    afterTrackLay?(
        state: CompanyDecisionState,
        privateCompanyId: string,
        details: TrackLayDetails
    ): TrackLayEffects
    markerTerms?(
        state: CompanyDecisionState,
        privateCompanyId: string,
        playerId: string
    ): PrivateMarkerTerms | undefined
}

export interface PrivateMarkerTerms {
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
        stateWith(state, { trackStep }),
        {
            ...rules,
            allowance: terms.countsAsOrdinaryLay ? rules.allowance : () => ({ cost: 0 }),
            restriction: (_state, request) =>
                terms.locationIds.includes(request.locationId) &&
                terms.definitionIds.includes(request.definitionId)
                    ? terms.restriction?.(request)
                    : 'This private cannot place that tile here.',
            useful: terms.connected ? rules.useful : () => true,
            relabels: (locationId, definitionId) =>
                !!terms.relabels &&
                terms.locationIds.includes(locationId) &&
                terms.definitionIds.includes(definitionId),
            terrainCost: (constructionState, request, cost) =>
                terms.free
                    ? 0
                    : Math.max(
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
        privatePowerUsed(state, privateCompanyId)
    )
        return { reason: 'This private tile lay is unavailable.' }
    const construction = privateTrackConstruction(state, terms, track)
    if (!togetherLaysOpen(state, terms, construction))
        return { reason: 'These tiles are laid together, and one of them has no lay.' }
    return construction.evaluate(request)
}

/** Whether a power laid together may start: each of its open places has a lay. */
export function togetherLaysOpen(
    state: Pick<CompanyDecisionState, 'privateTrackLay'>,
    terms: PrivateTrackTerms,
    construction: TrackConstruction
): boolean {
    return (
        !terms.together ||
        !!state.privateTrackLay?.required ||
        terms.locationIds.every((locationId) => construction.choices(locationId).length > 0)
    )
}
