import { isOperatingStep } from '../operating/operatingSteps.js'
import * as Type from 'typebox'
import type { StockState } from '../stock/stockState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import { TrackLayDetails, type ConstructionState } from '../construction/trackConstruction.js'
import type { TrainState } from '../trains/train.js'
import type { PhaseState } from '../phases/phaseChange.js'
import { PendingPurchaseOffer, isCompanyPurchaseOffer } from '../transfers/purchaseOffer.js'
import { assert } from '@tabletop/common'
const Id = Type.String({ minLength: 1 })
export const PrivateTrackLay = Type.Object(
    { privateCompanyId: Id, companyId: Id, playerId: Id },
    { additionalProperties: false }
)
export type PrivateTrackLay = Type.Static<typeof PrivateTrackLay>
export const PrivateStation = Type.Object(
    { privateCompanyId: Id, companyId: Id, playerId: Id, locationId: Id },
    { additionalProperties: false }
)
export type PrivateStation = Type.Static<typeof PrivateStation>
export const TrackConsent = Type.Object(
    { id: Id, playerId: Id, details: TrackLayDetails },
    { additionalProperties: false }
)
export type TrackConsent = Type.Static<typeof TrackConsent>
export const PrivatePowerWindow = Type.Object(
    { companyId: Id, passedPlayerIds: Type.Array(Id, { uniqueItems: true }) },
    { additionalProperties: false }
)
export type PrivatePowerWindow = Type.Static<typeof PrivatePowerWindow>
export const CompanyDecisionFields = {
    privatePowerWindow: Type.Optional(PrivatePowerWindow),
    privatePowerRequests: Type.Optional(Type.Array(Id, { uniqueItems: true })),
    purchaseOffer: Type.Optional(PendingPurchaseOffer),
    privateTrackLay: Type.Optional(PrivateTrackLay),
    privateStation: Type.Optional(PrivateStation),
    trackConsent: Type.Optional(TrackConsent),
    usedPrivatePowerIds: Type.Array(Id, { uniqueItems: true })
}
export type CompanyDecisionState = StockState &
    OperatingState &
    ConstructionState &
    TrainState &
    PhaseState &
    Type.Static<Type.TObject<typeof CompanyDecisionFields>> & { machineState: string }
export function pendingCompanyDecision(state: CompanyDecisionState): boolean {
    return !!(
        state.purchaseOffer ||
        state.privateTrackLay ||
        state.privateStation ||
        state.trackConsent
    )
}

export function validateCompanyDecisions(
    state: Pick<
        CompanyDecisionState,
        | 'machineState'
        | 'privatePowerWindow'
        | 'purchaseOffer'
        | 'privateTrackLay'
        | 'privateStation'
        | 'trackConsent'
    > & { players: readonly { playerId: string }[] }
): void {
    if (state.privatePowerWindow)
        assert(
            state.machineState === 'OperatingSet',
            'The private power window belongs between companies'
        )
    const pending = [
        state.purchaseOffer,
        state.privateTrackLay,
        state.privateStation,
        state.trackConsent
    ].filter(Boolean)
    assert(pending.length <= 1, 'Resolve the current company decision before starting another')
    if (!pending.length) return
    assert(
        isOperatingStep(state.machineState) ||
            (state.machineState === 'StockRound' &&
                !!state.purchaseOffer &&
                !isCompanyPurchaseOffer(state.purchaseOffer)),
        'A pending decision requires its operating or stock-round window'
    )
    const playerId =
        state.purchaseOffer?.sellerPlayerId ??
        state.privateTrackLay?.playerId ??
        state.privateStation?.playerId ??
        state.trackConsent?.details.consentPlayerId
    assert(
        state.players.some((player) => player.playerId === playerId),
        'Unknown player for the pending decision'
    )
}
