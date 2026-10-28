import {
    RailwayMapState,
    RouteNetwork,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    type RoutePath,
    type TrackRules,
    type TrainRoute
} from '@tabletop/18xx'
import { Map1833NE } from '../src/map.js'
import { TileSet1833NE } from '../src/tiles.js'
import type { Table } from './table.js'
import { Privates1833NE } from '../src/companies.js'
import { Market1833NE } from '../src/stock.js'
import { TrackRules1833NE } from '../src/track.js'
import { StationRules1833NE } from '../src/stations.js'
import { TrainRules1833NE } from '../src/trains.js'

/** Each player in turn buys the current private at its price. */
export function buyAllPrivates(game: Table): void {
    for (const company of Privates1833NE)
        game.act('BuyAuctionLot', { lotId: company.id, expectedPrice: company.faceValue })
}

export function launch(game: Table, companyId: string, price: number): void {
    const space = Market1833NE.spaces.find((entry) => entry.price === price)
    if (!space) throw new Error(`No ${price} space`)
    game.act('StartCompany', {
        buyer: { kind: 'player', playerId: game.player },
        companyId,
        marketSpaceId: space.id,
        expectedPrice: price * 2
    })
}

export function passStockRound(game: Table): void {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
}

function exits(definitionId: string, rotation: number): number[] {
    const definition = TileSet1833NE.definitions.find((entry) => entry.id === definitionId)
    if (!definition) throw new Error(`Unknown tile ${definitionId}`)
    return [
        ...new Set(
            definition.face.paths.flatMap((path) =>
                path.endpoints.flatMap((end) =>
                    end.kind === 'edge' ? [(end.edge + rotation) % 6] : []
                )
            )
        )
    ].sort()
}

/** Lays the tile turned so its track leaves by exactly these edges. */
export function lay(
    game: Table,
    locationId: string,
    definitionId: string,
    edges: readonly number[],
    rules: TrackRules = TrackRules1833NE
): void {
    const wanted = [...edges].sort().join()
    const choices = new TrackConstruction(game.hydrated, rules).choices(locationId)
    const choice = choices.find(
        (entry) =>
            entry.definitionId === definitionId &&
            exits(entry.definitionId, entry.rotation).join() === wanted
    )
    if (!choice)
        throw new Error(
            `No ${definitionId} [${wanted}] in ${locationId}: ${JSON.stringify(
                choices.map(
                    (entry) =>
                        `${entry.definitionId} [${exits(entry.definitionId, entry.rotation)}]`
                )
            )}`
        )
    game.act('LayTile', {
        companyId: choice.companyId,
        locationId,
        definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
}

export function placeStation(game: Table, locationId: string, nodeId = 'city'): void {
    const companyId = game.state.stationStep?.companyId
    const station = game.state.stations.find(
        (entry) => entry.companyId === companyId && entry.status === 'available'
    )
    const choice = station
        ? new StationPlacement(game.hydrated, StationRules1833NE)
              .choices(station.id)
              .find(
                  (entry) =>
                      entry.position.locationId === locationId && entry.position.nodeId === nodeId
              )
        : undefined
    if (!choice) throw new Error(`No station in ${locationId}`)
    const { cost, ...request } = choice
    game.act('PlaceStation', { ...request, expectedCost: cost })
}

export function buyTrain(game: Table, definitionId: string): void {
    const offer = new TrainPurchase(game.hydrated, TrainRules1833NE)
        .offers()
        .map((entry) => entry.evaluation.details)
        .find((details) => details?.definitionId === definitionId)
    if (!offer) throw new Error(`No ${definitionId} offered`)
    game.act('BuyTrain', {
        companyId: offer.companyId,
        trainId: offer.trainId,
        definitionId,
        expectedPrice: offer.price
    })
}

/**
 * A route from a stop through the given hexes in order, ending at a stop in the last one; the
 * extension, if any, continues through its hexes to a stop in its last.
 */
export function route(
    game: Table,
    trainId: string,
    start: { locationId: string; nodeId: string },
    hexes: readonly string[],
    extensionHexes: readonly string[] = []
): TrainRoute {
    const network = new RouteNetwork(
        new RailwayMapState(Map1833NE, TileSet1833NE, game.state.tileInventory)
    )
    const walk = (
        paths: RoutePath[],
        targets: readonly string[],
        from: readonly RoutePath[]
    ): RoutePath[] | undefined => {
        const trace = network.trace(start, [...from, ...paths]).trace
        if (!trace) return undefined
        const end = trace.end
        if (end.locationId === targets.at(-1) && end.endpoint.kind === 'node' && paths.length > 0)
            return paths
        for (const next of network.extensions(start, [...from, ...paths])) {
            if (!targets.includes(next.locationId)) continue
            if (
                paths.some(
                    (path) => path.locationId === next.locationId && path.pathId === next.pathId
                )
            )
                continue
            const found = walk([...paths, next], targets, from)
            if (found) return found
        }
        return undefined
    }
    const paths = walk([], [start.locationId, ...hexes], [])
    if (!paths) throw new Error(`No route through ${hexes.join(' ')}`)
    if (!extensionHexes.length) return { trainId, start, paths }
    const extension = walk([], [hexes.at(-1)!, ...extensionHexes], paths)
    if (!extension) throw new Error(`No extension through ${extensionHexes.join(' ')}`)
    return { trainId, start, paths, extension }
}

export function ownedTrainId(game: Table, companyId: string, definitionId: string): string {
    const train = game.state.trainInventory.trains.find(
        (entry) =>
            entry.status === 'owned' &&
            entry.owner.kind === 'company' &&
            entry.owner.companyId === companyId &&
            entry.definitionId === definitionId
    )
    if (!train) throw new Error(`${companyId} owns no ${definitionId}`)
    return train.id
}
