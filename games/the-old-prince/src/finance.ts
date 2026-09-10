import { assert, assertExists, type PlayerState } from '@tabletop/common'
import {
    createOrdinaryShareCertificates,
    sameOwner,
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
        bank: { name: 'Bank' },
        companies: [
            { id: 'UB', name: 'Union Bank', kind: 'private', privateRevenue: 0 },
            {
                id: 'ML',
                name: 'Charlottetown · Mainline',
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
                name: 'Souris',
                role: 'shortline',
                kind: 'major',
                shareCount: 10,
                started: true,
                funded: true,
                operated: true,
                floated: true,
                president: union
            },
            { id: 'PEIR', name: 'Prince Edward Island Railway', kind: 'major', president: blair },
            { id: 'VR', name: 'Vernon River Bridge', kind: 'private', privateRevenue: 10 },
            { id: 'KM', name: 'The King’s Mail', kind: 'private', privateRevenue: 60 }
        ],
        certificatePools: [
            { id: 'market', name: 'Market', owner: bank },
            {
                id: 'treasury:ML',
                name: 'Treasury shares',
                owner: { kind: 'company', companyId: 'ML' }
            },
            { id: 'reserved', name: 'Reserved exchanges', owner: bank }
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
                certificateLimitCount: 1,
                retired: false,
                owner: alex
            },
            {
                id: 'VR:charter',
                companyId: 'VR',
                kind: 'private',
                certificateLimitCount: 1,
                retired: false,
                owner: casey
            },
            {
                id: 'KM:charter',
                companyId: 'KM',
                kind: 'private',
                certificateLimitCount: 1,
                retired: false,
                owner: { kind: 'company', companyId: 'PEIR' }
            },
            ...[alex, blair, casey, blair, casey].map(
                (owner, index): Certificate => ({
                    id: `PEIR:share:${index + 2}`,
                    companyId: 'PEIR',
                    kind: 'share',
                    shares: 1,
                    president: false,
                    number: index + 2,
                    certificateLimitCount: 1,
                    retired: false,
                    owner
                })
            )
        ]
    }
}

export function peirShares(state: FinancialState) {
    return state.certificates
        .filter((certificate) => !certificate.retired)
        .filter((certificate) => certificate.kind === 'share')
        .filter((certificate) => certificate.companyId === 'PEIR')
}

export function peirEntitlement(
    state: FinancialState,
    owner: Owner
): { owned: number; outstanding: number } {
    const shares = peirShares(state)
    return {
        owned: shares.filter((certificate) => sameOwner(certificate.owner, owner)).length,
        outstanding: shares.length
    }
}

export function peirPresident(state: FinancialState): string | undefined {
    const ownership = new Map<string, { count: number; lowest: number }>()
    for (const certificate of peirShares(state)) {
        if (certificate.owner.kind !== 'player') continue
        assertExists(certificate.number, 'PEIR shares require a number')
        const previous = ownership.get(certificate.owner.playerId)
        ownership.set(certificate.owner.playerId, {
            count: (previous?.count ?? 0) + 1,
            lowest: Math.min(previous?.lowest ?? Infinity, certificate.number)
        })
    }
    return [...ownership].sort(
        (a, b) => b[1].count - a[1].count || a[1].lowest - b[1].lowest
    )[0]?.[0]
}
