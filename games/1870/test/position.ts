import { assertExists } from '@tabletop/common'
import {
    getCompany,
    homeStationId,
    placeStockMarker,
    rotateTileFace,
    type TileEdge,
    type TileRotation
} from '@tabletop/18xx'
import { company1870 } from '../src/companies.js'
import { Map1870 } from '../src/map.js'
import type { State1870 } from '../src/state.js'
import { Market1870 } from '../src/stockMarket.js'
import { TileSet1870 } from '../src/tiles.js'
import { TrainDepot1870 } from '../src/trains.js'
import { buyAllPrivates } from './flow.js'
import { table, type Table } from './table.js'

export type Placement = { locationId: string; definitionId: string; rotation: TileRotation }

const Rotations = [0, 1, 2, 3, 4, 5] as const

function tileJoining(locationId: string, edges: readonly TileEdge[]): Placement {
    const nodes = Map1870.location(locationId).preprintedTile.nodes
    const tiles = nodes.some((node) => node.kind === 'city')
        ? ['57', '6', '5']
        : nodes.some((node) => node.kind === 'town')
          ? ['4', '58', '3']
          : ['9', '8', '7']
    for (const number of tiles)
        for (const rotation of Rotations) {
            const definitionId = `18xx:${number}`
            const definition = TileSet1870.definitions.find((tile) => tile.id === definitionId)
            assertExists(definition, `Unknown tile ${number}`)
            const exits = rotateTileFace(definition.face, rotation).paths.flatMap((path) =>
                path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
            )
            if (edges.every((edge) => exits.includes(edge)))
                return { locationId, definitionId, rotation }
        }
    throw new Error(`No tile joins ${edges.join()} in ${locationId}`)
}

export function trackAlong(hexes: readonly string[]): Placement[] {
    return hexes.flatMap((locationId, index) => {
        if (!Map1870.location(locationId).buildable) return []
        const edgeToward = (other: string | undefined): TileEdge[] => {
            if (!other) return []
            const edge = ([0, 1, 2, 3, 4, 5] as const).find(
                (candidate) => Map1870.neighbor(locationId, candidate)?.id === other
            )
            assertExists(edge, `${other} does not border ${locationId}`)
            return [edge]
        }
        return [
            tileJoining(locationId, [
                ...edgeToward(hexes[index - 1]),
                ...edgeToward(hexes[index + 1])
            ])
        ]
    })
}

export function giveTrain(state: State1870, companyId: string, definitionId: string): string {
    const train = TrainDepot1870.nextTrain(state.trainInventory, definitionId)
    assertExists(train, `No ${definitionId} left`)
    TrainDepot1870.purchase(state.trainInventory, train.id, definitionId, {
        kind: 'company',
        companyId
    })
    return train.id
}

export function operated(
    state: State1870,
    companyId: string,
    playerId: string,
    { price = 100, shares = 6, cash = 500 }: { price?: number; shares?: number; cash?: number } = {}
): void {
    const company = getCompany(state, companyId)
    Object.assign(company, {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        parPrice: price,
        president: { kind: 'player', playerId }
    })
    const space = Market1870.spaces.find((entry) => entry.price === price && entry.color === 'pink')
    assertExists(space, `No ${price} par space`)
    placeStockMarker(state.stockMarket, companyId, space.id)
    const owned = state.certificates.filter(
        (certificate) => certificate.companyId === companyId && certificate.kind === 'share'
    )
    let left = shares
    for (const certificate of owned) {
        if (left <= 0 || certificate.kind !== 'share') break
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
        left -= certificate.shares
    }
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    assertExists(account, 'The company has an account')
    account.amount = cash
    const home = company1870(companyId)?.home
    assertExists(home, 'The company has a home')
    const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
    if (reservation) {
        state.stationReservations = state.stationReservations.filter(
            (entry) => entry !== reservation
        )
        state.stations = state.stations.map((station) =>
            station.id === homeStationId(companyId)
                ? {
                      id: station.id,
                      companyId,
                      status: 'placed',
                      position: { locationId: home, nodeId: reservation.nodeId, slot: 0 }
                  }
                : station
        )
    }
}

export function turnFor(state: State1870, playerId: string): void {
    state.activePlayerIds = [playerId]
    state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
}

export function prepared(
    prepare: (state: State1870, game: Table) => void,
    count = 4,
    config?: Record<string, boolean>
): Table {
    const game = table(count, 7, config)
    buyAllPrivates(game)
    const state = structuredClone(game.state)
    prepare(state, game)
    game.state = state
    return game
}
