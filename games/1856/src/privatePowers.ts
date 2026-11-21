import {
    EighteenXXTransferTiming,
    RailwayMapState,
    StationPlacement,
    cityIsBlocked,
    closePrivate,
    companyStationCenters,
    controllingOwner,
    getCompany,
    privateOwningCompany,
    privateTokenStationId,
    reachRoutes,
    rotateTileFace,
    privatePowerUsed,
    type CompanyDecisionState,
    type PrivatePowerRules,
    type PrivateTrackTerms
} from '@tabletop/18xx'
import { CanadaCompanyId, ShippingId, WaterlooId } from './companies.js'
import {
    CanadaCompanyLocationId,
    KitchenerLocationId,
    Map1856,
    PortLocationIds1856
} from './map.js'
import { PortMarkerKind, requireState1856 } from './state.js'
import { StationRules1856 } from './stations.js'
import { TileSet1856 } from './tiles.js'
import { PrivatePurchasePhaseIds } from './trains.js'

/** The face ids of a printed tile number in the manifest. */
function printedTiles(printedNumber: string): string[] {
    return TileSet1856.definitions
        .filter((definition) => definition.printedNumber === printedNumber)
        .map((definition) => definition.id)
}

/** The company operating now, while the player is its president and it owns the private. */
function owningOperatingCompany(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): string | undefined {
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    if (
        !companyId ||
        getCompany(state, privateCompanyId).closed ||
        privateOwningCompany(state, privateCompanyId) !== companyId ||
        controllingOwner(state, companyId)?.playerId !== playerId
    )
        return undefined
    return companyId
}

/**
 * The Waterloo & Saugeen lays the Kitchener tile, if none is laid, in place of its owner's lay
 * and without a route there (Waterloo & Saugeen Railway Co.).
 */
function waterlooTrack(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = owningOperatingCompany(state, WaterlooId, playerId)
    if (
        !companyId ||
        privatePowerUsed(state, WaterlooId) ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId ||
        state.trackStep.lays.length > 0 ||
        state.tileInventory.placements[KitchenerLocationId]
    )
        return undefined
    return {
        companyId,
        locationIds: [KitchenerLocationId],
        definitionIds: printedTiles('59'),
        payer: { kind: 'company', companyId },
        connected: false,
        countsAsOrdinaryLay: true,
        reusable: true
    }
}

/**
 * The Canada Company lays a tile in its hex besides its owner's lay and without a route there;
 * the private stays open (The Canada Company).
 */
function canadaCompanyTrack(
    state: CompanyDecisionState,
    playerId: string
): PrivateTrackTerms | undefined {
    const companyId = owningOperatingCompany(state, CanadaCompanyId, playerId)
    if (
        !companyId ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.companyId !== companyId ||
        state.tileInventory.placements[CanadaCompanyLocationId]
    )
        return undefined
    return {
        companyId,
        locationIds: [CanadaCompanyLocationId],
        definitionIds: TileSet1856.definitions.map((definition) => definition.id),
        payer: { kind: 'company', companyId },
        connected: false,
        reusable: true
    }
}

/**
 * The Waterloo & Saugeen's free station in either city of Kitchener with a space, in place of
 * its owner's station for the turn and without a route there.
 */
function waterlooStations(state: CompanyDecisionState, playerId: string) {
    const companyId = owningOperatingCompany(state, WaterlooId, playerId)
    if (!companyId || privatePowerUsed(state, WaterlooId)) return undefined
    // It takes the place of the turn's station, so it comes no later than the station step.
    if (state.machineState !== 'LayingTrack' && state.machineState !== 'PlacingStation')
        return undefined
    // It places one of the company's own markers, so one must be left (ST: 9235).
    if (!privateTokenStationId(state, companyId)) return undefined
    const step = requireState1856(state).stationStep
    if (step?.companyId === companyId && step.placedStationIds.length) return undefined
    const mapState = new RailwayMapState(Map1856, TileSet1856, state.tileInventory)
    const placement = new StationPlacement(state, StationRules1856)
    const positions = mapState
        .tile(KitchenerLocationId)
        .face.nodes.filter((node) => node.kind === 'city')
        .flatMap((node) =>
            placement
                .openSlots(companyId, KitchenerLocationId, node.id)
                .map((slot) => ({ locationId: KitchenerLocationId, nodeId: node.id, slot }))
        )
        .filter(
            (position) =>
                !state.stations.some(
                    (station) =>
                        station.companyId === companyId &&
                        station.status === 'placed' &&
                        station.position.locationId === position.locationId &&
                        station.position.nodeId === position.nodeId
                )
        )
    return positions.length ? { companyId, positions } : undefined
}

/**
 * The cities and small cities with an anchor the company's trains can reach: the port goes on
 * one of them, never on a red area (Great Lakes Shipping Company; designer, 2000), and on one
 * small city of a pair ("any one city").
 */
function reachablePorts(
    state: CompanyDecisionState,
    companyId: string
): { locationId: string; nodeId: string }[] {
    const mapState = new RailwayMapState(Map1856, TileSet1856, state.tileInventory)
    const reached = new Set<string>()
    reachRoutes(
        Map1856,
        (locationId) => {
            const tile = mapState.tile(locationId)
            return rotateTileFace(tile.face, tile.rotation)
        },
        companyStationCenters(state, companyId),
        (locationId, node) => cityIsBlocked(state, Map1856, companyId, locationId, node),
        {
            reached(locationId, endpoint) {
                if (endpoint.kind === 'node') reached.add(`${locationId} ${endpoint.nodeId}`)
            }
        }
    )
    return PortLocationIds1856.flatMap((locationId) =>
        mapState
            .tile(locationId)
            .face.nodes.filter(
                (node) =>
                    (node.kind === 'city' || node.kind === 'town') &&
                    reached.has(`${locationId} ${node.id}`)
            )
            .map((node) => ({ locationId, nodeId: node.id }))
    )
}

export const PrivatePowerRules1856: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId === WaterlooId) return waterlooTrack(state, playerId)
        if (privateCompanyId === CanadaCompanyId) return canadaCompanyTrack(state, playerId)
        return undefined
    },
    afterTrackLay(stateObject, privateCompanyId) {
        if (privateCompanyId === WaterlooId) requireState1856(stateObject).waterlooLaid = true
        return { payments: [], closedPrivateIds: [] }
    },
    earlyTrainCompany: () => undefined,
    tokenTerms: (state, privateCompanyId, playerId) =>
        privateCompanyId === WaterlooId ? waterlooStations(state, playerId) : undefined,
    // In phases 3 and 4 the owning company places the port token in a place with an anchor, in
    // its turn; placing it closes the private (Great Lakes Shipping Company).
    markerTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== ShippingId) return undefined
        if (!PrivatePurchasePhaseIds.includes(state.phaseId)) return undefined
        const companyId = owningOperatingCompany(state, privateCompanyId, playerId)
        if (!companyId) return undefined
        const stops = reachablePorts(state, companyId)
        return {
            kind: PortMarkerKind,
            locationIds: [...new Set(stops.map((stop) => stop.locationId))],
            stops
        }
    },
    afterMarker(stateObject, privateCompanyId, locationId, nodeId) {
        const state = requireState1856(stateObject)
        const companyId = privateOwningCompany(state, privateCompanyId)
        if (privateCompanyId !== ShippingId || !companyId || !nodeId) return
        state.port = { companyId }
        closePrivate(state, privateCompanyId)
    }
}
