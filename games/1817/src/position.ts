import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    type InitialPosition
} from '@tabletop/18xx'
import { EighteenSeventeenCorporations } from './corporations.js'
import { EighteenSeventeenPrivates } from './privates.js'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenTrainDepot } from './trains.js'
import { MarketPoolId, treasuryPoolId } from './roundRules.js'

const bank = { kind: 'bank' } as const

/** Every corporation unstarted with one station, every private with the bank. */
export function createEighteenSeventeenPosition(
    playerCash: readonly { playerId: string; amount: number }[]
): Omit<InitialPosition, 'stockMarket'> {
    return {
        bank: { name: 'Bank' },
        companies: [
            ...EighteenSeventeenCorporations.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'major',
                shareCount: 2,
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...EighteenSeventeenPrivates.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'private',
                privateRevenue: 0
            }))
        ],
        cash: [
            { owner: bank, amount: 'unlimited' },
            ...playerCash.map(({ playerId, amount }) => ({
                owner: { kind: 'player' as const, playerId },
                amount
            })),
            ...EighteenSeventeenCorporations.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId, name: 'Market', owner: bank },
            ...EighteenSeventeenCorporations.map((company) => ({
                id: treasuryPoolId(company.id),
                name: 'Treasury',
                owner: { kind: 'company' as const, companyId: company.id }
            }))
        ],
        certificates: [
            ...EighteenSeventeenCorporations.flatMap((company) =>
                createOrdinaryShareCertificates(company.id, [], { owner: bank })
            ),
            ...EighteenSeventeenPrivates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner: bank
            }))
        ],
        tranches: [],
        ownershipLimitExemptions: [],
        stations: EighteenSeventeenCorporations.flatMap((company) =>
            createCompanyStations(company.id, 1)
        ),
        stationReservations: EighteenSeventeenMap.stationReservations(),
        tileInventory: EighteenSeventeenTileSet.createInventory(),
        trainInventory: EighteenSeventeenTrainDepot.createInventory(),
        phaseId: '2'
    }
}
