import { companyNameVariants, type CompanyNaming } from '@tabletop/18xx-ui'
import {
    CobourgRailwayId,
    CpId,
    DirectorPrivates1828,
    Majors1828,
    Names1828,
    PrivateInitials1828
} from '@tabletop/1828'

// Symbols as table 13.1 prints them.
const MajorSymbols: Readonly<Record<string, string>> = {
    BM: 'B&M',
    BO: 'B&O',
    CO: 'C&O',
    CPR: 'CPR',
    GT: 'GT',
    ERIE: 'ERIE',
    IC: 'IC',
    MC: 'MC',
    MP: 'MP',
    NYC: 'NYC',
    NKP: 'NKP',
    NYH: 'NYH',
    NW: 'NW',
    OSH: 'OS&H',
    PRR: 'PRR',
    WAB: 'WAB'
}

const named = (id: string, initials: string): [string, CompanyNaming] => [
    id,
    { initials, short: Names1828.company(id) }
]

export const CompanyNames1828 = companyNameVariants(
    Names1828,
    Object.fromEntries([
        ...Majors1828.map(({ id }) => named(id, MajorSymbols[id])),
        ...Object.entries(PrivateInitials1828).map(([id, initials]) => named(id, initials)),
        // Each $250 private goes by the public company whose directorship it brings (§13.2.3).
        ...DirectorPrivates1828.map(({ id, companyId }) => named(id, MajorSymbols[companyId])),
        named(CobourgRailwayId, PrivateInitials1828[CpId])
    ])
)
