import { assert } from '@tabletop/common'
import {
    awardPrivate,
    beginSelectionAuction,
    closePrivate,
    createCompanyStations,
    type InitialPosition,
    type Opening,
    type OpeningSetup,
    type SelectionAuctionRules
} from '@tabletop/18xx'
import { EighteenSeventeenCorporations } from './corporations.js'
import { EighteenSeventeenPrivateCatalog, EighteenSeventeenPrivates } from './privates.js'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenTrainDepot } from './trains.js'
import { createEighteenSeventeenStockMarket } from './stockMarket.js'
import { MarketPoolId, treasuryPoolId } from './roundRules.js'
import { seedMoney, setSeedMoney } from './state.js'

export const EighteenSeventeenStartingCash: Readonly<Record<number, number>> = {
    3: 420,
    4: 315,
    5: 252,
    6: 210,
    7: 180,
    8: 158,
    9: 140,
    10: 126,
    11: 115,
    12: 105
}
export const EighteenSeventeenSeedMoney = 200

// The bank subsidises privates sold below face value from its seed money; once that is spent,
// bidding opens at face value.
export const EighteenSeventeenAuctionRules: SelectionAuctionRules = {
    lots: (state) => EighteenSeventeenPrivateCatalog.lots(state),
    openingBid: (state, lotId) =>
        Math.max(0, EighteenSeventeenPrivateCatalog.faceValue(lotId) - seedMoney(state)),
    increment: 5,
    award(state, award) {
        awardPrivate(state, award)
        const subsidy = Math.max(
            0,
            EighteenSeventeenPrivateCatalog.faceValue(award.lotId) - award.price
        )
        setSeedMoney(state, seedMoney(state) - subsidy)
    },
    closeUnsold(state, lotIds) {
        for (const id of lotIds) closePrivate(state, id)
    }
}

export function createEighteenSeventeenOpening({
    players,
    startingPositions
}: OpeningSetup): Opening {
    assert(
        players.length >= 3 && players.length <= 12,
        '1817 supports three through twelve players'
    )
    const capital = EighteenSeventeenStartingCash[players.length]
    const position: InitialPosition = {
        stockMarket: createEighteenSeventeenStockMarket(),
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
            { owner: { kind: 'bank' }, amount: 'unlimited' },
            ...players.map((player) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: capital
            })),
            ...EighteenSeventeenCorporations.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: 0
            }))
        ],
        certificatePools: [
            { id: MarketPoolId, name: 'Market', owner: { kind: 'bank' } },
            ...EighteenSeventeenCorporations.map((company) => ({
                id: treasuryPoolId(company.id),
                name: 'Treasury',
                owner: { kind: 'company' as const, companyId: company.id }
            }))
        ],
        certificates: [
            ...EighteenSeventeenCorporations.map((company) => ({
                id: `${company.id}:president`,
                companyId: company.id,
                kind: 'share' as const,
                shares: 2,
                president: true,
                certificateLimitCount: 1,
                retired: false as const,
                owner: { kind: 'bank' as const }
            })),
            ...EighteenSeventeenPrivates.map((company) => ({
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
        stations: EighteenSeventeenCorporations.flatMap((company) =>
            createCompanyStations(company.id, 1)
        ),
        stationReservations: EighteenSeventeenMap.stationReservations(),
        tileInventory: EighteenSeventeenTileSet.createInventory(),
        trainInventory: EighteenSeventeenTrainDepot.createInventory(),
        phaseId: '2'
    }
    return {
        position,
        titleState: { seedMoney: EighteenSeventeenSeedMoney },
        begin: beginSelectionAuction(EighteenSeventeenAuctionRules, startingPositions)
    }
}
