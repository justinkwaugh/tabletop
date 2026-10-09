import { TheOldPrinceKingsMail } from '../index.js'
import { assert, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    type Certificate,
    type Owner,
    type President,
    type FinancialState
} from '@tabletop/18xx'

export function createTheOldPrinceFinanceExample(players: readonly PlayerState[]): FinancialState {
    assert(
        players.length === 3 || players.length === 4,
        'TOP finance example requires three or four players'
    )
    const [alex, blair, casey]: President[] = players.map((player) => ({
        kind: 'player',
        playerId: player.playerId
    }))
    const bank: Owner = { kind: 'bank' }
    const union: President = { kind: 'company', companyId: 'UB' }
    const market = { owner: bank, poolId: 'market' }
    return {
        bank: {},
        companies: [
            { id: 'UB', kind: 'private', privateRevenue: 0 },
            {
                id: 'ML',
                role: 'mainline',
                kind: 'major',
                shareCount: 10,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: alex
            },
            {
                id: 'So',
                role: 'shortline',
                kind: 'major',
                shareCount: 10,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: union
            },
            { id: 'PEIR', kind: 'major', president: blair },
            { id: 'VR', kind: 'private', privateRevenue: 10 },
            {
                id: TheOldPrinceKingsMail.id,
                kind: 'private',
                privateRevenue: TheOldPrinceKingsMail.revenue
            }
        ],
        certificatePools: [
            { id: 'market', owner: bank },
            {
                id: 'treasury:ML',
                owner: { kind: 'company', companyId: 'ML' }
            },
            { id: 'reserved', owner: bank }
        ],
        cash: [
            ...players.map((player, index) => ({
                owner: { kind: 'player', playerId: player.playerId } as const,
                amount: [240, 180, 160, 200][index]
            })),
            { owner: bank, amount: 'unlimited' },
            { owner: union, amount: 40 },
            { owner: { kind: 'company', companyId: 'ML' }, amount: 920 },
            { owner: { kind: 'company', companyId: 'So' }, amount: 0 },
            { owner: { kind: 'company', companyId: 'PEIR' }, amount: 200 }
        ],
        certificates: [
            ...createOrdinaryShareCertificates(
                'ML',
                [
                    { owner: alex },
                    { owner: union },
                    { owner: blair },
                    { owner: blair },
                    market,
                    market,
                    { owner: { kind: 'company', companyId: 'ML' }, poolId: 'treasury:ML' },
                    { owner: bank, poolId: 'reserved' }
                ],
                alex
            ),
            ...createOrdinaryShareCertificates(
                'So',
                [
                    { owner: union },
                    { owner: alex },
                    { owner: blair },
                    market,
                    market,
                    market,
                    market,
                    { owner: bank, poolId: 'reserved' }
                ],
                union
            ),
            {
                id: 'UB:charter',
                companyId: 'UB',
                kind: 'private',
                owner: alex
            },
            {
                id: 'VR:charter',
                companyId: 'VR',
                kind: 'private',
                owner: casey
            },
            {
                id: 'KM:charter',
                companyId: 'KM',
                kind: 'private',
                owner: { kind: 'company', companyId: 'PEIR' }
            },
            ...[alex, blair, casey, blair, casey].map((owner, index): Certificate => ({
                id: `PEIR:share:${index + 2}`,
                companyId: 'PEIR',
                kind: 'share',
                shares: 1,
                number: index + 2,
                owner
            }))
        ]
    }
}
