import { assertExists } from '@tabletop/common'
import {
    HomeStationChoiceHandler,
    HydratedChooseHomeStation,
    RailwayMapState,
    controllingOwner,
    getCompany,
    hasLegalPrivateTrackUse,
    homeStationId,
    nextOperatingCompany,
    reservationFulfilled,
    type HomeStation,
    type HomeStationChoice,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
import { CoalAccess } from './coal.js'
import { StationPrice1828 } from './companies.js'
import { CobourgRailwayId, DhId } from './ids.js'
import { ErieHomeLocationId, Map1828 } from './map.js'
import { PrivatePowerRules1828 } from './privatePowers.js'
import { requireState1828, type StateHandler1828 } from './state.js'
import { TileSet1828 } from './tiles.js'
import { TrackRules1828 } from './track.js'

/** A home hex awaiting its company's station: one city, or a choice once the hex has track. */
type PendingHome = { locationId: string; nodeIds: string[]; tracked: boolean }

/**
 * The operating company's homes not yet placed (§8.3): a system has two. A home of several
 * reserved cities, the Erie's Buffalo/Dunkirk, waits for track there (§13.3.2).
 */
function pendingHomeHexes(
    state: OperatingStationState,
    companyId = nextOperatingCompany(state)
):
    | {
          companyId: string
          stationIds: string[]
          homes: PendingHome[]
      }
    | undefined {
    if (!companyId || companyId === CobourgRailwayId) return undefined
    const company = getCompany(state, companyId)
    if (!company.floated || company.closed) return undefined
    const reservations = state.stationReservations.filter(
        (reservation) =>
            reservation.companyId === companyId &&
            !reservationFulfilled(state, reservation, StationRules1828)
    )
    const locationIds = [...new Set(reservations.map((reservation) => reservation.locationId))]
    const mapState = new RailwayMapState(Map1828, TileSet1828, state.tileInventory)
    const homes = locationIds.flatMap((locationId): PendingHome[] => {
        const placedThere = state.stations.some(
            (station) =>
                station.companyId === companyId &&
                station.status === 'placed' &&
                station.position.locationId === locationId
        )
        if (placedThere) return []
        const face = mapState.tile(locationId).face
        return [
            {
                locationId,
                nodeIds: reservations
                    .filter((reservation) => reservation.locationId === locationId)
                    .map((reservation) => reservation.nodeId),
                tracked: face.paths.length > 0
            }
        ]
    })
    const available = state.stations.filter(
        (station) => station.companyId === companyId && station.status === 'available'
    )
    const stationIds = [
        ...available.filter((station) => station.id === homeStationId(companyId)),
        ...available.filter((station) => station.id !== homeStationId(companyId))
    ].map((station) => station.id)
    return { companyId, stationIds, homes }
}

/**
 * The company whose home is Buffalo/Dunkirk, when a tile has just gone there: having floated, it
 * places its home at once, on any company's turn (§13.3.2).
 */
function companyAwaitingErieHome(state: OperatingStationState): string | undefined {
    const title = requireState1828(state)
    if (
        title.machineState !== 'LayingTrack' ||
        !title.trackStep?.lays.some((lay) => lay.locationId === ErieHomeLocationId)
    )
        return undefined
    return state.stationReservations.find(
        (reservation) =>
            reservation.locationId === ErieHomeLocationId &&
            !reservationFulfilled(state, reservation, StationRules1828)
    )?.companyId
}

function homeChoiceFor(state: OperatingStationState, companyId?: string) {
    const pending = pendingHomeHexes(state, companyId)
    if (!pending) return undefined
    const choice = pending.homes.find((home) => home.nodeIds.length > 1 && home.tracked)
    const singles = pending.homes.filter((home) => home.nodeIds.length === 1).length
    const stationId = pending.stationIds[singles]
    return choice && stationId
        ? {
              companyId: pending.companyId,
              stationId,
              positions: choice.nodeIds.map((nodeId) => ({
                  locationId: choice.locationId,
                  nodeId
              }))
          }
        : undefined
}

export const StationRules1828: StationRules = {
    map: Map1828,
    tileSet: TileSet1828,
    placementCost: () => StationPrice1828,
    // One station a round besides homes; the C&P places none (§8.3.2, §13.2.2.5).
    placementLimit: (_state, companyId) => (companyId === CobourgRailwayId ? 0 : 1),
    stopAllowed: (state, companyId, center) => CoalAccess.open(state, companyId, center),
    // The D&H's power is usable in this step too, so the step waits while it could be (§13.2.2.4).
    holdsStationStep(state, companyId) {
        const directorId = controllingOwner(state, companyId)?.playerId
        return (
            !!directorId &&
            hasLegalPrivateTrackUse(
                requireState1828(state),
                DhId,
                directorId,
                PrivatePowerRules1828,
                TrackRules1828
            )
        )
    },
    pendingHomes(state): HomeStation[] {
        const pending = pendingHomeHexes(state)
        if (!pending) return []
        const placed = pending.homes.filter((home) => home.nodeIds.length === 1)
        return placed.flatMap((home, index) => {
            const stationId = pending.stationIds[index]
            return stationId
                ? [{ stationId, locationId: home.locationId, nodeId: home.nodeIds[0] }]
                : []
        })
    },
    // The Erie chooses its city in Buffalo/Dunkirk once a tile is there (§13.3.2).
    homeChoice(state): HomeStationChoice | undefined {
        return homeChoiceFor(state) ?? homeChoiceFor(state, companyAwaitingErieHome(state))
    }
}

/**
 * The director of the company with Buffalo/Dunkirk as its home chooses its city as soon as a tile
 * goes there, and the operating company's track step then goes on (§13.3.2).
 */
export function placesErieHome(handler: StateHandler1828): StateHandler1828 {
    const choosing = new HomeStationChoiceHandler(handler, StationRules1828, 'LayingTrack')
    return {
        isValidAction: (action, context) => choosing.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            choosing.validActionsForPlayer(playerId, context),
        enter: (context) => choosing.enter(context),
        onAction(action, context) {
            const next = choosing.onAction(action, context)
            if (action instanceof HydratedChooseHomeStation) {
                const state = context.gameState
                const turn = state.turnManager.currentTurn()
                assertExists(turn, 'A company laying track is on its turn')
                state.activePlayerIds = [turn.playerId]
            }
            return next
        }
    }
}
