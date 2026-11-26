import {
    laidTileFace,
    sameStopCounts,
    type ConstructionState,
    type TrackRules
} from '@tabletop/18xx'
import { CoalAccess, takeTunnelCoal } from './coal.js'
import { ExtraYellowCompanyIds, PrivateCatalog1828 } from './companies.js'
import { CobourgRailwayId, CpId, EkId } from './ids.js'
import { Map1828, TunnelLocationId } from './map.js'
import { constituents } from './systems.js'
import { TileSet1828, TunnelTileId } from './tiles.js'
import { Phases1828 } from './trains.js'

/** The extra yellow tile the B&M and NYH, or a system with either, may lay for $40 (§8.3.1). */
export const ExtraYellowPrice = 40

function turnLays(state: ConstructionState) {
    const step = state.trackStep
    return [...(step?.lays ?? []), ...(step?.extraLays ?? [])]
}

function upgraded(state: ConstructionState): boolean {
    return (state.trackStep?.lays ?? []).some(
        (lay) => laidTileFace(state, TrackRules1828, lay).color !== 'yellow'
    )
}

export function laidErieKalamazooExtra(state: ConstructionState): boolean {
    return !!state.trackStep?.extraLays?.some((lay) => lay.privateCompanyId === EkId)
}

/**
 * The company's lays this round (§8.3.1, §13.3.2): one, or two for a system, never two upgrades;
 * then a $40 yellow for each of the B&M and NYH it stands for, if it does not upgrade.
 */
function allowance(
    state: ConstructionState,
    color: string,
    upgrade = false
): { cost: number } | { reason: string } {
    const companyId = state.trackStep?.companyId
    if (!companyId) return { reason: 'No company is building track.' }
    const companies = constituents(state, companyId)
    const ordinary = companies.length
    const extra = companies.filter((id) => ExtraYellowCompanyIds.includes(id)).length
    const lays = state.trackStep?.lays.length ?? 0
    if (upgrade) {
        if (upgraded(state)) return { reason: 'A company upgrades one tile a round.' }
        if (lays >= ordinary) return { reason: 'The company has laid all its tiles this round.' }
        if (laidErieKalamazooExtra(state))
            return { reason: 'No upgrade in a round the Erie & Kalamazoo’s extra tile is laid.' }
        return { cost: 0 }
    }
    if (color !== 'yellow') return { reason: 'Only yellow tiles are laid on empty hexes.' }
    if (lays < ordinary) return { cost: 0 }
    if (lays < ordinary + extra && !upgraded(state)) return { cost: ExtraYellowPrice }
    return { reason: 'The company has laid all its tiles this round.' }
}

export const TrackRules1828: TrackRules = {
    map: Map1828,
    tileSet: TileSet1828,
    colorOrder: ['white', 'yellow', 'green', 'brown'],
    availableColors: (state) => Phases1828.phase(state.phaseId).tileColors,
    allowance,
    preservesStops: sameStopCounts,
    // Track is permissive: the tile must join the company's network (§14.3.1).
    useful: ({ home, connected }) => home || connected,
    homeLocations: (companyId) => Map1828.reservedLocationIds(companyId),
    stopAllowed: (state, companyId, center) => CoalAccess.open(state, companyId, center),
    placementRestriction: (placement) =>
        placement.locationId === TunnelLocationId && placement.definitionId !== TunnelTileId
            ? 'Only tile #4 may be laid in the Virginia Coalfields Tunnel.'
            : undefined,
    restriction(state, request) {
        const blocker = PrivateCatalog1828.blockedBy(state, request.locationId)
        if (blocker && !(blocker.id === CpId && request.companyId === CobourgRailwayId))
            return 'A player-owned private company blocks this hex.'
        if (turnLays(state).some((lay) => lay.locationId === request.locationId))
            return 'A company cannot upgrade a tile it laid or upgraded this round.'
        return undefined
    },
    afterLay(state, details) {
        if (details.locationId === TunnelLocationId) takeTunnelCoal(state, details.companyId)
        return { payments: [], closedPrivateIds: [] }
    }
}
