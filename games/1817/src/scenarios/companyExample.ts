import { assert, type PlayerState } from '@tabletop/common'
import {
    createCompanyStations,
    issueShareCertificates,
    type CompanyState,
    type MapStateData,
    type President,
    type Station,
    type TrainState
} from '@tabletop/18xx'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenCorporations,
    EighteenSeventeenPrivates,
    EighteenSeventeenTileSet,
    EighteenSeventeenTrainDepot,
    MarketPoolId,
    treasuryPoolId
} from '../index.js'

const PlayerCash = [300, 250, 280, 200]

// Pittsburgh & Lake Erie is a 2-share company at Pittsburgh; Boston & Albany a 5-share company
// at Boston with one share in its treasury and one in the market.
export function createEighteenSeventeenCompanyExample(
    players: readonly PlayerState[],
    position: PreparedPosition
): CompanyState & MapStateData & TrainState {
    assert(
        players.length === 3 || players.length === 4,
        '1817 examples require three or four players'
    )
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const bank = { kind: 'bank' } as const
    const started: Record<string, { president: President; shareCount: number; parPrice: number }> =
        {
            PLE: { president: alex, shareCount: 2, parPrice: 50 },
            BA: { president: blair, shareCount: 5, parPrice: 120 }
        }
    const state: CompanyState & MapStateData & TrainState = {
        bank: { name: 'Bank' },
        companies: [
            ...EighteenSeventeenCorporations.map((company) => ({
                id: company.id,
                name: company.name,
                kind: 'major',
                shareCount: started[company.id]?.shareCount ?? 2,
                started: !!started[company.id],
                floated: !!started[company.id],
                funded: !!started[company.id],
                operated: !!started[company.id],
                ...(started[company.id]
                    ? {
                          president: started[company.id].president,
                          parPrice: started[company.id].parPrice
                      }
                    : {})
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
            ...players.map((player, index) => ({
                owner: { kind: 'player' as const, playerId: player.playerId },
                amount: PlayerCash[index]
            })),
            ...EighteenSeventeenCorporations.map((company) => ({
                owner: { kind: 'company' as const, companyId: company.id },
                amount: company.id === 'PLE' ? 100 : company.id === 'BA' ? 200 : 0
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
            ...EighteenSeventeenCorporations.map((company) => ({
                id: `${company.id}:president`,
                companyId: company.id,
                kind: 'share' as const,
                shares: 2,
                president: true,
                certificateLimitCount: 1,
                retired: false as const,
                owner: started[company.id]?.president ?? bank
            })),
            ...EighteenSeventeenPrivates.map((company) => ({
                id: `${company.id}:charter`,
                companyId: company.id,
                kind: 'private' as const,
                certificateLimitCount: 1,
                retired: false as const,
                owner: company.id === 'MAIL' ? casey : company.id === 'MINC' ? alex : bank
            }))
        ],
        tranches: [],
        ownershipLimitExemptions: [],
        stations: EighteenSeventeenCorporations.flatMap((company) =>
            createCompanyStations(company.id, company.id === 'BA' ? 2 : 1)
        ).map(
            (station): Station =>
                station.id === 'PLE:home'
                    ? {
                          ...station,
                          status: 'placed',
                          position: { locationId: 'F13', nodeId: 'city', slot: 0 }
                      }
                    : station.id === 'BA:home'
                      ? {
                            ...station,
                            status: 'placed',
                            position: { locationId: 'C26', nodeId: 'city', slot: 0 }
                        }
                      : station
        ),
        stationReservations: [],
        tileInventory: EighteenSeventeenTileSet.createInventory(),
        trainInventory: EighteenSeventeenTrainDepot.createInventory(),
        phaseId: '2'
    }
    issueShareCertificates(state, 'BA', 1, { owner: alex })
    issueShareCertificates(state, 'BA', 1, { owner: bank, poolId: MarketPoolId })
    issueShareCertificates(state, 'BA', 1, {
        owner: { kind: 'company', companyId: 'BA' },
        poolId: treasuryPoolId('BA')
    })
    if (position !== 'trading' && position !== 'starting')
        for (const [companyId, rank] of [
            ['PLE', '2'],
            ['BA', '2']
        ] as const) {
            const train = EighteenSeventeenTrainDepot.nextTrain(state.trainInventory, rank)
            assert(train, 'The example requires a train')
            EighteenSeventeenTrainDepot.purchase(state.trainInventory, train.id, rank, {
                kind: 'company',
                companyId
            })
        }
    return state
}
