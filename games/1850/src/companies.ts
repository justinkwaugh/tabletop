import { companyCharters } from '@tabletop/18xx'
import { Privates1850 } from './privates.js'

export type Company1850 = {
    id: string
    name: string
    home: string
    stationCosts: readonly number[]
    /** The red edge area where a $50 token doubles its value for the company (§7.4). */
    edgeArea?: string
}

const Three = [0, 40, 100]
const Four = [0, 40, 100, 100]

// The nine public companies (§15.3); the charters print each one's token costs and edge token.
export const Companies1850: readonly Company1850[] = [
    {
        id: 'CBQ',
        name: 'Chicago, Burlington & Quincy Railroad',
        home: 'I18',
        stationCosts: Four
    },
    {
        id: 'MILW',
        name: 'Chicago, Milwaukee, St. Paul & Pacific Railroad',
        home: 'G18',
        stationCosts: Three,
        edgeArea: 'A2'
    },
    {
        id: 'RI',
        name: 'Chicago, Rock Island & Pacific Railway',
        home: 'H11',
        stationCosts: Four
    },
    {
        id: 'GN',
        name: 'Great Northern Railway',
        home: 'D9',
        stationCosts: Three,
        edgeArea: 'A2'
    },
    {
        id: 'MKT',
        name: 'Missouri-Kansas-Texas Railroad',
        home: 'K6',
        stationCosts: Three,
        edgeArea: 'M2'
    },
    { id: 'MP', name: 'Missouri Pacific Railroad', home: 'L13', stationCosts: Three },
    {
        id: 'NP',
        name: 'Northern Pacific Railway',
        home: 'B11',
        stationCosts: Three,
        edgeArea: 'A2'
    },
    {
        id: 'SOO',
        name: 'Soo Line Railroad',
        home: 'F13',
        stationCosts: Three,
        edgeArea: 'C20'
    },
    {
        id: 'UP',
        name: 'Union Pacific Railroad',
        home: 'I4',
        stationCosts: Three,
        edgeArea: 'F1'
    }
]

export const CompanyIds1850: readonly string[] = Companies1850.map((company) => company.id)

export function company1850(companyId: string): Company1850 | undefined {
    return Companies1850.find((company) => company.id === companyId)
}

export const RockIslandId = 'RI'
export const MissouriPacificId = 'MP'
export const UnionPacificId = 'UP'

export const Charters1850 = companyCharters(() => ({
    shareCounts: Object.fromEntries(CompanyIds1850.map((id) => [id, 10])),
    privateRevenues: Object.fromEntries(
        Privates1850.map((company) => [company.id, company.revenue])
    )
}))
