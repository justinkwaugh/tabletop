import * as Type from 'typebox'
import { ActionSource, assert, assertExists, type HydratedGameState } from '@tabletop/common'
import {
    CashPayment,
    trackReachability,
    RailwayMapState,
    TileEdges,
    controllingOwner,
    finiteCashOwnedBy,
    locationMarkers,
    removeLocationMarkers,
    placeLocationMarker,
    rotateTileEdge,
    rotateTileFace,
    settleCashPayments,
    tileExits,
    titleAction,
    type ActingCompanyAction,
    type ActionDefinition,
    type ConstructionState,
    TileRotation
} from '@tabletop/18xx'
import type { EighteenUSAState, HydratedEighteenUSAState } from './state.js'
import { EighteenUSAMap } from './map.js'
import { EighteenUSATileSet } from './tiles.js'
import { EighteenUSAPhases } from './trains.js'
import { EighteenUSATrackRules } from './trackRules.js'
import { OreMarker, RichOreMarker } from './resourceMarkers.js'
import { MetropolisCandidates } from './metropolis.js'

type State = ConstructionState & EighteenUSAState

const OreUpgradePhaseId = '3'
const Rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]
const Denver = MetropolisCandidates.find((candidate) => candidate.orientationChosen)

function presides(state: State, playerId: string, companyId: string): boolean {
    return controllingOwner(state, companyId)?.playerId === playerId
}

function reaches(state: State, companyId: string, locationId: string): boolean {
    return trackReachability(state, EighteenUSATrackRules, companyId).canReach(locationId)
}

function layingCompany(state: State): string | undefined {
    return state.machineState === 'LayingTrack' && !state.trackStep?.completed
        ? state.trackStep?.companyId
        : undefined
}

/** The ore tokens the laying company may raise to $20, and what that tile action costs (§13.3). */
export function oreUpgrades(
    state: State,
    companyId: string
): { locationId: string; cost: number }[] {
    if (layingCompany(state) !== companyId) return []
    if (!EighteenUSAPhases.isAtLeast(state.phaseId, OreUpgradePhaseId)) return []
    const allowance = EighteenUSATrackRules.allowance(state, 'yellow', true)
    if ('reason' in allowance) return []
    if (finiteCashOwnedBy(state, { kind: 'company', companyId }) < allowance.cost) return []
    return locationMarkers(state, { kind: OreMarker })
        .filter(
            (marker) =>
                !state.trackStep?.lays.some((lay) => lay.locationId === marker.locationId) &&
                reaches(state, companyId, marker.locationId)
        )
        .map((marker) => ({ locationId: marker.locationId, cost: allowance.cost }))
}

const UpgradeOreAction = titleAction('UpgradeOre', {
    companyId: Type.String(),
    locationId: Type.String(),
    metadata: Type.Optional(
        Type.Object({ payment: Type.Optional(CashPayment) }, { additionalProperties: false })
    )
})
export const UpgradeOre = UpgradeOreAction.schema
export type UpgradeOre = Type.Static<typeof UpgradeOre>
export const isUpgradeOre = UpgradeOreAction.is

class HydratedUpgradeOre extends UpgradeOreAction.Base implements UpgradeOre {
    declare type: 'UpgradeOre'
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare metadata?: UpgradeOre['metadata']
    apply(state: HydratedGameState & State): void {
        const upgrade = oreUpgrades(state, this.companyId).find(
            (entry) => entry.locationId === this.locationId
        )
        assert(
            this.source === ActionSource.User &&
                presides(state, this.playerId, this.companyId) &&
                !!upgrade,
            'The company cannot upgrade this ore token now'
        )
        assertExists(upgrade, 'An upgrade has its cost')
        assertExists(state.trackStep, 'Ore is upgraded in the track step')
        const [marker] = locationMarkers(state, { locationId: this.locationId, kind: OreMarker })
        removeLocationMarkers(state, { locationId: this.locationId, kind: OreMarker })
        placeLocationMarker(state, { ...marker, kind: RichOreMarker })
        const placement = state.tileInventory.placements[this.locationId]
        state.trackStep.lays.push({
            locationId: this.locationId,
            ...(placement ? { definitionId: placement.definitionId } : {}),
            upgrade: true
        })
        const payment = upgrade.cost
            ? {
                  from: { kind: 'company' as const, companyId: this.companyId },
                  to: { kind: 'bank' as const },
                  amount: upgrade.cost
              }
            : undefined
        if (payment) settleCashPayments(state, [payment])
        this.metadata = payment ? { payment } : {}
    }
}

/** Whether Denver's metropolis tile waits for its first company to turn it (§12.2.3). */
function denverUnturned(state: State): boolean {
    return (
        !!Denver &&
        state.metropolisIds.includes(Denver.locationId) &&
        !state.denverTurned &&
        state.tileInventory.placements[Denver.locationId]?.definitionId === Denver.yellowTileId
    )
}

/**
 * The rotations Denver's tile may take: every one that keeps the track already pointing into the
 * hex connected (§12.2.3).
 */
export function denverRotations(state: State, companyId: string): TileRotation[] {
    if (!Denver || !denverUnturned(state) || layingCompany(state) !== companyId) return []
    const home = state.stations.some(
        (station) =>
            station.companyId === companyId &&
            station.status === 'placed' &&
            station.position.locationId === Denver.locationId
    )
    const mapState = new RailwayMapState(EighteenUSAMap, EighteenUSATileSet, state.tileInventory)
    const pointsIn = (edge: (typeof TileEdges)[number]) => {
        const neighbor = EighteenUSAMap.neighbor(Denver.locationId, edge)
        if (!neighbor) return false
        const tile = mapState.tile(neighbor.id)
        return tileExits(rotateTileFace(tile.face, tile.rotation)).has(rotateTileEdge(edge, 3))
    }
    const pointing = TileEdges.filter(pointsIn)
    // Its own company turns it, or the first to lay track into the hex (§12.2.3).
    const laidInto = TileEdges.some(
        (edge) =>
            pointsIn(edge) &&
            state.trackStep?.lays.some(
                (lay) => lay.locationId === EighteenUSAMap.neighbor(Denver.locationId, edge)?.id
            )
    )
    if (!home && !laidInto) return []
    const definition = EighteenUSATileSet.definitions.find(
        (tile) => tile.id === Denver.yellowTileId
    )
    assertExists(definition, 'Denver’s tile is in the set')
    return Rotations.filter((rotation) => {
        const exits = tileExits(rotateTileFace(definition.face, rotation))
        return pointing.every((edge) => exits.has(edge))
    })
}

const TurnDenverAction = titleAction('TurnDenver', {
    companyId: Type.String(),
    rotation: TileRotation
})
export const TurnDenver = TurnDenverAction.schema
export type TurnDenver = Type.Static<typeof TurnDenver>
export const isTurnDenver = TurnDenverAction.is

class HydratedTurnDenver extends TurnDenverAction.Base implements TurnDenver {
    declare type: 'TurnDenver'
    declare playerId: string
    declare companyId: string
    declare rotation: TileRotation
    apply(state: HydratedGameState & State): void {
        assert(
            this.source === ActionSource.User &&
                presides(state, this.playerId, this.companyId) &&
                denverRotations(state, this.companyId).includes(this.rotation),
            'The company cannot turn Denver’s tile this way now'
        )
        assertExists(Denver, 'Denver is a metropolis candidate')
        const placement = state.tileInventory.placements[Denver.locationId]
        assertExists(placement, 'Denver’s tile is laid')
        state.tileInventory = EighteenUSATileSet.replace(state.tileInventory, {
            locationId: Denver.locationId,
            placement: { ...placement, rotation: this.rotation },
            returnPrevious: true
        })
        state.denverTurned = true
    }
}

export const TrackTitleActions: readonly ActionDefinition[] = [
    UpgradeOreAction.define((action) => new HydratedUpgradeOre(action)),
    TurnDenverAction.define((action) => new HydratedTurnDenver(action))
]

export const UpgradeOreCompanyAction: ActingCompanyAction<HydratedEighteenUSAState> = {
    type: 'UpgradeOre',
    available: (state, playerId, companyId) =>
        presides(state, playerId, companyId) && oreUpgrades(state, companyId).length > 0,
    isValid: (action, state, companyId) =>
        isUpgradeOre(action) &&
        action.companyId === companyId &&
        presides(state, action.playerId, companyId) &&
        oreUpgrades(state, companyId).some((entry) => entry.locationId === action.locationId)
}

export const TurnDenverCompanyAction: ActingCompanyAction<HydratedEighteenUSAState> = {
    type: 'TurnDenver',
    available: (state, playerId, companyId) =>
        presides(state, playerId, companyId) && denverRotations(state, companyId).length > 1,
    isValid: (action, state, companyId) =>
        isTurnDenver(action) &&
        action.companyId === companyId &&
        presides(state, action.playerId, companyId) &&
        denverRotations(state, companyId).includes(action.rotation)
}
