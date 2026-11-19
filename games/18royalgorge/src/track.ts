import type { ConstructionState, TrackRules } from '@tabletop/18xx'
import { PrisonId } from './ids.js'
import { placeGold } from './gold.js'
import {
    GorgeLocationIds,
    MapRoyalGorge,
    SulphurSpringsLabel,
    SulphurSpringsLocationId,
    homeLocationRoyalGorge
} from './map.js'
import { ownsOpenPrivate } from './privateHoldings.js'
import { requireStateRoyalGorge } from './state.js'
import { SteelRecipient, buySteel, nextSteel } from './steel.js'
import {
    BrownGorgeTileIds,
    SalidaOneSpaceBrownId,
    SalidaTwoSpaceGreenId,
    SpecialTileIds,
    TileSetRoyalGorge,
    mapStateRoyalGorge,
    preservesStopsRoyalGorge,
    tileFaceRoyalGorge
} from './tiles.js'
import { PhasesRoyalGorge } from './trains.js'
import { treatySigned } from './debt.js'

/** Up to six lays or upgrades a turn, in any mix (TR-2). */
export const LaysPerTurn = 6

function tileAt(state: ConstructionState, locationId: string) {
    return mapStateRoyalGorge(state).tile(locationId)
}

export const TrackRulesRoyalGorge: TrackRules = {
    map: MapRoyalGorge,
    tileSet: TileSetRoyalGorge,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => PhasesRoyalGorge.phase(state.phaseId).tileColors,
    // Each lay buys a steel cube from CF&I, of the tile's colour (Rule 5).
    allowance(state, color) {
        const step = state.trackStep
        if (!step) return { reason: 'It is not a track step.' }
        if (step.lays.length >= LaysPerTurn)
            return { reason: `${LaysPerTurn} lays or upgrades are allowed per turn.` }
        const { price } = nextSteel(state, step.companyId, color)
        return price ? { cost: price, recipient: SteelRecipient } : { cost: 0 }
    },
    preservesStops: preservesStopsRoyalGorge,
    upgradesWithinColor: (locationId, before, after) =>
        locationId === SulphurSpringsLocationId &&
        after.labels.includes(SulphurSpringsLabel) &&
        before.color === after.color,
    // A company need only be able to run on some of the new track (Rule 4; OQ-1).
    useful: ({ home, connected }) => home || connected,
    homeLocations: (companyId) => [homeLocationRoyalGorge(companyId)],
    // The prison's labour halves the terrain of its railroad's lays (Y5).
    terrainCost: (state, request, cost) =>
        ownsOpenPrivate(state, request.companyId, PrisonId) ? Math.floor(cost / 2) : cost,
    restriction(state, request) {
        if (SpecialTileIds.includes(request.definitionId))
            return 'Only an event or a private lays this tile.'
        const gorgeTile = BrownGorgeTileIds[request.locationId]
        if (GorgeLocationIds.includes(request.locationId)) {
            if (!treatySigned(state.phaseId))
                return 'The Royal Gorge is closed until the Treaty of Boston.'
            if (gorgeTile !== request.definitionId)
                return 'Only the brown gorge upgrades the gorge.'
            if (request.rotation !== 0) return 'The gorge lies only as the board prints it.'
        } else if (Object.values(BrownGorgeTileIds).includes(request.definitionId))
            return 'The gorge tiles belong to the Royal Gorge.'
        // An upgrade may not take away station spaces, even empty ones (Letter Tiles).
        if (
            tileAt(state, request.locationId).placement?.definitionId === SalidaTwoSpaceGreenId &&
            request.definitionId === SalidaOneSpaceBrownId
        )
            return 'An upgrade may not remove a station space.'
        return undefined
    },
    // The brown gorge is one tile: laid on one hex, it lies across all three, for one steel and
    // one lay (RG-1).
    companionTiles: (_state, details) =>
        BrownGorgeTileIds[details.locationId] === details.definitionId
            ? Object.entries(BrownGorgeTileIds)
                  .filter(([locationId]) => locationId !== details.locationId)
                  .map(([locationId, definitionId]) => ({ locationId, definitionId, rotation: 0 }))
            : [],
    afterLay(state, details, _payer, ordinary) {
        const title = requireStateRoyalGorge(state)
        const face = tileFaceRoyalGorge(details.definitionId)
        // Ordinary lays buy steel; a private's free lay does not (B2).
        if (ordinary) buySteel(title, details.companyId, face.color)
        if (face.color === 'yellow') placeGold(title, details)
        return { payments: [], closedPrivateIds: [] }
    }
}
