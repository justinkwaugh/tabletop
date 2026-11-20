import { assert, assertExists, shuffle } from '@tabletop/common'
import {
    awardPrivate,
    beginOpening,
    beginSelectionAuction,
    closePrivate,
    createCompanyStations,
    createOrdinaryShareCertificates,
    drawFirstPlayer,
    finiteCashOwnedBy,
    startingCashByPlayerCount,
    treasuryPool,
    treasuryPoolId,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules,
    type SelectionAuctionState,
    type Station,
    type StationReservation,
    type TileInventory
} from '@tabletop/18xx'
import {
    CfiId,
    CoalCreekId,
    CoalDepotId,
    DrawnRailroads,
    FixedRailroads,
    MetalCompanyKind,
    MetalIdsRoyalGorge,
    PalmerId,
    PrivateCardsRoyalGorge,
    RgId,
    SteelDepotId,
    VgcId,
    privateCard,
    railroad,
    type PrivateTier
} from './companies.js'
import { GameConfigRoyalGorge, type VariantsRoyalGorge } from './definition/gameConfig.js'
import { GorgeEastId, GorgeWestId, HomeTowns, MapRoyalGorge } from './map.js'
import { BankPoolIdRoyalGorge, MetalBoardPoolIdRoyalGorge } from './names.js'
import { emptyClosedPrivates } from './privateHoldings.js'
import { freshSteelMarket } from './steel.js'
import { StateRoyalGorge, requireStateRoyalGorge, type HydratedStateRoyalGorge } from './state.js'
import { DebtStartSpaceId, MarketRoyalGorge, MetalStartSpaceId } from './stockMarket.js'
import { HomeCityTileId, RiverHomeCityTileId, TileSetRoyalGorge } from './tiles.js'
import { TrainDepotRoyalGorge, YellowPhaseId } from './trains.js'

/** Starting capital by player count (Certificate Limits table). */
const StartingCash: Readonly<Record<number, number>> = { 2: 800, 3: 550, 4: 400 }

export const startingCashRoyalGorge = startingCashByPlayerCount(StartingCash)

/** The steel company's own cash, paid out each set and set back to this (ST-8). */
export const SteelBaseCash = 50
/** The coal in Coal Creek's mine at the start (Y3). */
export const CoalCreekSupply = 12
/** The steel on the Steel Depot card (B3). */
export const DepotSteel = 5

/** Two yellow, two green and one brown private are dealt, in that order (Setup, step 11). */
const Deal: readonly (readonly [PrivateTier, number])[] = [
    ['yellow', 2],
    ['green', 2],
    ['brown', 1]
]

function dealPrivates(random: () => number): string[] {
    return Deal.flatMap(([tier, count]) => {
        const deck = PrivateCardsRoyalGorge.filter((card) => card.tier === tier).map(
            (card) => card.id
        )
        shuffle(deck, random)
        return deck.slice(0, count)
    })
}

/** Santa Fe, Rio Grande and three drawn railroads, by establishment year (Setup, step 3). */
function drawRailroads(random: () => number): string[] {
    const drawn = DrawnRailroads.map((rail) => rail.id)
    shuffle(drawn, random)
    return [...FixedRailroads.map((rail) => rail.id), ...drawn.slice(0, 3)].sort(
        (a, b) => railroad(a).established - railroad(b).established
    )
}

/**
 * The alternate prices: steel starts at a drawn yellow card's minimum bid and gold at a drawn
 * green card's, from Y1–Y3 and G1–G3 (Alternate Gold and Steel Prices).
 */
function metalPrices(variants: VariantsRoyalGorge, random: () => number) {
    if (!variants.alternatePrices) return { [CfiId]: MetalStartSpaceId, [VgcId]: MetalStartSpaceId }
    const draw = (ids: readonly string[]) => {
        const price = privateCard(ids[Math.floor(random() * ids.length)]).faceValue
        const space = MarketRoyalGorge.spaces.find((entry) => entry.price === price)
        assertExists(space, 'A card’s minimum bid is a market price')
        return space.id
    }
    return { [CfiId]: draw(['Y1', 'Y2', 'Y3']), [VgcId]: draw(['G1', 'G2', 'G3']) }
}

/** Florence and Fountain are cities when their railroad is in the game (Rule 1, SC-6). */
function placeHomeCities(inventory: TileInventory, railroadIds: readonly string[]): TileInventory {
    let placed = inventory
    for (const [companyId, locationId] of Object.entries(HomeTowns)) {
        if (!railroadIds.includes(companyId)) continue
        const definitionId = MapRoyalGorge.location(locationId).terrain
            ? RiverHomeCityTileId
            : HomeCityTileId
        const piece = TileSetRoyalGorge.availablePieces(placed, definitionId)[0]
        assertExists(piece, 'Each home city tile is in the supply')
        placed = TileSetRoyalGorge.replace(placed, {
            locationId,
            placement: { pieceId: piece.id, definitionId, rotation: 0 },
            returnPrevious: false
        })
    }
    return placed
}

function homeReservations(railroadIds: readonly string[]): StationReservation[] {
    return [
        ...MapRoyalGorge.stationReservations().filter((reservation) =>
            railroadIds.includes(reservation.companyId)
        ),
        ...Object.entries(HomeTowns)
            .filter(([companyId]) => railroadIds.includes(companyId))
            .map(([companyId, locationId]) => ({ companyId, locationId, nodeId: 'city' })),
        // Rio Grande alone may hold the gorge's stations (DB-2).
        { companyId: RgId, locationId: GorgeWestId, nodeId: 'city' },
        { companyId: RgId, locationId: GorgeEastId, nodeId: 'city' }
    ]
}

function createPosition(
    playerIds: readonly string[],
    capital: number,
    railroadIds: readonly string[],
    privateIds: readonly string[],
    metalSpaces: Readonly<Record<string, string>>
): InitialPosition {
    const bank = { kind: 'bank' } as const
    const unstarted = { started: false, floated: false, funded: false, operated: false }
    const board = { owner: bank, poolId: MetalBoardPoolIdRoyalGorge }
    const stations: Station[] = railroadIds.flatMap((companyId) =>
        createCompanyStations(companyId, railroad(companyId).stationCosts.length)
    )
    return {
        bank: {},
        phaseId: YellowPhaseId,
        stockMarket: {
            stacks: Object.entries(metalSpaces).reduce<{ spaceId: string; companyIds: string[] }[]>(
                (stacks, [companyId, spaceId]) => {
                    const stack = stacks.find((entry) => entry.spaceId === spaceId)
                    if (stack) stack.companyIds.push(companyId)
                    else stacks.push({ spaceId, companyIds: [companyId] })
                    return stacks
                },
                []
            )
        },
        companies: [
            ...railroadIds.map((id) => ({ id, kind: 'major', ...unstarted })),
            ...MetalIdsRoyalGorge.map((id) => ({
                id,
                kind: MetalCompanyKind,
                started: true,
                floated: true,
                funded: true,
                operated: false
            })),
            ...privateIds.map((id) => ({ id, kind: 'private' }))
        ],
        cash: [
            { owner: bank, amount: 'unlimited' },
            ...playerIds.map((playerId) => ({
                owner: { kind: 'player' as const, playerId },
                amount: capital
            })),
            ...[...railroadIds, ...MetalIdsRoyalGorge].map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: companyId === CfiId ? SteelBaseCash : 0
            }))
        ],
        certificatePools: [
            { id: BankPoolIdRoyalGorge, owner: bank },
            { id: MetalBoardPoolIdRoyalGorge, owner: bank },
            ...railroadIds.map((companyId) => treasuryPool(companyId))
        ],
        certificates: [
            ...railroadIds.flatMap((companyId) => {
                const treasury = {
                    owner: { kind: 'company' as const, companyId },
                    poolId: treasuryPoolId(companyId)
                }
                return createOrdinaryShareCertificates(
                    companyId,
                    Array.from({ length: 8 }, () => treasury),
                    treasury
                )
            }),
            ...MetalIdsRoyalGorge.flatMap((companyId) =>
                Array.from({ length: 10 }, (_, index) => ({
                    id: `${companyId}:${index + 1}`,
                    companyId,
                    kind: 'share' as const,
                    shares: 1,
                    ...board
                }))
            ),
            ...privateIds.map((companyId) => ({
                id: `${companyId}:charter`,
                companyId,
                kind: 'private' as const,
                owner: bank
            }))
        ],
        stations,
        stationReservations: homeReservations(railroadIds),
        tileInventory: placeHomeCities(TileSetRoyalGorge.createInventory(), railroadIds),
        trainInventory: TrainDepotRoyalGorge.createInventory()
    }
}

/**
 * William Palmer brings a Rio Grande share from its treasury, Rio Grande receiving nothing, and
 * a CF&I share from the board (Y4, SC-8); the Coal Depot a cube for each $10 bid (AU-7, OQ-12).
 */
function award(
    state: SelectionAuctionState,
    lot: { lotId: string; playerId: string; price: number }
): void {
    awardPrivate(state, lot)
    if (lot.lotId === PalmerId)
        for (const [poolId, companyId] of [
            [treasuryPoolId(RgId), RgId],
            [MetalBoardPoolIdRoyalGorge, CfiId]
        ] as const) {
            const certificate = state.certificates.find(
                (entry) =>
                    entry.kind === 'share' &&
                    !entry.president &&
                    entry.companyId === companyId &&
                    entry.poolId === poolId
            )
            assertExists(certificate, 'William Palmer’s shares are available')
            certificate.owner = { kind: 'player', playerId: lot.playerId }
            delete certificate.poolId
        }
    if (lot.lotId === CoalDepotId)
        requireStateRoyalGorge(state).coalDepotCubes = Math.floor(lot.price / 10)
}

/**
 * Privates are auctioned one at a time in the order dealt; a pass is out of that card, the
 * winner opens the next, and a card all pass is removed. The most cash then takes priority, a
 * tie going to the earliest in the auction's seat order (AU-1 to AU-5).
 */
export const AuctionRulesRoyalGorge: SelectionAuctionRules = {
    lots: (state) =>
        state.companies
            .filter((company) => company.kind === 'private' && !company.closed)
            .map((company) => ({
                id: company.id,
                name: privateCard(company.id).name,
                price: privateCard(company.id).faceValue
            })),
    nominationLotIds(state) {
        assertExists(state.selectionAuction, 'Nominations belong to the selection auction')
        return state.selectionAuction.remainingLotIds.slice(0, 1)
    },
    passingWhileNominating: () => true,
    openingBid: (_state, lotId) => privateCard(lotId).faceValue,
    increment: 5,
    award,
    winnerNominatesNext: true,
    passesWithdraw: true,
    allPassClosesLot: true,
    closeUnsold(state, lotIds) {
        for (const lotId of lotIds) closePrivate(state, lotId)
        emptyClosedPrivates(requireStateRoyalGorge(state))
    },
    firstStockOrder(state) {
        const order = state.turnManager.turnOrder
        const cash = (playerId: string) => finiteCashOwnedBy(state, { kind: 'player', playerId })
        const richest = Math.max(...order.map(cash))
        const first = order.findIndex((playerId) => cash(playerId) === richest)
        return [...order.slice(first), ...order.slice(0, first)]
    }
}

export function createOpeningRoyalGorge({
    players,
    prng,
    startingPositions,
    config
}: OpeningSetup): Opening<typeof StateRoyalGorge, HydratedStateRoyalGorge> {
    assert(players.length >= 2 && players.length <= 4, '18RoyalGorge is for two to four players')
    const variants = GameConfigRoyalGorge.variants(config)
    const random = () => prng.random()
    const railroadIds = drawRailroads(random)
    const metalSpaces = metalPrices(variants, random)
    const privateIds = variants.noPrivates ? [] : dealPrivates(random)
    const playerIds = players.map((player) => player.playerId)
    return {
        position: createPosition(
            playerIds,
            startingCashRoyalGorge({ playerCount: players.length, config }),
            railroadIds,
            privateIds,
            metalSpaces
        ),
        titleState: {
            ...(variants.shorterGame ? { shorterGame: true as const } : {}),
            steelMarket: freshSteelMarket(),
            depotSteel: privateIds.includes(SteelDepotId) ? DepotSteel : 0,
            goldCubes: {},
            goldShipped: 0,
            ghostTowns: [],
            coalCreekSupply: privateIds.includes(CoalCreekId) ? CoalCreekSupply : 0,
            coalCreekCubes: 0,
            coalDepotCubes: 0,
            trainExtensions: [],
            jewelerCash: 0,
            debtSpaceId: DebtStartSpaceId,
            debts: {},
            debtPaidIds: [],
            investorPurchases: []
        },
        begin: privateIds.length
            ? beginSelectionAuction(AuctionRulesRoyalGorge, startingPositions)
            : (state) => {
                  const first = drawFirstPlayer(
                      state.turnManager.turnOrder,
                      state.getPublicPrng(),
                      startingPositions
                  )
                  state.turnManager.newFirstPlayer(first)
                  beginOpening(state, 'StockRound', first)
              }
    }
}
