import { Shikoku1889Majors } from '@tabletop/shikoku-1889'
import { Shikoku1889Privates } from '@tabletop/shikoku-1889'
import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    type Owner,
    type President,
    type FinancialState
} from '@tabletop/18xx'

export function createShikoku1889FinanceExample(players: readonly PlayerState[]): FinancialState {
    assert(
        players.length === 3 || players.length === 4,
        '1889 finance example requires three or four players'
    )
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const bank: Owner = { kind: 'bank' }
    const offering = { owner: bank, poolId: 'initial-offering' }
    const market = { owner: bank, poolId: 'open-market' }
    return {
        bank: { name: 'Bank', unlimitedAfterExhaustion: true },
        companies: [
            {
                ...Shikoku1889Majors.AR,
                kind: 'major',
                shareCount: 10,
                parPrice: 65,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: alex
            },
            {
                ...Shikoku1889Majors.IR,
                kind: 'major',
                shareCount: 10,
                parPrice: 70,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: blair
            },
            ...Shikoku1889Privates.filter((company) => ['MF', 'ER'].includes(company.id)).map(
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
                amount: [240, 180, 260, 200][index]
            })),
            { owner: bank, amount: 6120 },
            { owner: { kind: 'company', companyId: 'AR' }, amount: 600 },
            { owner: { kind: 'company', companyId: 'IR' }, amount: 600 }
        ],
        certificates: [
            ...createOrdinaryShareCertificates(
                'AR',
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
                'IR',
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
                id: 'MF:charter',
                companyId: 'MF',
                kind: 'private',
                certificateLimitCount: 1,
                retired: false,
                owner: casey
            },
            {
                id: 'ER:charter',
                companyId: 'ER',
                kind: 'private',
                certificateLimitCount: 1,
                retired: false,
                owner: { kind: 'company', companyId: 'IR' }
            }
        ]
    }
}
