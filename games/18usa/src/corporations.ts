/** The twenty public companies; all are alike, and any may start in any open city (§7.2). */
export const EighteenUSACorporations = [
    {
        id: 'ATSF',
        name: 'Atchison, Topeka and Santa Fe',
        abbreviation: 'ATSF',
        color: '#7090c9',
        textColor: '#ffffff'
    },
    {
        id: 'BO',
        name: 'Baltimore and Ohio Railroad',
        abbreviation: 'B&O',
        color: '#025aaa',
        textColor: '#ffffff'
    },
    {
        id: 'CO',
        name: 'Chesapeake and Ohio',
        abbreviation: 'C&O',
        color: '#add8e6',
        textColor: '#000000'
    },
    {
        id: 'DRG',
        name: 'Denver and Rio Grande',
        abbreviation: 'DRG',
        color: '#a0522d',
        textColor: '#ffffff'
    },
    {
        id: 'GN',
        name: 'Great Northern Railway',
        abbreviation: 'GN',
        color: '#87cefa',
        textColor: '#000000'
    },
    {
        id: 'IC',
        name: 'Illinois Central Railroad',
        abbreviation: 'IC',
        color: '#32763f',
        textColor: '#ffffff'
    },
    {
        id: 'KCS',
        name: 'Kansas City Southern Railroad',
        abbreviation: 'KCS',
        color: '#ff0000',
        textColor: '#ffffff'
    },
    {
        id: 'MILW',
        name: 'Milwaukee Road',
        abbreviation: 'MILW',
        color: '#808080',
        textColor: '#ffffff'
    },
    {
        id: 'MKT',
        name: 'Missouri-Kansas-Texas Railroad',
        abbreviation: 'MKT',
        color: '#018471',
        textColor: '#ffffff'
    },
    {
        id: 'MP',
        name: 'Missouri Pacific Railroad',
        abbreviation: 'MP',
        color: '#4b0082',
        textColor: '#ffffff'
    },
    {
        id: 'NYC',
        name: 'New York Central Railroad',
        abbreviation: 'NYC',
        color: '#110a0c',
        textColor: '#ffffff'
    },
    {
        id: 'NW',
        name: 'Norfolk and Western Railway',
        abbreviation: 'N&W',
        color: '#8b0000',
        textColor: '#ffffff'
    },
    {
        id: 'NP',
        name: 'Northern Pacific Railway',
        abbreviation: 'NP',
        color: '#000000',
        textColor: '#ffffff'
    },
    {
        id: 'PRR',
        name: 'Pennsylvania Railroad',
        abbreviation: 'PRR',
        color: '#9acd32',
        textColor: '#000000'
    },
    {
        id: 'SP',
        name: 'Southern Pacific Railroad',
        abbreviation: 'SP',
        color: '#f48221',
        textColor: '#ffffff'
    },
    {
        id: 'SR',
        name: 'Southern Railway',
        abbreviation: 'SR',
        color: '#228b22',
        textColor: '#ffffff'
    },
    {
        id: 'SLSF',
        name: 'St. Louis-San Francisco Railway',
        abbreviation: 'SLSF',
        color: '#d02020',
        textColor: '#ffffff'
    },
    {
        id: 'TP',
        name: 'Texas and Pacific Railway',
        abbreviation: 'TP',
        color: '#800080',
        textColor: '#ffffff'
    },
    {
        id: 'UP',
        name: 'Union Pacific Railroad',
        abbreviation: 'UP',
        color: '#ffd700',
        textColor: '#000000'
    },
    {
        id: 'WP',
        name: 'Western Pacific Railroad',
        abbreviation: 'WP',
        color: '#a52a2a',
        textColor: '#ffffff'
    }
] as const

/** The share counts a company may have, by the size chosen as it starts or converts. */
export const CompanyShareCounts = [2, 5, 10] as const
