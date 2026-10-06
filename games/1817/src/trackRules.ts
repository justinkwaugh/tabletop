import {
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
import { CityTilePrivates } from './privates.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenPhases } from './trains.js'
import { EfficientTrackId, ExpressTrackId, companyHolding, privateOpen } from './privateHolders.js'
import { CityTile, MineMarker, RanchMarker } from './privateMarkers.js'

const SecondLayCost = 20
const ExpressFirstLayCost = 10
const EfficientSecondLayCost = 10
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

// Another tile on a city-tile private's city closes it, unless a player still holds it.
function closedCityTilePrivates(state: ConstructionState, details: TrackLayDetails): string[] {
    if (details.definitionId === CityTile) return []
    return Object.entries(CityTilePrivates).flatMap(([privateId, locationId]) =>
        details.locationId === locationId &&
        privateOpen(state, privateId) &&
        privateOwner(state, privateId)?.kind !== 'player'
            ? [privateId]
            : []
    )
}

// Express Track makes the lays $10 and free, Efficient Track the second $10; both make both free.
function layCosts(state: ConstructionState): readonly [number, number] {
    const companyId = state.trackStep?.companyId
    const owns = (privateId: string) =>
        !!companyId && companyHolding(state, privateId) === companyId
    const express = owns(ExpressTrackId)
    const efficient = owns(EfficientTrackId)
    if (express && efficient) return [0, 0]
    if (express) return [ExpressFirstLayCost, 0]
    return [0, efficient ? EfficientSecondLayCost : SecondLayCost]
}
// The markers whose hexes nobody may upgrade, by what they are called.
const UnupgradableMarkers: Readonly<Record<string, string>> = {
    [MineMarker]: 'mine',
    [RanchMarker]: 'ranch'
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
        const [first, second] = layCosts(state)
        if (!lays.length) return { cost: first }
        if (lays.length > 1) return { reason: '1817 permits two lays a turn' }
        if (isUpgrade(lays[0].color) && isUpgrade(color))
            return { reason: '1817 permits one upgrade a turn' }
        return { cost: second }
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
        closedPrivateIds: closedCityTilePrivates(state, details)
    }),
    restriction(state, request) {
        if (request.definitionId === CityTile) return 'Only a city-tile private lays X00.'
        const [marker] = locationMarkers(state, { locationId: request.locationId }).filter(
            (item) => item.kind in UnupgradableMarkers
        )
        if (marker) return `Nobody may upgrade a ${UnupgradableMarkers[marker.kind]}.`
        if (state.trackStep?.lays.some((lay) => lay.locationId === request.locationId))
            return 'The second lay must be on a different hex'
        return undefined
    }
}
