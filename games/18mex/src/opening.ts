import { assert, assertExists } from '@tabletop/common'
import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    getCompany,
    presidentOf,
    homeStationId,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type AuctionLot,
    type CashPayment,
    type Certificate,
    type FinancialState,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type OpenShare,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import {
    AuctionOrderMex,
    ChartersMex,
    ChiId,
    MajorsMex,
    MinorAuctionRun,
    MinorsMex,
    MirId,
    MnrId,
    NdmId,
    PrivateCatalogMex,
    minorMex
} from './companies.js'
import { GameConfigMex } from './definition/gameConfig.js'
import { MapMex, homeLocationMex } from './map.js'
import { IpoPoolIdMex, MarketPoolIdMex, TradeInPoolIdMex } from './names.js'
import type { HydratedStateMex, StateMex } from './state.js'
import { StationCostsMex } from './stations.js'
import { TileSetMex } from './tiles.js'
import { MinorTrainId, TrainDepotMex } from './trains.js'

/** The bank holds exactly $9,000 (1.4). */
export const BankCashMex = 9000

/** Starting cash by player count (Table II). */
export const startingCashMex = startingCashByPlayerCount({ 3: 625, 4: 500, 5: 450 })

/** The certificates that come free with a private: MIR's CHI share, MNR's NdM presidency. */
const AwardedCertificates: Readonly<Record<string, string>> = {
    [MirId]: `${ChiId}:share:1`,
    [MnrId]: `${NdmId}:president`
}

/** The auction's items, privates and minors, by their numbers (3.1). */
export function auctionLotsMex(
    state: Pick<FinancialState, 'companies' | 'certificates'>
): AuctionLot[] {
    return AuctionOrderMex.flatMap((id) => {
        const certificate = state.certificates.find((entry) => entry.id === `${id}:charter`)
        if (!certificate) return []
        const minor = minorMex(id)
        return [
            minor
                ? { id, name: minor.name, price: minor.faceValue }
                : {
                      id,
                      name: PrivateCatalogMex.definition(id).name,
                      price: PrivateCatalogMex.faceValue(id)
                  }
        ]
    })
}

/** A minor's owner takes charge of it as it is bought; it floats at once (1.3.3). */
function activateMinor(state: FinancialState, minorId: string): void {
    const minor = getCompany(state, minorId)
    minor.started = true
    minor.floated = true
    minor.funded = true
}

/**
 * While the auction lasts, every operating round pays the privates, and each minor its run from
 * its home city along its printed track, $30, split half and half (4.2, AU-3).
 */
function auctionIncome(state: HydratedStateMex): CashPayment[] {
    const minors = MinorsMex.flatMap((minor): CashPayment[] => {
        const company = getCompany(state, minor.id)
        const owner = presidentOf(state, minor.id)
        if (!owner || company.closed) return []
        const half = MinorAuctionRun / 2
        return [
            { from: { kind: 'bank' }, to: owner, amount: half },
            { from: { kind: 'bank' }, to: { kind: 'company', companyId: minor.id }, amount: half }
        ]
    })
    return [...privateIncomePayments(state, { charters: ChartersMex }), ...minors]
}

export const AuctionRulesMex: WaterfallAuctionRules<HydratedStateMex> = {
    lots: (state) => auctionLotsMex(state),
    // Each bid beats the last, or the face value, by at least $5 (3.1(b)).
    increment: 5,
    // The auction starts after the highest bidder and goes clockwise; a player who passed may bid
    // again (3.1.1).
    bidOrder: 'clockwise-from-highest',
    rebidAfterPass: true,
    award(state, award) {
        const extra = AwardedCertificates[award.lotId]
        awardCertificates(state, award, [`${award.lotId}:charter`, ...(extra ? [extra] : [])])
        if (minorMex(award.lotId)) activateMinor(state, award.lotId)
        // The MNR's buyer sets the NdM's par at once (Table III).
        if (award.lotId === MnrId) requirePar(state, NdmId, award.playerId)
    },
    incomePayments: (state) => auctionIncome(state)
}

/**
 * The NdM's certificates, counted in 5% units: the 20% president's, six 10%s on offer, the two
 * 5% trade-ins for minors A and B, and the 10% kept for the merger (1.3.2, 5.2, 5.3).
 */
function ndmCertificates(): Certificate[] {
    const ipo = { owner: { kind: 'bank' as const }, poolId: IpoPoolIdMex }
    const tradeIn = { owner: { kind: 'bank' as const }, poolId: TradeInPoolIdMex }
    const share = (id: string, shares: number, allocation: typeof ipo): OpenShare => ({
        id: `${NdmId}:${id}`,
        companyId: NdmId,
        kind: 'share',
        shares,
        ...allocation
    })
    return [
        { ...share('president', 4, ipo), president: true },
        ...Array.from({ length: 6 }, (_, index) => share(`share:${index + 1}`, 2, ipo)),
        share('half:1', 1, tradeIn),
        share('half:2', 1, tradeIn),
        share('merger', 2, tradeIn)
    ]
}

function majorCertificates(): Certificate[] {
    const ipo = { owner: { kind: 'bank' as const }, poolId: IpoPoolIdMex }
    return MajorsMex.flatMap((major) =>
        major.id === NdmId
            ? ndmCertificates()
            : createOrdinaryShareCertificates(
                  major.id,
                  Array.from({ length: 8 }, () => ipo),
                  ipo
              )
    ).map((certificate) =>
        // The UdY 10% kept for minor C's owner waits in the trade-in box (5.2).
        MinorsMex.some((minor) => minor.tradeInCertificateId === certificate.id)
            ? { ...certificate, poolId: TradeInPoolIdMex }
            : certificate
    )
}

export function createOpeningMex({
    players,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof StateMex, HydratedStateMex> {
    assert(players.length >= 3 && players.length <= 5, '18MEX supports three to five players')
    const capital = startingCashMex({ playerCount: players.length, config })
    const options = GameConfigMex.options(config)
    const inventory = TrainDepotMex.createInventory()
    const minorTrains = inventory.trains.filter((train) => train.definitionId === MinorTrainId)
    assert(minorTrains.length === MinorsMex.length, 'Each minor has its built-in 2-train')
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...MajorsMex.map((major) => ({
                id: major.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...MinorsMex.map((minor) => ({
                id: minor.id,
                kind: 'minor',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...PrivateCatalogMex.privates.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: BankCashMex - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...[...MajorsMex, ...MinorsMex].map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolIdMex, owner: { kind: 'bank' } },
            { id: MarketPoolIdMex, owner: { kind: 'bank' } },
            { id: TradeInPoolIdMex, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...majorCertificates(),
            ...MinorsMex.map((minor) => ({
                id: `${minor.id}:charter`,
                companyId: minor.id,
                kind: 'share' as const,
                shares: 1,
                president: true as const,
                owner: { kind: 'bank' as const }
            })),
            ...PrivateCatalogMex.privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...MajorsMex.flatMap((major) => {
                const costs = StationCostsMex[major.id]
                assertExists(costs, `${major.id} has a charter`)
                // The NdM's exchange tokens join its charter only with a merger (5.3(f)).
                return createCompanyStations(major.id, major.id === NdmId ? 4 : costs.length)
            }),
            // A minor's one station stands on its home from the start (4.2(a)).
            ...MinorsMex.map((minor) => ({
                id: homeStationId(minor.id),
                companyId: minor.id,
                status: 'placed' as const,
                position: { locationId: homeLocationMex(minor.id), nodeId: 'city', slot: 0 }
            }))
        ],
        stationReservations: MapMex.stationReservations().filter(
            (reservation) => !minorMex(reservation.companyId)
        ),
        tileInventory: TileSetMex.createInventory(),
        // The minors' 2-trains are printed on their charters (1.3.3).
        trainInventory: {
            ...inventory,
            trains: inventory.trains.map((train) => {
                const index = minorTrains.indexOf(train)
                return index < 0
                    ? train
                    : {
                          id: train.id,
                          definitionId: train.definitionId,
                          status: 'owned' as const,
                          owner: { kind: 'company' as const, companyId: MinorsMex[index].id }
                      }
            })
        },
        phaseId: '2'
    }
    return {
        position,
        titleState: { options },
        begin: beginWaterfallAuction(AuctionRulesMex, startingPositions)
    }
}
