import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    type Owner,
    type President,
    type FinancialState
} from '@tabletop/18xx'

export function createShikoku1889FinanceExample(players: readonly PlayerState[]): FinancialState {
    assert(players.length === 3, '1889 finance example requires three players')
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const bank: Owner = { kind: 'bank' }
    const offering = { owner: bank, poolId: 'initial-offering' }
    const market = { owner: bank, poolId: 'open-market' }
    return {
        bank: { name: 'Bank' },
        companies: [
            {
                id: 'AR',
                name: 'Awa Railroad',
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
                id: 'IR',
                name: 'Iyo Railway',
                kind: 'major',
                shareCount: 10,
                parPrice: 70,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: blair
            },
            { id: 'MF', name: 'Mitsubishi Ferry', kind: 'private', privateRevenue: 5 },
            { id: 'ER', name: 'Ehime Railroad', kind: 'private', privateRevenue: 10 }
        ],
        certificatePools: [
            { id: 'initial-offering', name: 'IPO', owner: bank },
            { id: 'open-market', name: 'Market', owner: bank }
        ],
        cash: [
            ...players.map((player, index) => ({
                owner: { kind: 'player', playerId: player.playerId } as const,
                amount: [240, 180, 260][index]
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
