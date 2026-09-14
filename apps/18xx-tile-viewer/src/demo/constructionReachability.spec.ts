import { expect, it } from 'vitest'
import {
    RailwayMapState,
    TrackNetwork,
    rotateTileFace,
    type TileRotation,
    type StationState
} from '@tabletop/18xx'
import { Definition as Top, TheOldPrinceTrackRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889TrackRules } from '@tabletop/shikoku-1889'
import { ConstructionReachability } from '../../../../libs/18xx/src/construction/constructionReachability.js'
import { example } from './stockTestUtils.js'

it.each([
    { definition: Top, rules: TheOldPrinceTrackRules },
    { definition: Shikoku, rules: Shikoku1889TrackRules }
])(
    'matches full-network traversal for $definition.info.id candidate rotations',
    ({ definition, rules }) => {
        const { state } = example(definition, 'routes')
        const map = new RailwayMapState(rules.map, rules.tileSet, state.tileInventory)
        const companies = [
            ...new Set(
                state.stations
                    .filter((station) => station.status === 'placed')
                    .map((station) => station.companyId)
            )
        ]
        const rotations: TileRotation[] = [0, 1, 2, 3, 4, 5]
        for (const companyId of companies) {
            const blockedState: StationState = {
                stations: [...state.stations],
                stationReservations: state.stationReservations
            }
            for (const location of rules.map.definition.locations) {
                for (const node of map.tile(location.id).face.nodes) {
                    if (node.kind !== 'city') continue
                    for (let slot = 0; slot < node.stationSlots; slot++) {
                        if (
                            blockedState.stations.some(
                                (station) =>
                                    station.status === 'placed' &&
                                    station.position.locationId === location.id &&
                                    station.position.nodeId === node.id &&
                                    station.position.slot === slot
                            )
                        )
                            continue
                        blockedState.stations.push({
                            id: `rival-${location.id}-${node.id}-${slot}`,
                            companyId: 'rival',
                            status: 'placed',
                            position: { locationId: location.id, nodeId: node.id, slot }
                        })
                    }
                }
            }
            for (const stations of [state, blockedState]) {
                const reachability = new ConstructionReachability(map, stations, companyId)
                for (const location of rules.map.definition.locations) {
                    for (const rotation of rotations) {
                        const face = rotateTileFace(map.tile(location.id).face, rotation)
                        const expected = new TrackNetwork(map, stations, companyId, {
                            locationId: location.id,
                            face
                        })
                        const actual = reachability.connections(location.id, face, stations)
                        expect([...actual.paths].sort()).toEqual(
                            face.paths
                                .filter((path) => expected.usesPath(location.id, path.id))
                                .map((path) => path.id)
                                .sort()
                        )
                        expect([...actual.nodes].sort()).toEqual(
                            face.nodes
                                .filter((node) =>
                                    expected.reaches(location.id, { kind: 'node', nodeId: node.id })
                                )
                                .map((node) => node.id)
                                .sort()
                        )
                        if (!reachability.canReach(location.id)) expect(actual.paths.size).toBe(0)
                    }
                }
            }
        }
    }
)
