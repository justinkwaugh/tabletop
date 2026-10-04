import { assertExists } from '@tabletop/common'

export type DraftCompany = {
    id: string
    name: string
    price: number
    revenue: number
} & (
    | { kind: 'private'; debt: 0; group?: 'orange' | 'blue' }
    | { kind: 'independent'; debt: number; home: string }
)
export const DraftCompanies: readonly DraftCompany[] = [
    {
        kind: 'independent',
        id: 'MS',
        name: 'Michigan Southern',
        price: 60,
        debt: 80,
        revenue: 0,
        home: 'C15'
    },
    { kind: 'independent', id: 'BIG4', name: 'Big 4', price: 40, debt: 60, revenue: 0, home: 'G9' },
    {
        kind: 'private',
        id: 'C&WI',
        name: 'Chicago & Western Indiana',
        price: 60,
        debt: 0,
        revenue: 10
    },
    { kind: 'private', id: 'MAIL', name: 'Mail Contract', price: 80, debt: 0, revenue: 0 },
    {
        kind: 'private',
        id: 'LSL',
        name: 'Lake Shore Line',
        price: 40,
        debt: 0,
        revenue: 15,
        group: 'orange'
    },
    {
        kind: 'private',
        id: 'LM',
        name: 'Little Miami',
        price: 40,
        debt: 0,
        revenue: 15,
        group: 'orange'
    },
    {
        kind: 'private',
        id: 'MC',
        name: 'Michigan Central',
        price: 40,
        debt: 0,
        revenue: 15,
        group: 'orange'
    },
    {
        kind: 'private',
        id: 'O&I',
        name: 'Ohio & Indiana',
        price: 40,
        debt: 0,
        revenue: 15,
        group: 'orange'
    },
    { kind: 'private', id: 'BT', name: 'Boomtown', price: 40, debt: 0, revenue: 10, group: 'blue' },
    {
        kind: 'private',
        id: 'SC',
        name: 'Steamboat Company',
        price: 40,
        debt: 0,
        revenue: 10,
        group: 'blue'
    },
    {
        kind: 'private',
        id: 'MPC',
        name: 'Meat Packing Company',
        price: 60,
        debt: 0,
        revenue: 15,
        group: 'blue'
    },
    {
        kind: 'private',
        id: 'TBC',
        name: 'Tunnel Blasting Company',
        price: 60,
        debt: 0,
        revenue: 20,
        group: 'blue'
    }
]
export const Corporations = [
    { id: 'PRR', name: 'Pennsylvania Railroad', home: 'F20', tokens: 5 },
    { id: 'NYC', name: 'New York Central Railroad', home: 'D20', tokens: 4 },
    { id: 'B&O', name: 'Baltimore & Ohio Railroad', home: 'G19', tokens: 4 },
    { id: 'C&O', name: 'Chesapeake & Ohio Railroad', home: 'I15', tokens: 4 },
    { id: 'ERIE', name: 'Erie Railroad', home: 'E21', tokens: 4 },
    { id: 'GT', name: 'Grand Trunk Railway', home: 'B16', tokens: 3 },
    { id: 'IC', name: 'Illinois Central Railroad', home: 'K3', tokens: 4 }
] as const
export function draftCompany(id: string): DraftCompany {
    const company = DraftCompanies.find((company) => company.id === id)
    assertExists(company, `Unknown draft company ${id}`)
    return company
}
export function isBlank(id: string): boolean {
    return id.startsWith('blank:')
}
export const BankSize: Readonly<Record<number, number>> = { 3: 6500, 4: 7500, 5: 9000 }
