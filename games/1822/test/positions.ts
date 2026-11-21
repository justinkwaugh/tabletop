import { getCompany, placeStockMarker, type TileRotation } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { homeStationId } from '@tabletop/18xx'
import { charterCertificateId } from '../src/lots.js'
import { minor1822, minorDirectorCertificateId } from '../src/companies.js'
import type { State1822 } from '../src/state.js'
import { Market1822 } from '../src/stockMarket.js'
import { TileSet1822 } from '../src/tiles.js'

export const player = (playerId: string) => ({ kind: 'player' as const, playerId })
export const company = (companyId: string) => ({ kind: 'company' as const, companyId })

export function cashOf(
    state: State1822,
    owner: ReturnType<typeof player | typeof company>
): number {
    const account = state.cash.find(
        (entry) => JSON.stringify(entry.owner) === JSON.stringify(owner)
    )
    return typeof account?.amount === 'number' ? account.amount : 0
}

export function setCash(
    state: State1822,
    owner: ReturnType<typeof player | typeof company>,
    amount: number
): void {
    const account = state.cash.find(
        (entry) => JSON.stringify(entry.owner) === JSON.stringify(owner)
    )
    assertExists(account, 'The owner has an account')
    account.amount = amount
}

/** The market space of a price in a row of the chart. */
export function spaceAt(price: number, row?: number): string {
    const space = Market1822.spaces.find(
        (entry) => entry.price === price && (row === undefined || entry.row === row)
    )
    assertExists(space, `No ${price} space`)
    return space.id
}

/** A minor company owned by the player and operating from its home, as if bought earlier. */
export function runMinor(
    state: State1822,
    minorId: string,
    playerId: string,
    {
        price = 50,
        cash = 100,
        operated = true
    }: { price?: number; cash?: number; operated?: boolean } = {}
): void {
    Object.assign(getCompany(state, minorId), {
        started: true,
        floated: true,
        funded: true,
        operated,
        parPrice: price
    })
    placeStockMarker(state.stockMarket, minorId, spaceAt(price))
    const certificate = state.certificates.find(
        (entry) => entry.id === minorDirectorCertificateId(minorId)
    )
    assertExists(certificate, 'A minor company has its certificate')
    certificate.owner = player(playerId)
    delete certificate.poolId
    setCash(state, company(minorId), cash)
    state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.lotId !== minorId)
    state.bidBoxes.stacks = state.bidBoxes.stacks.map((stack) => ({
        ...stack,
        lotIds: stack.lotIds.filter((lotId) => lotId !== minorId)
    }))
    const home = minor1822(minorId)?.home
    if (!home) return
    state.stationReservations = state.stationReservations.filter(
        (entry) => entry.companyId !== minorId
    )
    state.stations = state.stations.map((station) =>
        station.id === homeStationId(minorId)
            ? {
                  id: station.id,
                  companyId: minorId,
                  status: 'placed',
                  position: { ...home, slot: 0 }
              }
            : station
    )
}

/** Gives a private company or concession to a player or company, out of the boxes and stacks. */
export function giveCharter(
    state: State1822,
    companyId: string,
    owner: ReturnType<typeof player | typeof company>
): void {
    const certificate = state.certificates.find(
        (entry) => entry.id === charterCertificateId(companyId)
    )
    assertExists(certificate, 'The charter has its certificate')
    certificate.owner = owner
    state.bidBoxes.boxes = state.bidBoxes.boxes.filter((box) => box.lotId !== companyId)
    state.bidBoxes.stacks = state.bidBoxes.stacks.map((stack) => ({
        ...stack,
        lotIds: stack.lotIds.filter((lotId) => lotId !== companyId)
    }))
}

/** Puts tiles on the board, each as a piece of the set not yet used. */
export function layTiles(
    state: State1822,
    tiles: readonly { locationId: string; definitionId: string; rotation: TileRotation }[]
): void {
    for (const { locationId, definitionId, rotation } of tiles) {
        const used = Object.values(state.tileInventory.placements).map((entry) => entry.pieceId)
        const piece = TileSet1822.pieces.find(
            (entry) => entry.faceDefinitionIds.includes(definitionId) && !used.includes(entry.id)
        )
        assertExists(piece, `No ${definitionId} piece is left`)
        state.tileInventory.placements[locationId] = { pieceId: piece.id, definitionId, rotation }
    }
}

type Stepped = {
    state: State1822
    player: string
    act(type: string, fields?: object, playerId?: string): unknown
}

/** Plays the least each step asks for until the company reaches the machine state. */
export function stepTo(game: Stepped, machineState: string, companyId: string): void {
    for (let moves = 0; moves < 400; moves++) {
        const state = game.state
        const operating =
            state.trackStep?.companyId ??
            state.stationStep?.companyId ??
            state.routeStep?.companyId ??
            state.trainPurchaseStep?.companyId
        const at = (step: string) => state.machineState === step
        if (
            at(machineState) &&
            (machineState === 'StockRound' || currentCompany(state) === companyId)
        )
            return
        if (at('StockRound')) game.act('FinishStockTurn', {}, game.player)
        else if (at('LayingTrack')) game.act('FinishTrack', { companyId: operating })
        else if (at('PlacingStation')) game.act('FinishStations', { companyId: operating })
        else if (at('RunningTrains')) game.act('RunTrains', { companyId: operating, routes: [] })
        else if (at('DistributingEarnings'))
            game.act('DistributeEarnings', { companyId: operating, choice: 'pay' })
        else if (at('BuyingTrains')) game.act('FinishOperatingTurn', { companyId: operating })
        else throw new Error(`No step out of ${state.machineState}`)
    }
    throw new Error(`${companyId} never reached ${machineState}`)
}

function currentCompany(state: State1822): string | undefined {
    const set = state.operatingSet
    return set?.companyOrder.find((id) => !set.completedCompanyIds.includes(id))
}
