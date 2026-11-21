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
    type WaterfallAuctionRules
} from '@tabletop/18xx'
import {
    CpId,
    CprId,
    Majors1882,
    PrivateCatalog1882,
    Privates1882,
    QlId,
    TbId,
    TrestleShareCompanyIds
} from './companies.js'
import { Map1882, QLHome } from './map.js'
import { IpoPoolId1882, MarketPoolId1882 } from './names.js'
import { createNeutralStations } from './neutralStations.js'
import type { HydratedState1882, State1882 } from './state.js'
import { Charters1882 } from './stock.js'
import { TileSet1882 } from './tiles.js'
import { ExtraTrainIds1882, createTrainInventory1882 } from './trains.js'

export const Bank1882 = 9000
/** Starting cash by player count (§3). */
export const startingCash1882 = startingCashByPlayerCount({
    2: 900,
    3: 600,
    4: 450,
    5: 360,
    6: 300
})

/** The Trestle Bridge's share: the drawn company's first ordinary certificate (§3, §7.1.4). */
export function trestleShareId(companyId: string): string {
    return `${companyId}:share:1`
}

export const AuctionRules1882: WaterfallAuctionRules<HydratedState1882> = {
    lots: (state) => PrivateCatalog1882.lots(state),
    increment: 5,
    bidMultiple: 5,
    // Among several bidders, the lowest bid speaks first (§9).
    bidOrder: 'lowest-bid-first',
    // When all pass, the cheapest unsold private falls by $5, to nothing (§9).
    allPass: 'discount-next',
    // Priority goes left of the last player to buy a private at its price (§9).
    firstStockPlayer: 'after-last-purchase',
    award(state, award) {
        const extras =
            award.lotId === TbId
                ? [trestleShareId(state.trestleShareCompanyId)]
                : award.lotId === CpId
                  ? [`${CprId}:president`]
                  : []
        awardCertificates(state, award, [`${award.lotId}:charter`, ...extras])
        // The Canadian Pacific's buyer sets the CPR's par at once (§7.1.5).
        if (award.lotId === CpId) requirePar(state, CprId, award.playerId)
    },
    incomePayments: (state) => privateIncomePayments(state, { charters: Charters1882 })
}

export function createOpening1882({
    players,
    prng,
    config,
    startingPositions
}: OpeningSetup): Opening<typeof State1882, HydratedState1882> {
    assert(players.length >= 2 && players.length <= 6, '1882 supports two through six players')
    const capital = startingCash1882({ playerCount: players.length, config })
    const ipo = { owner: { kind: 'bank' } as const, poolId: IpoPoolId1882 }
    const position: InitialPosition = {
        stockMarket: { stacks: [] },
        bank: {},
        companies: [
            ...Majors1882.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...Privates1882.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: Bank1882 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...Majors1882.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: IpoPoolId1882, owner: { kind: 'bank' } },
            { id: MarketPoolId1882, owner: { kind: 'bank' } }
        ],
        certificates: [
            ...Majors1882.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...Privates1882.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        stations: [
            ...Majors1882.flatMap((company) =>
                createCompanyStations(company.id, company.stationCosts.length)
            ),
            ...createNeutralStations()
        ],
        stationReservations: Map1882.stationReservations(),
        hexReservations: [{ companyId: QlId, locationId: QLHome }],
        tileInventory: TileSet1882.createInventory(),
        trainInventory: createTrainInventory1882(),
        phaseId: '2'
    }
    // The rebellion's train and the Trestle Bridge's share are drawn at setup (§3).
    const rebellionTrain = ExtraTrainIds1882[prng.randInt(ExtraTrainIds1882.length)]
    const trestleCompany = TrestleShareCompanyIds[prng.randInt(TrestleShareCompanyIds.length)]
    return {
        position,
        titleState: {
            rebellion: { definitionId: rebellionTrain },
            trestleShareCompanyId: trestleCompany
        },
        begin: beginWaterfallAuction(AuctionRules1882, startingPositions)
    }
}
