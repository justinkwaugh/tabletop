import { assertExists } from '@tabletop/common'

export type Company1862 = {
    id: string
    initials: string
    name: string
    home: string
    primaryColor: string
    secondaryColor?: string
}

const Yellow = '#f5d90a'
const Orange = '#ff6a06'
const Purple = '#710193'
const Grey = '#a0a0a0'
const Black = '#1f1f1f'
const Red = '#d81e1e'
const Brown = '#8b5a2b'

// The list of companies (§2.1): initials, names, colours and home stations as printed.
export const Companies1862: readonly Company1862[] = [
    {
        id: 'EH',
        initials: 'E&H',
        name: 'Ely & Huntingdon',
        home: 'C8',
        primaryColor: Yellow,
        secondaryColor: '#dd571c'
    },
    {
        id: 'ECR',
        initials: 'ECR',
        name: 'Eastern Counties Railway',
        home: 'D13',
        primaryColor: '#0a1172',
        secondaryColor: Purple
    },
    {
        id: 'ENR',
        initials: 'ENR',
        name: 'East Norfolk Railway',
        home: 'F3',
        primaryColor: Yellow,
        secondaryColor: '#0492c2'
    },
    {
        id: 'ESR',
        initials: 'ESR',
        name: 'East Suffolk Railway',
        home: 'F11',
        primaryColor: '#5dbb63'
    },
    {
        id: 'EUR',
        initials: 'EUR',
        name: 'Eastern Union Railway',
        home: 'E12',
        primaryColor: Red,
        secondaryColor: Purple
    },
    {
        id: 'FDR',
        initials: 'FDR',
        name: 'Felixstowe Dock & Railway',
        home: 'G12',
        primaryColor: Orange,
        secondaryColor: '#c00000'
    },
    {
        id: 'IB',
        initials: 'I&B',
        name: 'Ipswich & Bury Railway',
        home: 'D9',
        primaryColor: Black,
        secondaryColor: Grey
    },
    {
        id: 'LD',
        initials: 'L&D',
        name: 'Lynn & Dereham Railway',
        home: 'D5',
        primaryColor: Orange,
        secondaryColor: '#0a1172'
    },
    {
        id: 'LE',
        initials: 'L&E',
        name: 'Lynn & Ely Railway',
        home: 'C6',
        primaryColor: Red,
        secondaryColor: Yellow
    },
    {
        id: 'LH',
        initials: 'L&H',
        name: 'Lynn & Hunstanton Railway',
        home: 'C4',
        primaryColor: '#a1caf1',
        secondaryColor: '#b00000'
    },
    {
        id: 'NB',
        initials: 'N&B',
        name: 'Norwich & Brandon Railway',
        home: 'E8',
        primaryColor: Grey,
        secondaryColor: '#b64900'
    },
    {
        id: 'NE',
        initials: 'N&E',
        name: 'Northern & Eastern Railway',
        home: 'B13',
        primaryColor: Grey,
        secondaryColor: '#355e3b'
    },
    {
        id: 'NS',
        initials: 'N&S',
        name: 'Norfolk & Suffolk, Joint Railway',
        home: 'H7',
        primaryColor: '#2a52be'
    },
    {
        id: 'YN',
        initials: 'Y&N',
        name: 'Yarmouth & Norwich Railway',
        home: 'H5',
        primaryColor: Black,
        secondaryColor: Red
    },
    {
        id: 'NGC',
        initials: 'NGC',
        name: 'Newmarket and Great Chesterford Railway',
        home: 'C10',
        primaryColor: Yellow,
        secondaryColor: Black
    },
    {
        id: 'SVR',
        initials: 'SVR',
        name: 'Colchester, Stour Valley, Sudbury & Halstead',
        home: 'D11',
        primaryColor: Brown,
        secondaryColor: '#355e3b'
    },
    {
        id: 'WNR',
        initials: 'WNR',
        name: 'West Norfolk Railway',
        home: 'E2',
        primaryColor: Brown,
        secondaryColor: Red
    },
    {
        id: 'WF',
        initials: 'W&F',
        name: 'Wells & Fakenham Railway',
        home: 'E4',
        primaryColor: '#9acd32'
    },
    {
        id: 'WVR',
        initials: 'WVR',
        name: 'Waveney Valley Railway',
        home: 'G8',
        primaryColor: '#7b2d8b',
        secondaryColor: '#ffc0c0'
    },
    {
        id: 'WSTI',
        initials: 'WStI',
        name: 'Wisbech, St Ives & Cambridge Junction Railway',
        home: 'B5',
        primaryColor: '#7b2d8b',
        secondaryColor: Yellow
    }
]

export const CompanyIds1862: readonly string[] = Companies1862.map((company) => company.id)

export function company1862(companyId: string): Company1862 {
    const company = Companies1862.find((candidate) => candidate.id === companyId)
    assertExists(company, `Unknown 1862 company: ${companyId}`)
    return company
}
