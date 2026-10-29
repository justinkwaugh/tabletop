import { companyCharters, type CityReservation } from '@tabletop/18xx'

export type Corporation1833NE = {
    id: string
    name: string
    home: string | CityReservation
}

/** The nine Standard game railroads, with their home cities (rulebook p. 24, corporate mats). */
export const Corporations1833NE: readonly Corporation1833NE[] = [
    { id: 'B&W', name: 'Boston & Worcester', home: { companyId: 'B&W', nodeId: 'city-0' } },
    { id: 'B&P', name: 'Boston & Providence', home: 'F25' },
    { id: 'B&L', name: 'Boston & Lowell Railroad', home: { companyId: 'B&L', nodeId: 'city-1' } },
    { id: 'FRR', name: 'Fitchburg Railroad', home: 'E20' },
    { id: 'HR', name: 'Hartford Railroad', home: 'C24' },
    { id: 'RR', name: 'Rutland Railroad', home: 'C12' },
    { id: 'CV', name: 'Central Vermont Railroad', home: 'C8' },
    {
        id: 'StL&A',
        name: 'St. Lawrence & Atlantic',
        home: { companyId: 'StL&A', nodeId: 'city-1' }
    },
    { id: 'A&StL', name: 'Atlantic & St. Lawrence', home: 'I14' }
]

export const CorporationHomes: Readonly<Record<string, string>> = {
    'B&W': 'G22',
    'B&P': 'F25',
    'B&L': 'G22',
    FRR: 'E20',
    HR: 'C24',
    RR: 'C12',
    CV: 'C8',
    'StL&A': 'B3',
    'A&StL': 'I14'
}

/** Each corporation has a free home token and one more for $80 (§5.34, §6.51). */
export const StationCount = 2

export type Private1833NE = {
    id: string
    name: string
    faceValue: number
    revenue: number
    blocks?: readonly string[]
}

export const Privates1833NE: readonly Private1833NE[] = [
    { id: 'P1', name: 'Granite Railway', faceValue: 15, revenue: 5, blocks: ['H23'] },
    { id: 'P2', name: 'Lowell Merchants', faceValue: 40, revenue: 10, blocks: ['G20'] },
    {
        id: 'P3',
        name: 'Champlain & St. Lawrence',
        faceValue: 50,
        revenue: 10,
        blocks: ['C4', 'C6']
    },
    { id: 'P4', name: 'Ogdensburg Railroad', faceValue: 60, revenue: 15 },
    { id: 'P5', name: 'Luxury Ferry Service', faceValue: 70, revenue: 15 },
    { id: 'P6', name: 'Delaware & Hudson RR', faceValue: 80, revenue: 30 }
]

export const Charters1833NE = companyCharters(() => ({
    shareCounts: Object.fromEntries(Corporations1833NE.map((company) => [company.id, 10])),
    privateRevenues: Object.fromEntries(
        Privates1833NE.map((company) => [company.id, company.revenue])
    )
}))
