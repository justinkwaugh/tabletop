import type { RouteRules } from '@tabletop/18xx'
import { passesGorgeStations } from './bridgeLease.js'
import { extendedDefinition } from './extensions.js'
import { ghostTownBonus } from './gold.js'
import { StCloudId } from './ids.js'
import { CanonCityLocationId, MapRoyalGorge, SilvercliffeLocationId } from './map.js'
import { GhostTownBonusId, StCloudBonusId } from './names.js'
import { ownsOpenPrivate } from './privateHoldings.js'
import { requireStateRoyalGorge } from './state.js'
import { TileSetRoyalGorge } from './tiles.js'
import { PhasesRoyalGorge, TrainDepotRoyalGorge, colorPhase, revenueMultiplier } from './trains.js'

export const StCloudBonus = 20

/** Where the St. Cloud Hotel stands: Silvercliffe, then Cañon City from the Brown phase (Y1). */
export function stCloudLocation(phaseId: string): string {
    return colorPhase(phaseId) === 'Yellow' || colorPhase(phaseId) === 'Green'
        ? SilvercliffeLocationId
        : CanonCityLocationId
}

function stCloudPays(state: object & { phaseId: string }, companyId: string, locationId: string) {
    return (
        ownsOpenPrivate(requireStateRoyalGorge(state), companyId, StCloudId) &&
        stCloudLocation(state.phaseId) === locationId
    )
}

export const RouteRulesRoyalGorge: RouteRules = {
    map: MapRoyalGorge,
    tileSet: TileSetRoyalGorge,
    depot: TrainDepotRoyalGorge,
    // Red areas pay the value of the newest colour of tile on sale.
    revenueStage: (state) => PhasesRoyalGorge.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    // A 6x2 doubles its stops; private and token bonuses are added after (RT-2).
    stopRevenue: (_state, _companyId, _center, printed, train) =>
        printed * revenueMultiplier(train.id),
    stopBonus: (state, _train, companyId, center) =>
        stCloudPays(state, companyId, center.locationId) ? StCloudBonus : 0,
    stopBonusSourceIds: (state, _train, companyId, center) =>
        stCloudPays(state, companyId, center.locationId) ? [StCloudBonusId] : [],
    hexBonus: (state, locationId, companyId) => ghostTownBonus(state, locationId, companyId),
    hexBonusSourceIds: (state, locationId, companyId) =>
        ghostTownBonus(state, locationId, companyId) ? [GhostTownBonusId] : [],
    extendedDefinition: (state, _companyId, train, definition) =>
        extendedDefinition(state, train, definition),
    passesStations: passesGorgeStations
}
