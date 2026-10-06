import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { TrackLayDetails, type ConstructionState } from '../construction/trackConstruction.js'
import type { OperatingState } from '../operating/operatingSet.js'
import { isOperatingStep } from '../operating/operatingSteps.js'
import type { PhaseState } from '../phases/phaseChange.js'
import type { StockState } from '../stock/stockState.js'
import type { TrainState } from '../trains/train.js'
import {
    PendingPurchaseOffer,
    OrdinaryPendingPurchaseOffer,
    isCompanyPurchaseOffer
} from '../transfers/purchaseOffer.js'
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
export const PrivatePowerFields = { usedPrivatePowerIds: Type.Array(Id, { uniqueItems: true }) }
export const PrivateWindowFields = { privatePowerWindow: Type.Optional(PrivatePowerWindow) }
export const PrivateRequestFields = {
    privatePowerRequests: Type.Optional(Type.Array(Id, { uniqueItems: true }))
}
export const PurchaseOfferFields = { purchaseOffer: Type.Optional(OrdinaryPendingPurchaseOffer) }
export const CompanyAcquisitionOfferFields = { purchaseOffer: Type.Optional(PendingPurchaseOffer) }
export const PrivateTrackFields = { privateTrackLay: Type.Optional(PrivateTrackLay) }
export const PrivateStationFields = { privateStation: Type.Optional(PrivateStation) }
export const TrackConsentFields = { trackConsent: Type.Optional(TrackConsent) }
export const CompanyDecisionFields = {
    usedPrivatePowerIds: Type.Optional(PrivatePowerFields.usedPrivatePowerIds),
    ...PrivateWindowFields,
    ...PrivateRequestFields,
    ...PurchaseOfferFields,
    ...PrivateTrackFields,
    ...PrivateStationFields,
    ...TrackConsentFields
}
export type CompanyDecisionState = StockState &
    OperatingState &
    ConstructionState &
    TrainState &
    PhaseState &
    Omit<Type.Static<Type.TObject<typeof CompanyDecisionFields>>, 'purchaseOffer'> & {
        machineState: string
        purchaseOffer?: PendingPurchaseOffer
    }
export type PrivatePowerUsage = Pick<CompanyDecisionState, 'usedPrivatePowerIds'>

export function privatePowerUsed(state: PrivatePowerUsage, privateCompanyId: string): boolean {
    return state.usedPrivatePowerIds?.includes(privateCompanyId) ?? false
}

export function recordPrivatePowerUse(state: PrivatePowerUsage, privateCompanyId: string): void {
    assertExists(state.usedPrivatePowerIds, 'Consuming a private power requires usage tracking')
    state.usedPrivatePowerIds.push(privateCompanyId)
}

type PendingDecisions = Pick<
    CompanyDecisionState,
    'purchaseOffer' | 'privateTrackLay' | 'privateStation' | 'trackConsent'
>
/** The player who must resolve the pending company decision, if one is pending. */
export function pendingDecisionPlayerId(state: PendingDecisions): string | undefined {
    const playerIds = [
        state.purchaseOffer?.sellerPlayerId,
        state.privateTrackLay?.playerId,
        state.privateStation?.playerId,
        state.trackConsent?.details.consentPlayerId
    ].filter((playerId) => playerId !== undefined)
    assert(playerIds.length <= 1, 'Resolve the current company decision before starting another')
    return playerIds[0]
}
export function pendingCompanyDecision(state: PendingDecisions): boolean {
    return pendingDecisionPlayerId(state) !== undefined
}

export function validateCompanyDecisions(
    state: PendingDecisions &
        Pick<CompanyDecisionState, 'machineState' | 'privatePowerWindow'> & {
            players: readonly { playerId: string }[]
        }
): void {
    if (state.privatePowerWindow)
        assert(
            state.machineState === 'OperatingSet',
            'The private power window belongs between companies'
        )
    const playerId = pendingDecisionPlayerId(state)
    if (playerId === undefined) return
    assert(
        isOperatingStep(state.machineState) ||
            (state.machineState === 'StockRound' &&
                !!state.purchaseOffer &&
                !isCompanyPurchaseOffer(state.purchaseOffer)),
        'A pending decision requires its operating or stock-round window'
    )
    assert(
        state.players.some((player) => player.playerId === playerId),
        'Unknown player for the pending decision'
    )
}
