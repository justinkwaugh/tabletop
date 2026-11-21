import {
    createCompanyStations,
    createOrdinaryShareCertificates,
    treasuryPool,
    type InitialPosition
} from '@tabletop/18xx'
import { EighteenUSACorporations } from './corporations.js'
import { EighteenUSAMap } from './map.js'
import { EighteenUSAPrivateCatalog } from './privates.js'
import { MarketPoolId } from './marketZones.js'
import { EighteenUSATileSet } from './tiles.js'
import { EighteenUSATrainDepot } from './trains.js'
import type { TileInventory } from '@tabletop/18xx'

const bank = { kind: 'bank' } as const

/** Every corporation unstarted with one station, the game's privates and subsidies with the bank. */
export function createEighteenUSAPosition(
    playerCash: readonly { playerId: string; amount: number }[],
    privateIds: readonly string[],
    tileInventory: TileInventory = EighteenUSATileSet.createInventory(),
    trainVariantId?: string
): Omit<InitialPosition, 'stockMarket'> {
    const privates = privateIds.map((id) => EighteenUSAPrivateCatalog.definition(id))
    return {
        bank: {},
        companies: [
            ...EighteenUSACorporations.map((company) => ({
                id: company.id,
                kind: 'major',
                started: false,
                floated: false,
                funded: false,
                operated: false
            })),
            ...privates.map((company) => ({ id: company.id, kind: 'private' }))
        ],
        cash: [
            { owner: bank, amount: 'unlimited' },
            ...playerCash.map(({ playerId, amount }) => ({
                owner: { kind: 'player' as const, playerId },
                amount
            })),
            ...EighteenUSACorporations.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId, owner: bank },
            ...EighteenUSACorporations.map((company) => treasuryPool(company.id))
        ],
        certificates: [
            ...EighteenUSACorporations.flatMap((company) =>
                createOrdinaryShareCertificates(company.id, [], { owner: bank })
            ),
            ...privates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                owner: bank
            }))
        ],
        stations: EighteenUSACorporations.flatMap((company) =>
            createCompanyStations(company.id, 1)
        ),
        stationReservations: EighteenUSAMap.stationReservations(),
        tileInventory,
        trainInventory: EighteenUSATrainDepot.createInventory(trainVariantId),
        phaseId: '2'
    }
}
