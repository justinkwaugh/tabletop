import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists } from '@tabletop/common'

const Id = Type.String({ minLength: 1 })
const PlayerOwner = Type.Object(
    { kind: Type.Literal('player'), playerId: Id },
    { additionalProperties: false }
)
const CompanyOwner = Type.Object(
    { kind: Type.Literal('company'), companyId: Id },
    { additionalProperties: false }
)
export const President = Type.Union([PlayerOwner, CompanyOwner])
export type President = Type.Static<typeof President>
export const ControllingOwner = PlayerOwner
export type ControllingOwner = Type.Static<typeof ControllingOwner>
export const Owner = Type.Union([
    President,
    Type.Object({ kind: Type.Literal('bank') }, { additionalProperties: false })
])
export type Owner = Type.Static<typeof Owner>

export const Company = Type.Object(
    {
        id: Id,
        name: Id,
        kind: Id,
        role: Type.Optional(Id),
        shareCount: Type.Optional(Type.Integer({ minimum: 1 })),
        parPrice: Type.Optional(Type.Integer({ minimum: 1 })),
        started: Type.Optional(Type.Boolean()),
        funded: Type.Optional(Type.Boolean()),
        closed: Type.Optional(Type.Boolean()),
        operated: Type.Optional(Type.Boolean()),
        floated: Type.Optional(Type.Boolean()),
        president: Type.Optional(President),
        privateRevenue: Type.Optional(Type.Integer({ minimum: 0 }))
    },
    { additionalProperties: false }
)
export type Company = Type.Static<typeof Company>
export const Bank = Type.Object({ name: Id }, { additionalProperties: false })
export type Bank = Type.Static<typeof Bank>
export const Cash = Type.Object(
    {
        owner: Owner,
        amount: Type.Union([Type.Integer({ minimum: 0 }), Type.Literal('unlimited')])
    },
    { additionalProperties: false }
)
export type Cash = Type.Static<typeof Cash>
export const CertificatePool = Type.Object(
    { id: Id, name: Id, owner: Owner },
    { additionalProperties: false }
)
export type CertificatePool = Type.Static<typeof CertificatePool>

const CertificateFields = {
    id: Id,
    companyId: Id,
    certificateLimitCount: Type.Number({ minimum: 0 })
}
const ShareFields = {
    ...CertificateFields,
    kind: Type.Literal('share'),
    shares: Type.Integer({ minimum: 1 }),
    president: Type.Boolean(),
    number: Type.Optional(Type.Integer({ minimum: 1 }))
}
const PrivateFields = { ...CertificateFields, kind: Type.Literal('private') }
const OwnedFields = { retired: Type.Literal(false), owner: Owner, poolId: Type.Optional(Id) }
const RetiredFields = { retired: Type.Literal(true) }
export const Certificate = Type.Union([
    Type.Object({ ...ShareFields, ...OwnedFields }, { additionalProperties: false }),
    Type.Object({ ...PrivateFields, ...OwnedFields }, { additionalProperties: false }),
    Type.Object({ ...ShareFields, ...RetiredFields }, { additionalProperties: false }),
    Type.Object({ ...PrivateFields, ...RetiredFields }, { additionalProperties: false })
])
export type Certificate = Type.Static<typeof Certificate>
export type Portfolio = Extract<Certificate, { retired: false }>[]
export type Treasury = { cash: Cash['amount'] | undefined; portfolio: Portfolio }

export const FinanceFields = {
    companies: Type.Array(Company),
    bank: Bank,
    certificatePools: Type.Array(CertificatePool),
    cash: Type.Array(Cash),
    certificates: Type.Array(Certificate)
}
export type FinancialState = Type.Static<Type.TObject<typeof FinanceFields>>
const FinanceValidator = Compile(Type.Object(FinanceFields))

export function sameOwner(a: Owner, b: Owner): boolean {
    switch (a.kind) {
        case 'player':
            return b.kind === 'player' && a.playerId === b.playerId
        case 'company':
            return b.kind === 'company' && a.companyId === b.companyId
        case 'bank':
            return b.kind === 'bank'
    }
}

export function countCertificatesForLimit(certificates: readonly Certificate[]): number {
    return certificates.reduce(
        (count, certificate) =>
            count + (certificate.retired ? 0 : certificate.certificateLimitCount),
        0
    )
}

export function validateFinances(state: FinancialState, playerIds: readonly string[]): void {
    assert(FinanceValidator.Check(state), 'Invalid finance fields')
    for (const collection of [state.companies, state.certificatePools, state.certificates]) {
        assert(
            new Set(collection.map((item) => item.id)).size === collection.length,
            'Duplicate financial identity'
        )
    }
    for (const company of state.companies) {
        if (company.president) {
            assert(company.kind !== 'private', 'A private is controlled through its owner')
            assertOwner(state, company.president, playerIds)
        }
    }
    for (const pool of state.certificatePools) assertOwner(state, pool.owner, playerIds)
    for (const [index, cash] of state.cash.entries()) {
        assertOwner(state, cash.owner, playerIds)
        assert(
            !state.cash.slice(0, index).some((other) => sameOwner(other.owner, cash.owner)),
            'Duplicate cash owner'
        )
    }
    const privates = new Set<string>()
    for (const certificate of state.certificates) {
        const company = getCompany(state, certificate.companyId)
        assert(
            (company.kind === 'private') === (certificate.kind === 'private'),
            'Certificate must match its company kind'
        )
        if (certificate.retired) continue
        assertOwner(state, certificate.owner, playerIds)
        if (certificate.poolId !== undefined) {
            const pool = state.certificatePools.find((pool) => pool.id === certificate.poolId)
            assertExists(pool, 'Unknown certificate pool')
            assert(sameOwner(pool.owner, certificate.owner), 'Certificate pool owner mismatch')
        }
        if (certificate.kind === 'private') {
            assert(!privates.has(company.id), 'A private has one ownership certificate')
            privates.add(company.id)
        }
    }
}

export function getCompany(state: Pick<FinancialState, 'companies'>, id: string): Company {
    const company = state.companies.find((company) => company.id === id)
    assertExists(company, `Unknown company: ${id}`)
    return company
}

export function certificatesOwnedBy(
    state: Pick<FinancialState, 'certificates'>,
    owner: Owner
): Portfolio {
    return state.certificates.filter(
        (certificate): certificate is Portfolio[number] =>
            !certificate.retired && sameOwner(certificate.owner, owner)
    )
}

export function certificatesInPool(
    state: Pick<FinancialState, 'certificatePools' | 'certificates'>,
    poolId: string
): Portfolio {
    assert(
        state.certificatePools.some((pool) => pool.id === poolId),
        'Unknown certificate pool'
    )
    return state.certificates.filter(
        (certificate): certificate is Portfolio[number] =>
            !certificate.retired && certificate.poolId === poolId
    )
}

export function cashOwnedBy(
    state: Pick<FinancialState, 'cash'>,
    owner: Owner
): Cash['amount'] | undefined {
    return state.cash.find((cash) => sameOwner(cash.owner, owner))?.amount
}

export function getTreasury(
    state: Pick<FinancialState, 'companies' | 'cash' | 'certificates'>,
    companyId: string
): Treasury {
    getCompany(state, companyId)
    const owner: Owner = { kind: 'company', companyId }
    return { cash: cashOwnedBy(state, owner), portfolio: certificatesOwnedBy(state, owner) }
}

export function sharesOwned(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string,
    owner: Owner
): number {
    return certificatesOwnedBy(state, owner).reduce(
        (sum, certificate) =>
            sum +
            (certificate.kind === 'share' && certificate.companyId === companyId
                ? certificate.shares
                : 0),
        0
    )
}

export function privateOwner(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string
): Owner | undefined {
    assert(getCompany(state, companyId).kind === 'private', 'Expected a private company')
    const certificate = state.certificates.find(
        (certificate) => certificate.companyId === companyId && !certificate.retired
    )
    return certificate && !certificate.retired ? certificate.owner : undefined
}

export function controllingOwner(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string
): ControllingOwner | undefined {
    const visited = new Set<string>()
    let current: Owner | undefined = { kind: 'company', companyId }
    while (current?.kind === 'company') {
        if (visited.has(current.companyId)) return undefined
        visited.add(current.companyId)
        const company = getCompany(state, current.companyId)
        current = company.kind === 'private' ? privateOwner(state, company.id) : company.president
    }
    return current?.kind === 'player' ? current : undefined
}

function assertOwner(
    state: Pick<FinancialState, 'companies'>,
    owner: Owner,
    playerIds: readonly string[]
): void {
    if (owner.kind === 'player')
        assert(playerIds.includes(owner.playerId), `Unknown player: ${owner.playerId}`)
    else if (owner.kind === 'company') getCompany(state, owner.companyId)
}

type CertificateAllocation = Pick<Portfolio[number], 'owner' | 'poolId'>

export function createOrdinaryShareCertificates(
    companyId: string,
    ordinary: readonly CertificateAllocation[],
    president: President | CertificateAllocation
): Certificate[] {
    return [
        {
            id: `${companyId}:president`,
            companyId,
            kind: 'share',
            shares: 2,
            president: true,
            certificateLimitCount: 1,
            retired: false,
            ...('owner' in president ? president : { owner: president })
        },
        ...ordinary.map(
            (allocation, index): Certificate => ({
                id: `${companyId}:share:${index + 1}`,
                companyId,
                kind: 'share',
                shares: 1,
                president: false,
                certificateLimitCount: 1,
                retired: false,
                ...allocation
            })
        )
    ]
}

export function copyFinances(state: FinancialState): FinancialState {
    return {
        bank: { ...state.bank },
        companies: state.companies.map((company) => ({ ...company })),
        cash: state.cash.map((cash) => ({ ...cash })),
        certificatePools: state.certificatePools.map((pool) => ({ ...pool })),
        certificates: state.certificates.map((certificate) => ({ ...certificate }))
    }
}
