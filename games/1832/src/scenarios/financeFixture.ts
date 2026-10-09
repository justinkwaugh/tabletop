import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    type FinancialState,
    type Owner,
    type President
} from '@tabletop/18xx'
import { EighteenThirtyTwoMajors, EighteenThirtyTwoPrivates } from '../index.js'

const PlayerCash = [600, 450, 700, 500]

/** ACL and CG in play, with the Cotton Warehouse held by a player and the coal fields by CG. */
export function createEighteenThirtyTwoFinanceExample(
    players: readonly PlayerState[]
): FinancialState {
    assert(
        players.length === 3 || players.length === 4,
        '1832 finance example requires three or four players'
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
        bank: { unlimitedAfterExhaustion: true },
        companies: [
            {
                id: EighteenThirtyTwoMajors.ACL.id,
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
                id: EighteenThirtyTwoMajors.CG.id,
                kind: 'major',
                shareCount: 10,
                parPrice: 100,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: blair
            },
            ...EighteenThirtyTwoPrivates.filter((company) => ['P2', 'P5'].includes(company.id)).map(
                (company) => ({
                    id: company.id,
                    kind: 'private',
                    privateRevenue: company.revenue
                })
            )
        ],
        certificatePools: [
            { id: 'initial-offering', owner: bank },
            { id: 'open-market', owner: bank }
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
            { owner: { kind: 'company', companyId: 'ACL' }, amount: 600 },
            { owner: { kind: 'company', companyId: 'CG' }, amount: 600 }
        ],
        certificates: [
            ...createOrdinaryShareCertificates(
                'ACL',
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
                'CG',
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
                id: 'P2:charter',
                companyId: 'P2',
                kind: 'private',
                owner: casey
            },
            {
                id: 'P5:charter',
                companyId: 'P5',
                kind: 'private',
                owner: { kind: 'company', companyId: 'CG' }
            }
        ]
    }
}
