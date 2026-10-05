import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction
} from '@tabletop/common'
import {
    RevenueCenter,
    OperatingSet,
    controllingOwner,
    nextOperatingCompany,
    privateOwningCompany,
    type CompanyDecisionState
} from '@tabletop/18xx'
import { PortSymbols } from './map.js'
import type { HydratedEighteenFortySixState } from './state.js'

export const RevenuePrivateId = Type.Union([
    Type.Literal('SC'),
    Type.Literal('MPC'),
    Type.Literal('BT')
])
export type RevenuePrivateId = Type.Static<typeof RevenuePrivateId>
const MarkerOwner = Type.Object(
    {
        privateCompanyId: RevenuePrivateId,
        companyId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
)
export const RevenueMarker = Type.Object(
    {
        ...MarkerOwner.properties,
        locationId: RevenueCenter.properties.locationId,
        setNumber: OperatingSet.properties.number,
        roundNumber: OperatingSet.properties.roundNumber
    },
    { additionalProperties: false }
)
export type RevenueMarker = Type.Static<typeof RevenueMarker>
export const RevenueMarkerFields = {
    revenueMarkers: Type.Array(RevenueMarker),
    pendingRevenueMarker: Type.Optional(MarkerOwner)
}
export type RevenueMarkerState = Type.Static<Type.TObject<typeof RevenueMarkerFields>>
export const RevenueMarkerLocations: Readonly<Record<RevenuePrivateId, readonly string[]>> = {
    SC: Object.keys(PortSymbols),
    MPC: ['I1', 'D6'],
    BT: ['H12']
}
export function isRevenuePrivate(id: string): id is RevenuePrivateId {
    return id === 'SC' || id === 'MPC' || id === 'BT'
}
export function revenueMarkerValue(privateId: RevenuePrivateId, locationId: string): number {
    return privateId === 'SC' ? 20 * PortSymbols[locationId] : privateId === 'MPC' ? 30 : 20
}
type MarkerState = CompanyDecisionState & RevenueMarkerState
export function revenueMarkerChoices(state: MarkerState, playerId: string) {
    const companyId = nextOperatingCompany(state)
    if (
        !companyId ||
        state.purchaseOffer ||
        !['I', 'II'].includes(state.phaseId) ||
        !state.activePlayerIds.includes(playerId) ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return []
    const pending = state.pendingRevenueMarker
    if (!pending && !['LayingTrack', 'RunningTrains'].includes(state.machineState)) return []
    return state.companies.flatMap(({ id: privateCompanyId }) => {
        if (!isRevenuePrivate(privateCompanyId)) return []
        if (
            privateOwningCompany(state, privateCompanyId) !== companyId ||
            (pending &&
                (pending.privateCompanyId !== privateCompanyId || pending.companyId !== companyId))
        )
            return []
        const previous = state.revenueMarkers.find(
            (marker) => marker.privateCompanyId === privateCompanyId
        )
        if (
            previous &&
            (privateCompanyId !== 'SC' ||
                (previous.setNumber === state.operatingSet?.number &&
                    previous.roundNumber === state.operatingSet.roundNumber))
        )
            return []
        return RevenueMarkerLocations[privateCompanyId]
            .filter((locationId) => locationId !== previous?.locationId)
            .map((locationId) => ({ privateCompanyId, companyId, locationId }))
    })
}

export const AssignRevenueMarker = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('AssignRevenueMarker'),
        privateCompanyId: RevenuePrivateId,
        locationId: Type.Optional(RevenueCenter.properties.locationId),
        metadata: Type.Optional(
            Type.Object(
                {
                    companyId: MarkerOwner.properties.companyId,
                    previous: Type.Optional(RevenueMarker),
                    marker: Type.Optional(RevenueMarker),
                    skipped: Type.Boolean()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export const AssignRevenueMarkerValidator = Compile(AssignRevenueMarker)
export type AssignRevenueMarker = Type.Static<typeof AssignRevenueMarker>
export function isAssignRevenueMarker(action: GameAction): action is AssignRevenueMarker {
    return AssignRevenueMarkerValidator.Check(action)
}
export class AssignRevenueMarkerAction extends HydratableAction<typeof AssignRevenueMarker> {
    declare playerId: string
    declare privateCompanyId: RevenuePrivateId
    declare locationId?: string
    declare metadata?: Type.Static<typeof AssignRevenueMarker>['metadata']
    constructor(data: Type.Static<typeof AssignRevenueMarker>) {
        super(data, AssignRevenueMarkerValidator)
    }
    isValid(state: HydratedEighteenFortySixState): boolean {
        if (
            this.source !== ActionSource.User ||
            state.purchaseOffer ||
            !state.activePlayerIds.includes(this.playerId)
        )
            return false
        if (this.locationId !== undefined)
            return revenueMarkerChoices(state, this.playerId).some(
                (choice) =>
                    choice.privateCompanyId === this.privateCompanyId &&
                    choice.locationId === this.locationId
            )
        const pending = state.pendingRevenueMarker
        return (
            pending?.privateCompanyId === this.privateCompanyId &&
            controllingOwner(state, pending.companyId)?.playerId === this.playerId
        )
    }
    apply(state: HydratedEighteenFortySixState): void {
        assert(
            this.isValid(state),
            'Choose an available revenue marker placement or skip its purchase opportunity'
        )
        const companyId = nextOperatingCompany(state)
        const set = state.operatingSet
        assertExists(companyId, 'Revenue markers belong to the operating company')
        assertExists(set, 'Revenue markers are assigned during an operating round')
        const previous = state.revenueMarkers.find(
            (marker) => marker.privateCompanyId === this.privateCompanyId
        )
        const marker: RevenueMarker | undefined =
            this.locationId === undefined
                ? undefined
                : {
                      privateCompanyId: this.privateCompanyId,
                      companyId,
                      locationId: this.locationId,
                      setNumber: set.number,
                      roundNumber: set.roundNumber
                  }
        if (marker)
            state.revenueMarkers = [
                ...state.revenueMarkers.filter(
                    (item) => item.privateCompanyId !== this.privateCompanyId
                ),
                marker
            ]
        delete state.pendingRevenueMarker
        this.metadata = {
            companyId,
            ...(previous ? { previous: { ...previous } } : {}),
            ...(marker ? { marker: { ...marker } } : {}),
            skipped: !marker
        }
    }
}
