import { companyCharters } from '@tabletop/18xx'
import { Privates1870 } from './privates.js'

export type Company1870 = {
    id: string
    name: string
    home: string
    destination: string
    stationCosts: readonly number[]
}

const Three = [0, 40, 100]
const Two = [0, 40]

// The ten public companies, each with its starting city and destination (p. 15, p. 31). The
// charter's costs leave out the destination station, which is free or a later $100 station.
export const Companies1870: readonly Company1870[] = [
    {
        id: 'ATSF',
        name: 'Atchison, Topeka & Santa Fe Railway',
        home: 'B9',
        destination: 'N1',
        stationCosts: Three
    },
    {
        id: 'FW',
        name: 'Fort Worth & Denver City Railway',
        home: 'J3',
        destination: 'A2',
        stationCosts: Two
    },
    {
        id: 'GMO',
        name: 'Gulf, Mobile & Ohio Railroad',
        home: 'M20',
        destination: 'C18',
        stationCosts: Two
    },
    {
        id: 'IC',
        name: 'Illinois Central Railroad',
        home: 'K16',
        destination: 'A22',
        stationCosts: Two
    },
    {
        id: 'MP',
        name: 'Missouri Pacific Railroad',
        home: 'C18',
        destination: 'J5',
        stationCosts: Three
    },
    {
        id: 'MKT',
        name: 'Missouri-Kansas-Texas Railroad',
        home: 'B11',
        destination: 'N1',
        stationCosts: Three
    },
    {
        id: 'SP',
        name: 'Southern Pacific Railroad',
        home: 'N1',
        destination: 'N17',
        stationCosts: Three
    },
    {
        id: 'SSW',
        name: 'St. Louis Southwestern Railway',
        home: 'H17',
        destination: 'J3',
        stationCosts: Two
    },
    {
        id: 'SLSF',
        name: 'St. Louis-San Francisco Railway',
        home: 'E12',
        destination: 'M22',
        stationCosts: Three
    },
    {
        id: 'TP',
        name: 'Texas & Pacific Railway',
        home: 'J5',
        destination: 'N17',
        stationCosts: Two
    }
]

export const CompanyIds1870: readonly string[] = Companies1870.map((company) => company.id)

export function company1870(companyId: string): Company1870 | undefined {
    return Companies1870.find((company) => company.id === companyId)
}

/** The Southern Pacific starts in an offboard location rather than a city (p. 15). */
export const OffboardHomeCompanyId = 'SP'
export const FriscoCompanyId = 'SLSF'
export const KatyCompanyId = 'MKT'
export const RiverCompanyIds: readonly string[] = ['MP', 'SSW']

export const Charters1870 = companyCharters(() => ({
    shareCounts: Object.fromEntries(CompanyIds1870.map((id) => [id, 10])),
    privateRevenues: Object.fromEntries(
        Privates1870.map((company) => [company.id, company.revenue])
    )
}))
