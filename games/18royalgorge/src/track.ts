import type { TrackRules } from '@tabletop/18xx'
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
    GreenGorgeTileIds,
    SalidaOneSpaceBrownId,
    SalidaTwoSpaceGreenId,
    SpecialTileIds,
    TileSetRoyalGorge,
    preservesStopsRoyalGorge,
    tileFaceRoyalGorge
} from './tiles.js'
import { PhasesRoyalGorge } from './trains.js'
import { treatySigned } from './debt.js'

/** Up to six lays or upgrades a turn, in any mix (TR-2). */
export const LaysPerTurn = 6

const GorgeTileIds = [GreenGorgeTileIds, BrownGorgeTileIds]

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
    placementRestriction(placement, before) {
        if (GorgeLocationIds.includes(placement.locationId)) {
            if (
                !GorgeTileIds.some(
                    (tiles) => tiles[placement.locationId] === placement.definitionId
                )
            )
                return 'Only the gorge’s own tiles upgrade the gorge.'
            if (placement.rotation !== 0) return 'The gorge lies only as the board prints it.'
        } else if (
            GorgeTileIds.some((tiles) => Object.values(tiles).includes(placement.definitionId))
        )
            return 'The gorge tiles belong to the Royal Gorge.'
        // An upgrade may not take away station spaces, even empty ones (Letter Tiles).
        if (
            before.placement?.definitionId === SalidaTwoSpaceGreenId &&
            placement.definitionId === SalidaOneSpaceBrownId
        )
            return 'An upgrade may not remove a station space.'
        return undefined
    },
    restriction(state, request) {
        if (SpecialTileIds.includes(request.definitionId))
            return 'Only an event or a private lays this tile.'
        if (GorgeLocationIds.includes(request.locationId) && !treatySigned(state.phaseId))
            return 'The Royal Gorge is closed until the Treaty of Boston.'
        return undefined
    },
    // The gorge is one tile in each colour: the treaty lays the green across all three hexes (DB-1),
    // and the brown, laid on one hex, lies across all three, for one steel and one lay (RG-1).
    companionTiles: (_state, details) => {
        const gorge = GorgeTileIds.find(
            (tiles) => tiles[details.locationId] === details.definitionId
        )
        return gorge
            ? Object.entries(gorge)
                  .filter(([locationId]) => locationId !== details.locationId)
                  .map(([locationId, definitionId]) => ({ locationId, definitionId, rotation: 0 }))
            : []
    },
    afterLay(state, details, _payer, ordinary) {
        const title = requireStateRoyalGorge(state)
        const face = tileFaceRoyalGorge(details.definitionId)
        // Ordinary lays buy steel; a private's free lay does not (B2).
        if (ordinary) buySteel(title, details.companyId, face.color)
        if (face.color === 'yellow') placeGold(title, details)
        return { payments: [], closedPrivateIds: [] }
    }
}
