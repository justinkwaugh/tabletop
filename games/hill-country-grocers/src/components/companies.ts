import { Color } from '@tabletop/common'

export enum CompanyId {
    AlamoCity = 'ACS',
    Verbena = 'VER',
    Streamside = 'SS',
    CompleteComestibles = 'CC',
    Balcones = 'BB'
}

export enum CompanyKind {
    Grocer = 'Grocer',
    Developer = 'Developer'
}

export type CompanyDefinition = {
    id: CompanyId
    name: string
    shortName: string
    color: Color
    kind: CompanyKind
    // Cubes for a grocer, developments for the developer.
    supply: number
    ability: string
}

export const COMPANIES: readonly CompanyDefinition[] = [
    {
        id: CompanyId.AlamoCity,
        name: 'Alamo City Supplies',
        shortName: 'Alamo City',
        color: Color.Red,
        kind: CompanyKind.Grocer,
        supply: 12,
        ability: 'May place a third store when building'
    },
    {
        id: CompanyId.Verbena,
        name: 'Verbena',
        shortName: 'Verbena',
        color: Color.Green,
        kind: CompanyKind.Grocer,
        supply: 10,
        ability: 'One store per build pays no fees to other grocers'
    },
    {
        id: CompanyId.Streamside,
        name: 'Streamside Sisters',
        shortName: 'Streamside',
        color: Color.Blue,
        kind: CompanyKind.Grocer,
        supply: 11,
        ability: 'Winning a share lets the buyer place a store'
    },
    {
        id: CompanyId.CompleteComestibles,
        name: 'Complete Comestibles',
        shortName: 'Comestibles',
        color: Color.Orange,
        kind: CompanyKind.Grocer,
        supply: 8,
        ability: 'Developments in its cities add $3 to its value'
    },
    {
        id: CompanyId.Balcones,
        name: 'Balcones Builders',
        shortName: 'Balcones',
        color: Color.Gray,
        kind: CompanyKind.Developer,
        supply: 20,
        ability: 'Pays $1 to each grocer in a city when it is developed'
    }
]

export const MAX_CUBES_PER_BUILD = 2
export const ALAMO_CITY_CUBES_PER_BUILD = 3
export const CUBE_BANK_COST = 2
export const CUBE_FEE = 1

export function sharesPerCompany(playerCount: number): number {
    return playerCount === 3 ? 4 : 5
}

export function companyDefinition(id: CompanyId): CompanyDefinition {
    const company = COMPANIES.find((candidate) => candidate.id === id)
    if (!company) {
        throw Error(`Unknown company ${id}`)
    }
    return company
}

export function isGrocer(id: CompanyId): boolean {
    return companyDefinition(id).kind === CompanyKind.Grocer
}

export const GROCER_IDS: readonly CompanyId[] = COMPANIES.filter(
    (company) => company.kind === CompanyKind.Grocer
).map((company) => company.id)
