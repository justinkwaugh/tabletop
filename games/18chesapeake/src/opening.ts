import { assert } from '@tabletop/common'
import {
    awardCertificates,
    beginWaterfallAuction,
    createCompanyStations,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    requirePar,
    startingCashByPlayerCount,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type PrivateRules,
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import {
    BoId,
    BopId,
    CvId,
    MajorsChesapeake,
    PrivateCatalogChesapeake,
    PrivatesChesapeake
} from './companies.js'
import { MapChesapeake } from './map.js'
import { IpoPoolIdChesapeake, MarketPoolIdChesapeake, NamesChesapeake } from './names.js'
import { GameConfigChesapeake } from './definition/gameConfig.js'
import { OffTheRailsEditionChesapeake, StandardEditionChesapeake } from './edition.js'
import {
    requireStateChesapeake,
    type HydratedStateChesapeake,
    type StateChesapeake
} from './state.js'
import { ChartersChesapeake, twoPlayer } from './stock.js'
import { TileSetChesapeake } from './tiles.js'
import { createTrainInventoryChesapeake, trainsExportedChesapeake } from './trains.js'

/** Starting cash by player count (§3). */
export const startingCashChesapeake = startingCashByPlayerCount({
    2: 1200,
    3: 800,
    4: 600,
    5: 480,
    6: 400
})

/** The B&O share that comes with the Baltimore & Ohio private (§7.1). */
export const BopShareId = `${BoId}:share:1`

export const AuctionRulesChesapeake: WaterfallAuctionRules<HydratedStateChesapeake> = {
    lots: (state) => PrivateCatalogChesapeake.lots(state),
    increment: 5,
    bidMultiple: 5,
    // Among several bidders, the lowest bid speaks first (§9).
    bidOrder: 'lowest-bid-first',
    // Priority goes left of the last player to buy a private at its price (§9).
    firstStockPlayer: 'after-last-purchase',
    award(state, award) {
        const extras =
            award.lotId === BopId
                ? [BopShareId]
                : award.lotId === CvId
                  ? [`${state.corneliusCompanyId}:president`]
                  : []
        awardCertificates(state, award, [`${award.lotId}:charter`, ...extras])
        // Cornelius Vanderbilt's buyer sets its company's par at once (§7.1, §10.4).
        if (award.lotId === CvId) requirePar(state, state.corneliusCompanyId, award.playerId)
    },
    incomePayments: (state) => privateIncomePayments(state, { charters: ChartersChesapeake }),
    // The all-pass income round counts as an operating round: its set's export follows (§9).
    incomeExports: trainsExportedChesapeake
}

/** A private's text, Cornelius Vanderbilt's naming the company drawn for it. */
export const privateDescription: PrivateRules['description'] = (state, id) => {
    const text = PrivateCatalogChesapeake.definition(id).description ?? ''
    const { corneliusCompanyId: companyId } = requireStateChesapeake(state)
    return id === CvId
        ? text.replace(
              'a company drawn at setup',
              `the ${NamesChesapeake.company(companyId)}, drawn at setup`
          )
        : text
}

/**
 * Every company has ten shares. With two players each president's certificate is a triple
 * share with seven ordinary ones, except the company drawn for Cornelius Vanderbilt (§14.1).
 */
function shareCertificates(companyId: string, triple: boolean) {
    const ipo = { owner: { kind: 'bank' } as const, poolId: IpoPoolIdChesapeake }
    const certificates = createOrdinaryShareCertificates(
        companyId,
        Array.from({ length: triple ? 7 : 8 }, () => ipo),
        ipo
    )
    return triple
        ? certificates.map((certificate) =>
              certificate.president ? { ...certificate, shares: 3 } : certificate
          )
        : certificates
}

export function createOpeningChesapeake({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof StateChesapeake, HydratedStateChesapeake> {
    assert(
        players.length >= 2 && players.length <= 6,
        '18Chesapeake supports two through six players'
    )
    const capital = startingCashChesapeake({ playerCount: players.length, config })
    // Cornelius Vanderbilt's company is drawn at setup (§3).
    const corneliusCompanyId = MajorsChesapeake[prng.randInt(MajorsChesapeake.length)].id
    const triples = twoPlayer({ players })
    const isOffTheRails = GameConfigChesapeake.options(config).offTheRails
    const edition = isOffTheRails ? OffTheRailsEditionChesapeake : StandardEditionChesapeake
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...MajorsChesapeake.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...PrivatesChesapeake.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: edition.bank - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...MajorsChesapeake.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolIdChesapeake, owner: { kind: 'bank' } },
            { id: MarketPoolIdChesapeake, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...MajorsChesapeake.flatMap((company) =>
                shareCertificates(company.id, triples && company.id !== corneliusCompanyId)
            ),
            ...PrivatesChesapeake.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: MajorsChesapeake.flatMap((company) =>
            createCompanyStations(company.id, company.stationCosts.length)
        ),
        stationReservations: MapChesapeake.stationReservations(),
        tileInventory: TileSetChesapeake.createInventory(),
        trainInventory: createTrainInventoryChesapeake(edition),
        phaseId: '2'
    }
    return {
        position,
        titleState: {
            corneliusCompanyId,
            ...(isOffTheRails ? { offTheRails: true as const } : {})
        },
        begin: beginWaterfallAuction(AuctionRulesChesapeake, startingPositions)
    }
}
