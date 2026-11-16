import {
    StationPlacement,
    getCompany,
    hasTurnMark,
    homeStationId,
    nextOperatingCompany,
    type HomeStationChoice,
    type FormationState,
    type MapStateData,
    type OperatingStationState,
    type StartHome,
    type StationRules
} from '@tabletop/18xx'
import { GaribaldiHomeLocationIds, GaribaldiId } from './companies.js'
import { Map1849 } from './map.js'
import { TileSet1849 } from './tiles.js'
import { requireState1849 } from './state.js'

/**
 * A Garibaldi that came with the Reale Società d'Affari chooses its home as it first operates,
 * among its cities with room (§8.1, §9.4.1).
 */
function garibaldiHomeChoice(stateObject: OperatingStationState): HomeStationChoice | undefined {
    const state = requireState1849(stateObject)
    if (nextOperatingCompany(state) !== GaribaldiId) return undefined
    const company = getCompany(state, GaribaldiId)
    const stationId = homeStationId(GaribaldiId)
    const station = state.stations.find((entry) => entry.id === stationId)
    if (!company.floated || station?.status !== 'available') return undefined
    const positions = garibaldiHomes(state, 0).map(({ locationId, nodeId }) => ({
        locationId,
        nodeId
    }))
    return positions.length ? { companyId: GaribaldiId, stationId, positions } : undefined
}

/** The operating turn's mark that its corporation used the SMS (§7.1). */
export const MarittimaTurnMark = 'marittima'

/** Whether the corporation used the SMS this turn. */
function usedMarittima(stateObject: object, companyId: string): boolean {
    const state = requireState1849(stateObject)
    return nextOperatingCompany(state) === companyId && hasTurnMark(state, MarittimaTurnMark)
}

// Stations are paid for as a corporation starts (§9.4), and it places one a turn (§10.4).
export const StationRules1849: StationRules = {
    map: Map1849,
    tileSet: TileSet1849,
    placementCost: () => 0,
    // The SMS's lay takes the turn's token step too, its own station or none (§7.1).
    placementLimit: (stateObject, companyId) => (usedMarittima(stateObject, companyId) ? 0 : 1),
    pendingHomes: () => [],
    homeChoice: garibaldiHomeChoice
}

/** The open cities the Garibaldi may choose for its home, for its token fee (§9.4.1). */
export function garibaldiHomes(state: FormationState & MapStateData, cost: number): StartHome[] {
    const placement = new StationPlacement(
        {
            ...state,
            stationStep: undefined
        },
        StationRules1849
    )
    return GaribaldiHomeLocationIds.flatMap((locationId) =>
        placement.mapState.tile(locationId).face.nodes.flatMap((node) => {
            const slot = placement.openSlots(GaribaldiId, locationId, node.id)[0]
            return slot === undefined ? [] : [{ locationId, nodeId: node.id, slot, cost }]
        })
    )
}
