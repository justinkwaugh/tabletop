import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    StationPosition,
    actsFor,
    getCompany,
    homeStationId,
    neutralStation,
    pendingCompanyDecision,
    privateOwner,
    privatePowerUsed,
    privateTrackConstruction,
    recordPrivatePowerUse,
    sameStationPosition,
    stepAction,
    titleAction,
    type CompanyDecisionState,
    type PrivateTrackTerms,
    type EighteenXXMachineState,
    type Station,
    type StepAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { NwrId } from './companies.js'
import { Map1882, RebellionCities, RebellionLocations } from './map.js'
import { placedNeutralStations, supplyNeutralStation } from './neutralStations.js'
import type { HydratedState1882, State1882 } from './state.js'
import { openCityPositions } from './stations.js'
import { TileSet1882 } from './tiles.js'
import { TrackRules1882 } from './track.js'

const Id = Type.String({ minLength: 1 })

export const RebellionMoveDetails = Type.Object(
    {
        companyId: Id,
        stationId: Id,
        from: StationPosition,
        to: StationPosition,
        /** The supply's neutral station left in a moved home's place (§7.1.3). */
        neutralStationId: Type.Optional(Id),
        /** No tile could be laid or upgraded in the destination hex. */
        noLay: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type RebellionMoveDetails = Type.Static<typeof RebellionMoveDetails>

const MoveRebellionStationAction = titleAction('MoveRebellionStation', {
    stationId: Id,
    position: StationPosition,
    metadata: Type.Optional(RebellionMoveDetails)
})
export const MoveRebellionStation = MoveRebellionStationAction.schema
export type MoveRebellionStation = Type.Static<typeof MoveRebellionStation>
export const isMoveRebellionStation = MoveRebellionStationAction.is

/** The steps of a turn in which the power may be used: any but sharing out its earnings. */
export const RebellionMoveStates: readonly EighteenXXMachineState[] = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'BuyingTrains'
]

/** The company that may move a station with the North-West Rebellion Company now (§7.1.3). */
export function rebellionMover(state: State1882, playerId: string): string | undefined {
    if (
        !RebellionMoveStates.some((step) => step === state.machineState) ||
        pendingCompanyDecision(state)
    )
        return undefined
    if (getCompany(state, NwrId).closed || privatePowerUsed(state, NwrId)) return undefined
    const owner = privateOwner(state, NwrId)
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    return owner?.kind === 'company' &&
        owner.companyId === companyId &&
        state.activePlayerIds.includes(playerId) &&
        actsFor(state, playerId, companyId)
        ? companyId
        : undefined
}

/**
 * The company's stations it may move: its own, outside the rebellion hexes, and its home only
 * where no neutral station shares the home hex (§7.1.3). Neutral stations are nobody's to move,
 * the Canadian National's included.
 */
export function movableStations(state: State1882, companyId: string): Station[] {
    return state.stations.filter((station) => {
        if (
            station.status !== 'placed' ||
            station.companyId !== companyId ||
            neutralStation(Map1882, station.id)
        )
            return false
        const { locationId } = station.position
        if (RebellionLocations.includes(locationId)) return false
        return (
            station.id !== homeStationId(companyId) ||
            !placedNeutralStations(state).some(
                (neutral) => neutral.position.locationId === locationId
            )
        )
    })
}

/** The open rebellion cities the company's station may move to (§7.1.3). */
export function rebellionDestinations(state: State1882, companyId: string): StationPosition[] {
    return openCityPositions(state, companyId, RebellionCities)
}

export function rebellionMoveReason(
    state: State1882,
    playerId: string,
    request: Pick<MoveRebellionStation, 'stationId' | 'position'>
): string | undefined {
    const companyId = rebellionMover(state, playerId)
    if (!companyId) return 'The North-West Rebellion Company’s power cannot be used now.'
    if (!movableStations(state, companyId).some((station) => station.id === request.stationId))
        return 'Choose a station outside the rebellion hexes.'
    if (
        !rebellionDestinations(state, companyId).some((position) =>
            sameStationPosition(position, request.position)
        )
    )
        return 'Choose an open city in a rebellion hex.'
    return undefined
}

/** The extra lay or upgrade in the destination hex, while it is pending (§7.1.3). */
export function rebellionTrackTerms(
    state: Pick<CompanyDecisionState, 'privateTrackLay' | 'companies' | 'certificates'>,
    privateCompanyId: string,
    playerId: string
): PrivateTrackTerms | undefined {
    const pending = state.privateTrackLay
    const owner = privateOwner(state, NwrId)
    if (
        privateCompanyId !== NwrId ||
        pending?.privateCompanyId !== NwrId ||
        pending.playerId !== playerId ||
        !pending.locationId ||
        owner?.kind !== 'company'
    )
        return undefined
    return {
        companyId: owner.companyId,
        locationIds: [pending.locationId],
        definitionIds: TileSet1882.definitions.map((definition) => definition.id),
        payer: { kind: 'company', companyId: owner.companyId },
        connected: false
    }
}

class HydratedMoveRebellionStation extends MoveRebellionStationAction.Base {
    declare type: 'MoveRebellionStation'
    declare playerId: string
    declare stationId: string
    declare position: StationPosition
    declare metadata?: RebellionMoveDetails
    isValid(state: HydratedState1882): boolean {
        return this.source === ActionSource.User && !rebellionMoveReason(state, this.playerId, this)
    }
    apply(state: HydratedState1882): void {
        const reason = rebellionMoveReason(state, this.playerId, this)
        assert(this.source === ActionSource.User && !reason, reason ?? 'Invalid station move')
        const companyId = rebellionMover(state, this.playerId)
        assertExists(companyId, 'The operating company owns the power')
        const moved = state.stations.find((station) => station.id === this.stationId)
        assert(moved?.status === 'placed', 'The moved station is on the board')
        const from = moved.position
        // A moved home leaves the supply's neutral station in its place (§7.1.3).
        const neutral =
            moved.id === homeStationId(companyId) ? supplyNeutralStation(state) : undefined
        state.stations = state.stations.map((station) => {
            if (station.id === moved.id) return { ...moved, position: { ...this.position } }
            if (station.id === neutral?.id)
                return {
                    id: station.id,
                    companyId: station.companyId,
                    status: 'placed',
                    position: { ...from }
                }
            return station
        })
        state.privateTrackLay = {
            privateCompanyId: NwrId,
            playerId: this.playerId,
            locationId: this.position.locationId
        }
        const terms = rebellionTrackTerms(state, NwrId, this.playerId)
        assertExists(terms, 'The destination hex has its extra lay')
        const noLay = !privateTrackConstruction(state, terms, TrackRules1882).hasChoice(
            this.position.locationId
        )
        if (noLay) {
            delete state.privateTrackLay
            recordPrivatePowerUse(state, NwrId)
        }
        this.metadata = {
            companyId,
            stationId: moved.id,
            from: { ...from },
            to: { ...this.position },
            ...(neutral ? { neutralStationId: neutral.id } : {}),
            ...(noLay ? { noLay: true as const } : {})
        }
    }
}

export const RebellionMoveActions1882 = [
    MoveRebellionStationAction.define((action) => new HydratedMoveRebellionStation(action))
]

const isHydratedMove = (
    action: Parameters<StepAction<HydratedState1882>['isValid']>[0]
): action is HydratedMoveRebellionStation => action instanceof HydratedMoveRebellionStation

export const MoveRebellionStationStep: StepAction<HydratedState1882> = stepAction(
    'MoveRebellionStation',
    isHydratedMove,
    (state, playerId) => {
        const companyId = rebellionMover(state, playerId)
        return (
            !!companyId &&
            movableStations(state, companyId).length > 0 &&
            rebellionDestinations(state, companyId).length > 0
        )
    }
)
