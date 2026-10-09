import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    type InitialPosition
} from '@tabletop/18xx'
import { EighteenSeventeenCorporations } from './corporations.js'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
import { MarketPoolId, treasuryPoolId } from './roundRules.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenTrainDepot } from './trains.js'

const bank = { kind: 'bank' } as const

/** Every corporation unstarted with one station, the game's privates with the bank. */
export function createEighteenSeventeenPosition(
    playerCash: readonly { playerId: string; amount: number }[],
    privateIds: readonly string[]
): Omit<InitialPosition, 'stockMarket'> {
    const privates = privateIds.map((id) => EighteenSeventeenPrivateCatalog.definition(id))
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
            ...privates.map((company) => ({
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
            ...privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                retired: false as const,
                owner: bank
            }))
        ],
        stations: EighteenSeventeenCorporations.flatMap((company) =>
            createCompanyStations(company.id, 1)
        ),
        stationReservations: EighteenSeventeenMap.stationReservations(),
        tileInventory: EighteenSeventeenTileSet.createInventory(),
        trainInventory: EighteenSeventeenTrainDepot.createInventory(),
        phaseId: '2'
    }
}
