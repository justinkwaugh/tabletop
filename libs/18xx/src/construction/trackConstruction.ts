import * as Type from 'typebox'
import { cashOwnedBy, controllingOwner, type Owner } from '../finance/finance.js'
import type { CompanyState } from '../company/companyState.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import type { RailwayMap } from '../map/map.js'
import { Station, StationReservation } from '../map/station.js'
import { TilePlacement, type TileInventory, type TileSet } from '../tiles/inventory.js'
import { TileRotation, type TileDefinition, type TileFace } from '../tiles/tile.js'
import { rotateTileEdge, rotateTileFace } from '../tiles/topology.js'
import { ConstructionReachability } from './constructionReachability.js'
import {
    tileUpgradeMappings,
    preservesPath,
    fixedNodeRevenue,
    type TileNodeMapping
} from './trackUpgrade.js'

export const TrackStep = Type.Object(
    {
        companyId: Type.String(),
        lays: Type.Array(
            Type.Object(
                {
                    locationId: Type.String(),
                    color: Type.String(),
                    cost: Type.Integer({ minimum: 0 })
                },
                { additionalProperties: false }
            )
        ),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type TrackStep = Type.Static<typeof TrackStep>
export type ConstructionState = CompanyState & MapStateData & { trackStep?: TrackStep }
export const TrackRequest = Type.Object(
    {
        companyId: Type.String(),
        locationId: Type.String(),
        definitionId: Type.String(),
        rotation: TileRotation,
        nodeMapping: Type.Record(Type.String(), Type.String())
    },
    { additionalProperties: false }
)
export type TrackRequest = Type.Static<typeof TrackRequest>
export const TrackLayDetails = Type.Object(
    {
        ...TrackRequest.properties,
        placement: TilePlacement,
        previous: Type.Optional(TilePlacement),
        cost: Type.Integer({ minimum: 0 }),
        consentPlayerId: Type.Optional(Type.String()),
        terrainCost: Type.Integer({ minimum: 0 }),
        allowanceCost: Type.Integer({ minimum: 0 }),
        stations: Type.Array(Station),
        stationReservations: Type.Array(StationReservation)
    },
    { additionalProperties: false }
)
export type TrackLayDetails = Type.Static<typeof TrackLayDetails>
export type TrackEvaluation =
    | { details: TrackLayDetails; reason?: never }
    | { reason: string; details?: never }
export interface TrackRules {
    map: RailwayMap
    tileSet: TileSet
    colorOrder: readonly string[]
    availableColors(state: ConstructionState): readonly string[]
    allowance(state: ConstructionState, color: string): { cost: number } | { reason: string }
    preservesStops(before: TileFace, after: TileFace): boolean
    restriction(state: ConstructionState, request: TrackRequest): string | undefined
    useful(change: { home: boolean; newTrack: boolean; increasedCityRevenue: boolean }): boolean
    homeLocations(companyId: string): readonly string[]
    consentPlayerId?(state: ConstructionState, request: TrackRequest): string | undefined
    terrainCost?(state: ConstructionState, request: TrackRequest, cost: number): number
}
const Rotations: readonly TileRotation[] = [0, 1, 2, 3, 4, 5]

export class TrackConstruction {
    private reachability: ConstructionReachability | undefined
    private readonly pieces = new Map<string, ReturnType<TileSet['availablePieces']>>()
    readonly mapState: RailwayMapState
    constructor(
        readonly state: ConstructionState,
        readonly rules: TrackRules,
        readonly payer?: Owner
    ) {
        this.mapState = new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
    }
    canAct(playerId: string, companyId: string): boolean {
        const turn = this.state.trackStep
        return (
            !!turn &&
            this.state.companies.some((company) => company.id === companyId && !company.closed) &&
            !turn.completed &&
            turn.companyId === companyId &&
            controllingOwner(this.state, companyId)?.playerId === playerId
        )
    }
    canReach(locationId: string): boolean {
        const companyId = this.state.trackStep?.companyId
        return !!companyId && (this.network(companyId).canReach(locationId) || this.rules.useful({
            home: this.rules.homeLocations(companyId).includes(locationId),
            newTrack: false,
            increasedCityRevenue: false
        }))
    }
    choices(locationId: string): TrackLayDetails[] {
        const companyId = this.state.trackStep?.companyId
        if (!companyId || !this.canReach(locationId)) return []
        const choices: TrackLayDetails[] = []
        for (const definition of this.rules.tileSet.definitions) {
            if (
                !this.basicTileAllowed(locationId, definition) ||
                'reason' in this.rules.allowance(this.state, definition.face.color)
            )
                continue
            for (const rotation of Rotations) {
                const before = this.mapState.tile(locationId)
                const after = rotateTileFace(definition.face, rotation)
                for (const nodeMapping of tileUpgradeMappings(
                    rotateTileFace(before.face, before.rotation),
                    after
                )) {
                    const result = this.evaluate({
                        companyId,
                        locationId,
                        definitionId: definition.id,
                        rotation,
                        nodeMapping
                    })
                    if (result.details) choices.push(result.details)
                }
            }
        }
        return choices
    }
    evaluate(request: TrackRequest): TrackEvaluation {
        const { locationId, companyId, definitionId, rotation, nodeMapping } = request
        if (
            !this.state.trackStep ||
            this.state.trackStep.completed ||
            this.state.trackStep.companyId !== companyId
        )
            return { reason: 'It is not this company’s track step' }
        const location = this.rules.map.definition.locations.find(
            (location) => location.id === locationId
        )
        const definition = this.rules.tileSet.definitions.find((tile) => tile.id === definitionId)
        if (!location || !definition) return { reason: 'Unknown map location or tile' }
        if (!this.basicTileAllowed(locationId, definition))
            return { reason: 'The tile’s color, labels, or stops cannot replace this hex' }
        const allowance = this.rules.allowance(this.state, definition.face.color)
        if ('reason' in allowance) return allowance
        const restriction = this.rules.restriction(this.state, request)
        if (restriction) return { reason: restriction }
        const previous = this.mapState.tile(locationId)
        const before = rotateTileFace(previous.face, previous.rotation)
        const after = rotateTileFace(definition.face, rotation)
        if (
            !tileUpgradeMappings(before, after).some(
                (mapping) =>
                    Object.keys(mapping).length === Object.keys(nodeMapping).length &&
                    Object.entries(mapping).every(([id, target]) => nodeMapping[id] === target)
            )
        )
            return { reason: 'Existing track and stops must be preserved' }
        let borderCost = 0
        const edges = new Set(
            after.paths.flatMap((path) =>
                path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            )
        )
        for (const edge of edges) {
            const neighbor = this.rules.map.neighbor(locationId, edge)
            if (!neighbor) return { reason: 'Track cannot run off the map' }
            const opposite = rotateTileEdge(edge, 3)
            const borders = [
                ...(location.borders?.filter((border) => border.edge === edge) ?? []),
                ...(neighbor.borders?.filter((border) => border.edge === opposite) ?? [])
            ]
            if (borders.some((border) => border.kind === 'impassable'))
                return { reason: 'Track cannot cross an impassable border' }
            const adjacent = this.mapState.tile(neighbor.id)
            if (
                !neighbor.buildable &&
                !rotateTileFace(adjacent.face, adjacent.rotation).paths.some((path) =>
                    path.endpoints.some((end) => end.kind === 'edge' && end.edge === opposite)
                )
            )
                return { reason: 'Track must meet the track in a fixed neighboring hex' }
            if (
                !before.paths.some((path) =>
                    path.endpoints.some((end) => end.kind === 'edge' && end.edge === edge)
                )
            )
                borderCost += Math.max(0, ...borders.map((border) => border.cost ?? 0))
        }
        const printedTerrainCost =
            (!previous.placement ? (location.terrain?.cost ?? 0) : 0) +
            (before.upgradeCost ?? 0) +
            borderCost
        const terrainCost =
            this.rules.terrainCost?.(this.state, request, printedTerrainCost) ?? printedTerrainCost
        const consentPlayerId = this.rules.consentPlayerId?.(this.state, request)
        const cost = terrainCost + allowance.cost
        const cash = cashOwnedBy(this.state, this.payer ?? { kind: 'company', companyId })
        if (cash === undefined || (cash !== 'unlimited' && cash < cost))
            return { reason: 'The company cannot afford construction' }
        const piece =
            this.availablePieces(definitionId)[0] ??
            this.rules.tileSet.pieces.find(
                (piece) =>
                    piece.id === previous.placement?.pieceId &&
                    piece.faceDefinitionIds.includes(definitionId)
            )
        if (!piece) return { reason: 'No tile remains in the supply' }
        const migrated = this.migrateStations(locationId, after, nodeMapping)
        if (!migrated) return { reason: 'The upgrade cannot preserve all station spaces' }
        const network = this.network(companyId).connections(locationId, after, migrated)
        const reverse = Object.fromEntries(
            Object.entries(nodeMapping).map(([id, target]) => [target, id])
        )
        const newTrack = after.paths.some(
            (path) => network.paths.has(path.id) && !preservesPath(path, before, reverse)
        )
        const increasedCityRevenue = before.nodes.some(
            (node) =>
                node.kind === 'city' &&
                after.nodes.some(
                    (target) =>
                        target.id === nodeMapping[node.id] &&
                        fixedNodeRevenue(target) > fixedNodeRevenue(node) &&
                        network.nodes.has(target.id)
                )
        )
        if (
            !this.rules.useful({
                home: this.rules.homeLocations(companyId).includes(locationId),
                newTrack,
                increasedCityRevenue
            })
        )
            return {
                reason: 'Construction must add connected track or increase a connected city’s revenue'
            }
        return {
            details: {
                companyId,
                locationId,
                definitionId,
                rotation,
                nodeMapping,
                placement: { pieceId: piece.id, definitionId, rotation },
                ...(previous.placement ? { previous: previous.placement } : {}),
                cost,
                terrainCost,
                ...(consentPlayerId ? { consentPlayerId } : {}),
                allowanceCost: allowance.cost,
                stations: migrated.stations,
                stationReservations: migrated.stationReservations
            }
        }
    }
    inventoryAfter(details: TrackLayDetails): TileInventory {
        return this.rules.tileSet.replace(this.state.tileInventory, {
            locationId: details.locationId,
            placement: details.placement,
            returnPrevious: true
        })
    }
    private network(companyId: string): ConstructionReachability {
        return this.reachability ??= new ConstructionReachability(this.mapState, this.state, companyId)
    }
    private availablePieces(definitionId: string): ReturnType<TileSet['availablePieces']> {
        let pieces = this.pieces.get(definitionId)
        if (!pieces) {
            pieces = this.rules.tileSet.availablePieces(this.state.tileInventory, definitionId)
            this.pieces.set(definitionId, pieces)
        }
        return pieces
    }
    private basicTileAllowed(locationId: string, definition: TileDefinition): boolean {
        const location = this.rules.map.location(locationId)
        const before = this.mapState.tile(locationId).face
        const after = definition.face
        if (!location.buildable || !this.rules.availableColors(this.state).includes(after.color))
            return false
        if (
            this.rules.colorOrder.indexOf(after.color) !==
            this.rules.colorOrder.indexOf(before.color) + 1
        )
            return false
        if (!this.rules.preservesStops(before, after)) return false
        const future = location.upgradeLabels
            ?.filter(
                (label) =>
                    this.rules.colorOrder.indexOf(label.color) <=
                    this.rules.colorOrder.indexOf(after.color)
            )
            .at(-1)
        const labels = future ? [future.label] : before.labels
        return (
            labels.length === after.labels.length &&
            labels.every((label) => after.labels.includes(label))
        )
    }
    private migrateStations(
        locationId: string,
        after: TileFace,
        mapping: TileNodeMapping
    ): Pick<ConstructionState, 'stations' | 'stationReservations'> | undefined {
        const occupied = new Map<string, Set<number>>()
        const stations: Station[] = []
        for (const station of this.state.stations) {
            if (station.status !== 'placed' || station.position.locationId !== locationId) {
                stations.push(station)
                continue
            }
            const nodeId = mapping[station.position.nodeId]
            const node = after.nodes.find((node) => node.id === nodeId)
            if (node?.kind !== 'city') return undefined
            const slots = occupied.get(nodeId) ?? new Set<number>()
            const slot =
                station.position.slot < node.stationSlots && !slots.has(station.position.slot)
                    ? station.position.slot
                    : Array.from({ length: node.stationSlots }, (_, index) => index).find(
                          (index) => !slots.has(index)
                      )
            if (slot === undefined) return undefined
            slots.add(slot)
            occupied.set(nodeId, slots)
            stations.push({ ...station, position: { locationId, nodeId, slot } })
        }
        const stationReservations = this.state.stationReservations.map((reservation) =>
            reservation.locationId === locationId
                ? { ...reservation, nodeId: mapping[reservation.nodeId] }
                : reservation
        )
        return { stations, stationReservations }
    }
}
