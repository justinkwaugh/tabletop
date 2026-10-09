import { EighteenThirtyMajors, EighteenThirtyPrivates } from '../index.js'
import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    type Owner,
    type President,
    type FinancialState
} from '@tabletop/18xx'

const PlayerCash = [600, 450, 700, 500]

export function createEighteenThirtyFinanceExample(
    players: readonly PlayerState[]
): FinancialState {
    assert(
        players.length === 3 || players.length === 4,
        '1830 finance example requires three or four players'
    )
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const bank: Owner = { kind: 'bank' }
    const offering = { owner: bank, poolId: 'initial-offering' }
    const market = { owner: bank, poolId: 'open-market' }
    const playerCash = players.map((_, index) => PlayerCash[index])
    const treasuries = 1200
    return {
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        companies: [
            {
                ...EighteenThirtyMajors.NYC,
                kind: 'major',
                shareCount: 10,
                parPrice: 90,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: alex
            },
            {
                ...EighteenThirtyMajors.PRR,
                kind: 'major',
                shareCount: 10,
                parPrice: 100,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: blair
            },
            ...EighteenThirtyPrivates.filter((company) => ['CS', 'DH'].includes(company.id)).map(
                (company) => ({
                    id: company.id,
                    name: company.name,
                    kind: 'private',
                    privateRevenue: company.revenue
                })
            )
        ],
        certificatePools: [
            { id: 'initial-offering', name: 'IPO', owner: bank },
            { id: 'open-market', name: 'Market', owner: bank }
        ],
        cash: [
            ...players.map((player, index) => ({
                owner: { kind: 'player', playerId: player.playerId } as const,
                amount: playerCash[index]
            })),
            {
                owner: bank,
                amount: 12000 - treasuries - playerCash.reduce((total, cash) => total + cash, 0)
            },
            { owner: { kind: 'company', companyId: 'NYC' }, amount: 600 },
            { owner: { kind: 'company', companyId: 'PRR' }, amount: 600 }
        ],
        certificates: [
            ...createOrdinaryShareCertificates(
                'NYC',
                [
                    { owner: alex },
                    { owner: blair },
                    { owner: casey },
                    market,
                    offering,
                    offering,
                    offering,
                    offering
                ],
                alex
            ),
            ...createOrdinaryShareCertificates(
                'PRR',
                [
                    { owner: blair },
                    { owner: alex },
                    { owner: alex },
                    { owner: alex },
                    offering,
                    offering,
                    offering,
                    offering
                ],
                blair
            ),
            {
                id: 'CS:charter',
                companyId: 'CS',
                kind: 'private',
                retired: false,
                owner: casey
            },
            {
                id: 'DH:charter',
                companyId: 'DH',
                kind: 'private',
                retired: false,
                owner: { kind: 'company', companyId: 'PRR' }
            }
        ]
    }
}
