import { Shikoku1889Majors } from './majors.js'
import { assert } from '@tabletop/common'
import {
    awardPrivate,
    createOrdinaryShareCertificates,
    privateIncomePayments,
    settleCashPayments,
    beginWaterfallAuction,
    createCompanyStations,
    type WaterfallAuctionRules,
    type InitialPosition,
    type Opening,
    type OpeningSetup
} from '@tabletop/18xx'
import { Shikoku1889PrivateCatalog, Shikoku1889Privates } from './privates.js'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { Shikoku1889TrainDepot } from './trains.js'
import { Shikoku1889StationCounts } from './stationRules.js'
import { createShikoku1889StockMarket } from './stockMarket.js'
export const Shikoku1889AuctionRules: WaterfallAuctionRules = {
    lots: (state) => Shikoku1889PrivateCatalog.lots(state),
    increment: 5,
    bidOrder: 'clockwise-from-highest',
    award: awardPrivate,
    payIncome(state) {
        settleCashPayments(state, privateIncomePayments(state))
    }
}
export function createShikoku1889Opening({ players }: OpeningSetup): Opening {
    assert(players.length >= 2 && players.length <= 6, '1889 supports two through six players')
    const privates = Shikoku1889Privates.slice(
        0,
        players.length === 2 ? 5 : players.length === 3 ? 6 : 7
    )
    const majors = Object.values(Shikoku1889Majors)
    const capital = players.length <= 4 ? 420 : 390
    const ipo = { owner: { kind: 'bank' } as const, poolId: 'initial-offering' }
    const position: InitialPosition = {
        stockMarket: createShikoku1889StockMarket(),
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        companies: [
            ...majors.map((company) => ({
                ...company,
                kind: 'major',
                shareCount: 10,
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...privates.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'private',
                privateRevenue: company.revenue
            }))
        ],
        cash: [
            { owner: { kind: 'bank' }, amount: 7000 - players.length * capital },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...majors.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: 'initial-offering', name: 'IPO', owner: { kind: 'bank' } },
            { id: 'open-market', name: 'Market', owner: { kind: 'bank' } }
        ],
        certificates: [
            ...majors.flatMap((company) =>
                createOrdinaryShareCertificates(
                    company.id,
                    Array.from({ length: 8 }, () => ipo),
                    ipo
                )
            ),
            ...privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner: { kind: 'bank' as const }
            }))
        ],
        tranches: [],
        ownershipLimitExemptions: [],
        stations: majors.flatMap((company) =>
            createCompanyStations(company.id, Shikoku1889StationCounts[company.id])
        ),
        stationReservations: Shikoku1889Map.stationReservations(),
        tileInventory: Shikoku1889TileSet.createInventory(),
        trainInventory: Shikoku1889TrainDepot.createInventory(),
        phaseId: '2'
    }
    return { position, begin: beginWaterfallAuction(Shikoku1889AuctionRules) }
}
