import { assert, type Prng } from '@tabletop/common'
import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    homeStationId,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type AuctionLot,
    type FinancialState,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import {
    CaId,
    CobourgCompanyRevenue,
    CpId,
    DirectorPrivates1828,
    FriendlyDirectorCompanyIds,
    Majors1828,
    PrivateCatalog1828,
    PrrId,
    SaleablePrivateIds,
    StctId
} from './companies.js'
import { GameConfig1828 } from './definition/gameConfig.js'
import { setCobourgOwner } from './cobourg.js'
import { CobourgRailwayId } from './ids.js'
import { Map1828, PeterboroughLocationId } from './map.js'
import { IpoPoolId1828, MarketPoolId1828 } from './names.js'
import { State1828, type HydratedState1828 } from './state.js'
import { Charters1828 } from './stock.js'
import { TileSet1828 } from './tiles.js'
import { CobourgTrainId, SmallTableSupply1828, TrainDepot1828 } from './trains.js'

/** Starting cash by player count (§4). */
export const startingCash1828 = startingCashByPlayerCount({ 3: 800, 4: 700, 5: 620 })

/** The PRR share that comes with the Camden & Amboy (§13.2.2.8). */
export const CamdenShareId = `${PrrId}:share:1`

/** A private's income, by its owner: the St. Clair Tunnel pays more to a company (§13.2.2). */
export function privateIncome1828(
    state: Pick<FinancialState, 'certificates'>,
    privateId: string
): number {
    const owner = state.certificates.find(
        (certificate) => certificate.id === `${privateId}:charter`
    )?.owner
    const companyOwned = owner?.kind === 'company'
    if (privateId === StctId) return companyOwned ? 10 : 5
    // A player's C&P earns through its railway's run instead (§8.1, §13.2.2.5).
    if (privateId === CpId) return companyOwned ? CobourgCompanyRevenue : 0
    return Charters1828.privateRevenue(privateId)
}

/** The privates in the auction, row by row, each row left to right (§4). */
export function auctionLots(state: Pick<State1828, 'companies'>): AuctionLot[] {
    return state.companies.flatMap((company) =>
        company.kind === 'private'
            ? [
                  {
                      id: company.id,
                      name: PrivateCatalog1828.definition(company.id).name,
                      price: PrivateCatalog1828.faceValue(company.id)
                  }
              ]
            : []
    )
}

export const AuctionRules1828: WaterfallAuctionRules<HydratedState1828> = {
    lots: (state) => auctionLots(state),
    // A bid is a multiple of $5 beyond the private's value and every bid on it (§6.1).
    increment: 5,
    bidMultiple: 5,
    // Among several bidders, the lowest bid speaks first (§6.1, §6.2).
    bidOrder: 'lowest-bid-first',
    priceRows: true,
    // A $250 private holds one bid, an overbid returning the earlier one (§6.1).
    singleBid: (lotId) => PrivateCatalog1828.faceValue(lotId) === 250,
    // Every pass round resolves the bids, pays the privates, and the auction resumes (§6.1).
    allPass: 'resolve-bids-then-income',
    award(state, award) {
        const director = DirectorPrivates1828.find((item) => item.id === award.lotId)
        const extras =
            award.lotId === CaId
                ? [CamdenShareId]
                : director
                  ? [`${director.companyId}:president`, `${director.companyId}:share:1`]
                  : []
        awardCertificates(state, award, [`${award.lotId}:charter`, ...extras])
        // A $250 private's buyer sets its company's par at once (§6.3).
        if (director) requirePar(state, director.companyId, award.playerId)
        // The C&P's buyer runs its railway (§13.2.2.5).
        if (award.lotId === CpId) setCobourgOwner(state, award.playerId)
    },
    // In the auction the C&P pays its owner $15, laying no tile (§6.1).
    incomePayments: (state) =>
        privateIncomePayments(state, {
            charters: Charters1828,
            privateIncome: (incomeState, privateId) =>
                privateId === CpId
                    ? CobourgCompanyRevenue
                    : privateIncome1828(incomeState, privateId)
        })
}

/**
 * The $250 privates in play, left to right: a random draw of one more than the players, with
 * one of the GT, N&W and OS&H first among them in the beginners' game (§4; designer, BGG thread
 * 2328194).
 */
function drawDirectorPrivates(prng: Prng, count: number, friendly: boolean): string[] {
    const pool = DirectorPrivates1828.map((entry) => entry.id)
    const drawn: string[] = []
    const take = (candidates: readonly string[]) => {
        const id = candidates[prng.randInt(candidates.length)]
        drawn.push(id)
        pool.splice(pool.indexOf(id), 1)
    }
    if (friendly)
        take(
            DirectorPrivates1828.filter((entry) =>
                FriendlyDirectorCompanyIds.includes(entry.companyId)
            ).map((entry) => entry.id)
        )
    while (drawn.length < count) take(pool)
    for (let index = drawn.length - 1; index > 0; index--) {
        const other = prng.randInt(index + 1)
        ;[drawn[index], drawn[other]] = [drawn[other], drawn[index]]
    }
    return drawn
}

export function createOpening1828({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1828, HydratedState1828> {
    assert(players.length >= 3 && players.length <= 5, '1828 supports three to five players')
    const capital = startingCash1828({ playerCount: players.length, config })
    const directorPrivates = drawDirectorPrivates(
        prng,
        players.length + 1,
        GameConfig1828.options(config).beginnerPrivates
    )
    const privateIds = [...SaleablePrivateIds, ...directorPrivates]
    const ipo = { owner: { kind: 'bank' } as const, poolId: IpoPoolId1828 }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Majors1828.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...privateIds.map((id) => ({ id, kind: 'private' })),
            {
                id: CobourgRailwayId,
                kind: 'minor',
                started: true,
                floated: true,
                funded: true,
                operated: false
            }
        ],
        cash: [
            // The bank is unlimited in practice (§2: "~$50,000"), so the board shows none.
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...[...Majors1828.map((company) => company.id), CobourgRailwayId].map((companyId) => ({
                owner: { kind: 'company' as const, companyId },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolId1828, owner: { kind: 'bank' } },
            { id: MarketPoolId1828, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Majors1828.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...privateIds.map((id) => ({
                id: `${id}:charter`,
                companyId: id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...Majors1828.flatMap((company) => createCompanyStations(company.id, company.stations)),
            {
                id: homeStationId(CobourgRailwayId),
                companyId: CobourgRailwayId,
                status: 'placed',
                position: { locationId: PeterboroughLocationId, nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: Map1828.stationReservations(),
        tileInventory: TileSet1828.createInventory(),
        trainInventory: cobourgOwnsItsTrain(
            TrainDepot1828.createInventory(players.length < 5 ? SmallTableSupply1828 : undefined)
        ),
        phaseId: '2',
        ownershipLimitExemptions: []
    }
    return {
        position,
        titleState: {
            systems: {}
        },
        begin: beginWaterfallAuction(AuctionRules1828, startingPositions)
    }
}

/** The C&P's run is its own, outside the depot (§13.2.2.5). */
function cobourgOwnsItsTrain(inventory: InitialPosition['trainInventory']) {
    return {
        ...inventory,
        trains: inventory.trains.map((train) =>
            train.definitionId === CobourgTrainId
                ? {
                      id: train.id,
                      definitionId: train.definitionId,
                      status: 'owned' as const,
                      owner: { kind: 'company' as const, companyId: CobourgRailwayId }
                  }
                : train
        )
    }
}
