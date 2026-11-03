import {
    RailwayMapState,
    RouteNetwork,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    type RoutePath,
    type TileRotation,
    type TrackRules,
    type TrainRoute
} from '@tabletop/18xx'
import { Map1870 } from '../src/map.js'
import { TileSet1870 } from '../src/tiles.js'
import type { Table } from './table.js'
import { Privates1870 } from '../src/privates.js'
import { Market1870 } from '../src/stockMarket.js'
import { TrackRules1870 } from '../src/track.js'
import { StationRules1870 } from '../src/stations.js'
import { TrainRules1870 } from '../src/trains.js'

export function buyAllPrivates(game: Table): void {
    for (const company of Privates1870) {
        game.act('BuyAuctionLot', { lotId: company.id, expectedPrice: company.faceValue })
        if (game.state.pendingPar)
            game.act('ParCompany', {
                companyId: game.state.pendingPar.companyId,
                marketSpaceId: spaceAt(68)
            })
    }
}

export function spaceAt(price: number): string {
    const space = Market1870.spaces.find((entry) => entry.price === price && entry.color === 'pink')
    if (!space) throw new Error(`No ${price} par space`)
    return space.id
}

export function launch(game: Table, companyId: string, price: number): void {
    game.act('StartCompany', {
        buyer: { kind: 'player', playerId: game.player },
        companyId,
        marketSpaceId: spaceAt(price),
        expectedPrice: price * 2
    })
}

export function buyIpo(game: Table, companyId: string, price: number): void {
    const certificate = game.state.certificates.find(
        (entry) =>
            entry.companyId === companyId &&
            entry.kind === 'share' &&
            entry.poolId === 'initial-offering'
    )
    if (!certificate) throw new Error(`No ${companyId} share on offer`)
    game.act('BuyShares', {
        buyer: { kind: 'player', playerId: game.player },
        certificateId: certificate.id,
        expectedPrice: price
    })
}

export function passStockRound(game: Table): void {
    while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
}

export function exits(definitionId: string, rotation: number): number[] {
    const definition = TileSet1870.definitions.find((entry) => entry.id === definitionId)
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

export function lay(
    game: Table,
    locationId: string,
    definitionId: string,
    edges: readonly number[],
    rules: TrackRules = TrackRules1870
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
        ? new StationPlacement(game.hydrated, StationRules1870)
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
    const offer = new TrainPurchase(game.hydrated, TrainRules1870)
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

export function route(
    state: Pick<Table['state'], 'tileInventory'>,
    trainId: string,
    start: { locationId: string; nodeId: string },
    hexes: readonly string[],
    extensionHexes: readonly string[] = []
): TrainRoute {
    const network = new RouteNetwork(new RailwayMapState(Map1870, TileSet1870, state.tileInventory))
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
    const extension = walk([], [...hexes.slice(-1), ...extensionHexes], paths)
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

export function rotationFor(definitionId: string, edges: readonly number[]): TileRotation {
    const wanted = [...edges].sort().join()
    const rotation = ([0, 1, 2, 3, 4, 5] as const).find(
        (candidate) => exits(definitionId, candidate).join() === wanted
    )
    if (rotation === undefined) throw new Error(`${definitionId} cannot leave by ${wanted}`)
    return rotation
}
