import * as Type from 'typebox'
import type { StockState } from '../stock/stockState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import { TrackLayDetails, type ConstructionState } from '../construction/trackConstruction.js'
import type { TrainState } from '../trains/train.js'
import type { PhaseState } from '../phases/phaseChange.js'
import { PurchaseOffer } from '../transfers/purchaseOffer.js'
const Id = Type.String({ minLength: 1 })
export const PrivateTrackLay = Type.Object(
    { privateCompanyId: Id, companyId: Id, playerId: Id },
    { additionalProperties: false }
)
export type PrivateTrackLay = Type.Static<typeof PrivateTrackLay>
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
    purchaseOffer: Type.Optional(PurchaseOffer),
    privateTrackLay: Type.Optional(PrivateTrackLay),
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
    return !!(state.purchaseOffer || state.privateTrackLay || state.trackConsent)
}
