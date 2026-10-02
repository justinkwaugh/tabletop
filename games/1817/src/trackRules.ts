import {
    getCompany,
    locationMarkers,
    privateOwner,
    privateOwningCompany,
    sameStopCounts,
    type ConstructionState,
    type Owner,
    type TileFace,
    type TrackLayDetails,
    type TrackRules
} from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { MineMarker, SteelMillId, SteelMillLocation, SteelMillTile } from './privatePowerRules.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenPhases } from './trains.js'

const SecondLayCost = 20
const BridgeDiscount = 10
const BridgePrivateIds = ['OBC', 'UBC']
const MountainEngineersId = 'MTE'
const MountainIncome = 20

// The Mountain Engineers' company earns from the bank for each mountain it first builds on.
function mountainIncome(state: ConstructionState, details: TrackLayDetails, payer: Owner) {
    if (
        details.previous ||
        payer.kind !== 'company' ||
        privateOwningCompany(state, MountainEngineersId) !== payer.companyId
    )
        return []
    const kinds = EighteenSeventeenMap.location(details.locationId).terrain?.kinds ?? []
    const amount = kinds.filter((kind) => kind === 'mountain').length * MountainIncome
    return amount ? [{ from: { kind: 'bank' as const }, to: { ...payer }, amount }] : []
}

// Another tile on the Steel Mill's hex closes it, unless a player still holds it.
function closedSteelMill(state: ConstructionState, details: TrackLayDetails): string[] {
    const owner = privateOwner(state, SteelMillId)
    return details.locationId === SteelMillLocation &&
        details.definitionId !== SteelMillTile &&
        !getCompany(state, SteelMillId).closed &&
        owner?.kind !== 'player'
        ? [SteelMillId]
        : []
}
const isUpgrade = (color: string) => color !== 'yellow'
const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length

// New York's two cities join into one on its gray tile.
function preservesStops(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (before.labels.includes('NY') &&
            after.labels.includes('NY') &&
            cityCount(before) === 2 &&
            cityCount(after) === 1)
    )
}

export const EighteenSeventeenTrackRules: TrackRules = {
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    colorOrder: ['white', 'yellow', 'green', 'brown', 'gray'],
    availableColors: (state) => EighteenSeventeenPhases.phase(state.phaseId).tileColors,
    // Two lays a turn, of which at most one is an upgrade; the second costs $20.
    allowance(state, color) {
        const lays = state.trackStep?.lays ?? []
        if (!lays.length) return { cost: 0 }
        if (lays.length > 1) return { reason: '1817 permits two lays a turn' }
        if (isUpgrade(lays[0].color) && isUpgrade(color))
            return { reason: '1817 permits one upgrade a turn' }
        return { cost: SecondLayCost }
    },
    preservesStops,
    mostExits: (before) => before.nodes.some((node) => node.kind === 'city'),
    useful: ({ home, newTrack, increasedCityRevenue }) => home || newTrack || increasedCityRevenue,
    homeLocations: () => [],
    // A bridge private's company lays on rivers, but not lakes, $10 cheaper.
    terrainCost(state, request, cost) {
        const kinds = EighteenSeventeenMap.location(request.locationId).terrain?.kinds ?? []
        const ownsBridge = BridgePrivateIds.some(
            (privateId) => privateOwningCompany(state, privateId) === request.companyId
        )
        return ownsBridge && kinds.length === 1 && kinds[0] === 'water'
            ? Math.max(0, cost - BridgeDiscount)
            : cost
    },
    afterLay: (state, details, payer) => ({
        payments: mountainIncome(state, details, payer),
        closedPrivateIds: closedSteelMill(state, details)
    }),
    restriction(state, request) {
        if (request.definitionId === SteelMillTile)
            return 'Only the Pittsburgh Steel Mill lays X00.'
        if (locationMarkers(state, { locationId: request.locationId, kind: MineMarker }).length)
            return 'Nobody may upgrade a mine.'
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'The second lay must be on a different hex'
        return undefined
    }
}
