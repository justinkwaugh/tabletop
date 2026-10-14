import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'

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

export const CompanyProperties = {
    id: Id,
    kind: Id,
    shareCount: Type.Optional(Type.Integer({ minimum: 1 })),
    parPrice: Type.Optional(Type.Integer({ minimum: 1 })),
    started: Type.Optional(Type.Boolean()),
    funded: Type.Optional(Type.Boolean()),
    closed: Type.Optional(Type.Boolean()),
    operated: Type.Optional(Type.Boolean()),
    floated: Type.Optional(Type.Boolean()),
    president: Type.Optional(President),
    privateRevenue: Type.Optional(Type.Integer({ minimum: 0 })),
    /** The highest number its certificates or stations have used, once any has left play. */
    lastIssuedNumber: Type.Optional(Type.Integer({ minimum: 1 }))
}
export const CompanyLoanFields = { loans: Type.Optional(Type.Integer({ minimum: 1 })) }
export const CompanyRoleFields = { role: Type.Optional(Id) }
export const OrdinaryCompany = Type.Object(CompanyProperties, { additionalProperties: false })
export const BorrowingCompany = Type.Object(
    { ...CompanyProperties, ...CompanyLoanFields },
    { additionalProperties: false }
)
export const RoleCompany = Type.Object(
    { ...CompanyProperties, ...CompanyRoleFields },
    { additionalProperties: false }
)
export const Company = Type.Object(
    { ...CompanyProperties, ...CompanyLoanFields, ...CompanyRoleFields },
    { additionalProperties: false }
)
export type Company = Type.Static<typeof Company>
export const Bank = Type.Object(
    {
        unlimitedAfterExhaustion: Type.Optional(Type.Boolean()),
        broken: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
)
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
    { id: Id, owner: Owner },
    { additionalProperties: false }
)
export type CertificatePool = Type.Static<typeof CertificatePool>

const CertificateFields = {
    id: Id,
    companyId: Id
}
const ShareFields = {
    ...CertificateFields,
    kind: Type.Literal('share'),
    shares: Type.Integer({ minimum: 1 }),
    president: Type.Optional(Type.Literal(true))
}
const PrivateFields = { ...CertificateFields, kind: Type.Literal('private') }
// A short owes its holder's shares of the company back: it nets against their shares.
const ShortFields = {
    ...CertificateFields,
    kind: Type.Literal('short'),
    shares: Type.Integer({ minimum: 1 })
}
const OwnedFields = { owner: Owner, poolId: Type.Optional(Id) }
const ShareCertificate = Type.Object(
    { ...ShareFields, ...OwnedFields },
    { additionalProperties: false }
)
const PrivateCertificate = Type.Object(
    { ...PrivateFields, ...OwnedFields },
    { additionalProperties: false }
)
const ShortCertificate = Type.Object(
    { ...ShortFields, ...OwnedFields },
    { additionalProperties: false }
)
const NumberedShareCertificate = Type.Object(
    {
        ...ShareFields,
        number: Type.Optional(Type.Integer({ minimum: 1 })),
        ...OwnedFields
    },
    { additionalProperties: false }
)
export const OrdinaryCertificate = Type.Union([ShareCertificate, PrivateCertificate])
export const ShortingCertificate = Type.Union([
    ShareCertificate,
    PrivateCertificate,
    ShortCertificate
])
export const NumberedCertificate = Type.Union([NumberedShareCertificate, PrivateCertificate])
export const Certificate = Type.Union([
    NumberedShareCertificate,
    PrivateCertificate,
    ShortCertificate
])
export type Certificate = Type.Static<typeof Certificate>
export type Portfolio = Certificate[]
export type OpenShare = Extract<Certificate, { kind: 'share' }>
export type OpenShort = Extract<Certificate, { kind: 'short' }>
export type Treasury = { cash: Cash['amount'] | undefined; portfolio: Portfolio }

export const FinanceFields = {
    companies: Type.Array(Company),
    bank: Bank,
    certificatePools: Type.Array(CertificatePool),
    cash: Type.Array(Cash),
    certificates: Type.Array(Certificate)
}
export type FinancialState = Type.Static<Type.TObject<typeof FinanceFields>>
const FinanceValidator: Pick<Validator, 'Check'> = Compile(
    Type.Object({
        ...FinanceFields,
        companies: Type.Array(Type.Object(Company.properties)),
        certificates: Type.Array(
            Type.Union(Certificate.anyOf.map((certificate) => Type.Object(certificate.properties)))
        )
    })
)

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

/** A certificate's weight toward the certificate limit before any title or market exemption. */
export function standardCertificateWeight(certificate: Portfolio[number]): number {
    return certificate.kind === 'short' ? 0 : 1
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

export function getCompany<C extends Company>(state: { companies: C[] }, id: string): C {
    const company = state.companies.find((company) => company.id === id)
    assertExists(company, `Unknown company: ${id}`)
    return company
}

export function certificatesOwnedBy(
    state: Pick<FinancialState, 'certificates'>,
    owner: Owner
): Portfolio {
    return state.certificates.filter((certificate) => sameOwner(certificate.owner, owner))
}

export function certificatesInPool(
    state: Pick<FinancialState, 'certificatePools' | 'certificates'>,
    poolId: string
): Portfolio {
    assert(
        state.certificatePools.some((pool) => pool.id === poolId),
        'Unknown certificate pool'
    )
    return state.certificates.filter((certificate) => certificate.poolId === poolId)
}

export function cashOwnedBy(
    state: Pick<FinancialState, 'cash'>,
    owner: Owner
): Cash['amount'] | undefined {
    return state.cash.find((cash) => sameOwner(cash.owner, owner))?.amount
}

/** The cash of an owner whose balance is finite, as every player's and company's is. */
export function finiteCashOwnedBy(state: Pick<FinancialState, 'cash'>, owner: Owner): number {
    const cash = cashOwnedBy(state, owner)
    assert(typeof cash === 'number', 'This owner requires a finite cash balance')
    return cash
}

export function getTreasury(
    state: Pick<FinancialState, 'companies' | 'cash' | 'certificates'>,
    companyId: string
): Treasury {
    getCompany(state, companyId)
    const owner: Owner = { kind: 'company', companyId }
    return { cash: cashOwnedBy(state, owner), portfolio: certificatesOwnedBy(state, owner) }
}

export function openShares(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string
): OpenShare[] {
    return state.certificates.flatMap((certificate) =>
        certificate.kind === 'share' && certificate.companyId === companyId ? [certificate] : []
    )
}

export function presidentCertificate(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string
): OpenShare | undefined {
    return openShares(state, companyId).find((certificate) => certificate.president)
}

export function sharesOwned(
    state: Pick<FinancialState, 'certificates'>,
    companyId: string,
    owner: Owner
): number {
    return certificatesOwnedBy(state, owner).reduce(
        (sum, certificate) =>
            sum + (certificate.companyId === companyId ? signedShares(certificate) : 0),
        0
    )
}

/** A certificate's shares, negative for a short and none for a private. */
export function signedShares(certificate: Portfolio[number]): number {
    return certificate.kind === 'share'
        ? certificate.shares
        : certificate.kind === 'short'
          ? -certificate.shares
          : 0
}

export function privateOwner(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string
): Owner | undefined {
    assert(getCompany(state, companyId).kind === 'private', 'Expected a private company')
    return state.certificates.find((certificate) => certificate.companyId === companyId)?.owner
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
        const company: Company = getCompany(state, current.companyId)
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
): OpenShare[] {
    return [
        {
            id: `${companyId}:president`,
            companyId,
            kind: 'share',
            shares: 2,
            president: true,
            ...('owner' in president ? president : { owner: president })
        },
        ...ordinary.map((allocation, index) =>
            ordinaryShareCertificate(companyId, index + 1, allocation)
        )
    ]
}

/** Issues one-share certificates numbered after every certificate the company has had. */
export function issueShareCertificates(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    companyId: string,
    count: number,
    allocation: CertificateAllocation
): string[] {
    const first = nextIssuedNumber(
        state,
        companyId,
        state.certificates.map((certificate) => certificate.id),
        ordinaryShareIdPrefix(companyId)
    )
    return Array.from({ length: count }, (_, index) => {
        const certificate = ordinaryShareCertificate(companyId, first + index, allocation)
        state.certificates.push(certificate)
        return certificate.id
    })
}

/**
 * The next number for an id such as `BA:share:` or `BA:station:`, after every one in play and
 * every one that has left play, so a recorded action's id never names a later record.
 */
export function nextIssuedNumber(
    state: Pick<FinancialState, 'companies'>,
    companyId: string,
    idsInPlay: readonly string[],
    prefix: string
): number {
    const numbers = idsInPlay.flatMap((id) =>
        id.startsWith(prefix) ? [Number(id.slice(prefix.length))] : []
    )
    return Math.max(getCompany(state, companyId).lastIssuedNumber ?? 0, ...numbers) + 1
}

/** Records the number of an id leaving play, so a later record cannot reuse it. */
export function recordLeavingNumber(
    state: Pick<FinancialState, 'companies'>,
    companyId: string,
    id: string
): void {
    const number = Number(id.slice(id.lastIndexOf(':') + 1))
    if (!Number.isInteger(number) || number < 1) return
    const company = getCompany(state, companyId)
    if (number > (company.lastIssuedNumber ?? 0)) company.lastIssuedNumber = number
}

/** Takes certificates out of play: retired, exchanged, closed or cancelled. */
export function removeCertificates(
    state: Pick<FinancialState, 'companies' | 'certificates'>,
    ids: readonly string[]
): void {
    for (const certificate of state.certificates)
        if (ids.includes(certificate.id))
            recordLeavingNumber(state, certificate.companyId, certificate.id)
    state.certificates = state.certificates.filter((certificate) => !ids.includes(certificate.id))
}

function ordinaryShareIdPrefix(companyId: string): string {
    return `${companyId}:share:`
}

function ordinaryShareCertificate(
    companyId: string,
    number: number,
    allocation: CertificateAllocation
): OpenShare {
    return {
        id: `${ordinaryShareIdPrefix(companyId)}${number}`,
        companyId,
        kind: 'share',
        shares: 1,
        ...allocation
    }
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
