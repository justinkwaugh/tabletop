import { PrivateCatalog, companyCharters, placeReference as place } from '@tabletop/18xx'
import { CopperCanyonLocationId } from './map.js'
import { PhasesMex } from './trains.js'

export const NdmId = 'NdM'
export const UdyId = 'UdY'
export const ChiId = 'CHI'
export const MinorAId = 'A'
export const MinorBId = 'B'
export const MinorCId = 'C'
export const McarId = 'MCAR'
export const KcmoId = 'KCMO'
export const MirId = 'MIR'
export const MnrId = 'MNR'

export type MajorMex = { id: string; name: string; initials: string }

/** The eight major companies, in the order of the Initial Offering display. */
export const MajorsMex: readonly MajorMex[] = [
    { id: ChiId, name: 'Chihuahua Pacific Railway', initials: 'CHI' },
    { id: NdmId, name: 'National Railways of Mexico', initials: 'NdM' },
    { id: 'MC', name: 'Mexican Central Railway', initials: 'MC' },
    { id: 'PAC', name: 'Pacific Railroad', initials: 'PAC' },
    { id: 'TM', name: 'Texas-Mexican Railway', initials: 'TM' },
    { id: 'MEX', name: 'Mexican Railway', initials: 'MEX' },
    { id: 'SPM', name: 'Southern Pacific Railroad of Mexico', initials: 'SPM' },
    { id: UdyId, name: 'United Railways of Yucatan', initials: 'UdY' }
]
export const MajorIdsMex: readonly string[] = MajorsMex.map((major) => major.id)

/** The majors that may merge into the NdM, as their charters say (5.3(b)). */
export const MergeableMajorIds: readonly string[] = [ChiId, 'MC', 'MEX', 'SPM', UdyId]

export type MinorMex = {
    id: string
    number: number
    name: string
    faceValue: number
    /** The major whose trade-in certificate the owner receives as the minor closes (5.2). */
    majorId: string
    tradeInCertificateId: string
}

/** The minor companies, sold with the privates as #3 to #5 (Table III). */
export const MinorsMex: readonly MinorMex[] = [
    {
        id: MinorAId,
        number: 3,
        name: 'Interoceanic Railroad',
        faceValue: 50,
        majorId: NdmId,
        tradeInCertificateId: 'NdM:half:1'
    },
    {
        id: MinorBId,
        number: 4,
        name: 'Sonora-Baja California Railway',
        faceValue: 50,
        majorId: NdmId,
        tradeInCertificateId: 'NdM:half:2'
    },
    {
        id: MinorCId,
        number: 5,
        name: 'Southeastern Railway',
        faceValue: 50,
        majorId: UdyId,
        tradeInCertificateId: `${UdyId}:share:8`
    }
]
export const MinorIdsMex: readonly string[] = MinorsMex.map((minor) => minor.id)

export function isMinorMex(companyId: string): boolean {
    return MinorIdsMex.includes(companyId)
}

export function minorMex(id: string): MinorMex | undefined {
    return MinorsMex.find((minor) => minor.id === id)
}

/**
 * The private companies (Table III, with the designer's erratum closing the KCM&O as its tile is
 * laid). Majors buy them from the first 3-train for half to one and a half times face value
 * (4.3.5); all close with the first 5-train.
 */
export const PrivateCatalogMex = new PrivateCatalog(
    {
        closurePhaseId: '5',
        privates: [
            {
                id: McarId,
                name: 'Mexico City-Acapulco Railroad',
                faceValue: 20,
                revenue: 5,
                sale: { minimum: 10, maximum: 30 },
                description: 'No special abilities.'
            },
            {
                id: KcmoId,
                name: 'Kansas City, Mexico, & Orient Railroad',
                faceValue: 40,
                revenue: 10,
                sale: { minimum: 20, maximum: 60 },
                description: `The owning major may lay the Copper Canyon tile in ${place(CopperCanyonLocationId)} for $60, in its tile step besides its own lays and without a connection, which closes the KCM&O. Another tile laid there first ends the ability.`
            },
            {
                id: MirId,
                name: 'Mexican International Railroad',
                faceValue: 100,
                revenue: 20,
                sale: { minimum: 50, maximum: 150 },
                description:
                    'Comes with a 10% share of the Chihuahua Pacific Railway, worth nothing until the CHI’s president’s certificate is bought.'
            },
            {
                id: MnrId,
                name: 'Mexican National Railroad',
                faceValue: 140,
                revenue: 20,
                sale: 'never',
                description:
                    'Comes with the NdM president’s certificate; its buyer sets the NdM’s par. Closes when the NdM buys a train. Cannot be sold to a major.'
            }
        ]
    },
    PhasesMex
)

/** The auction's items in the order of their numbers, the minors among the privates (3.1). */
export const AuctionOrderMex: readonly string[] = [
    McarId,
    KcmoId,
    MinorAId,
    MinorBId,
    MinorCId,
    MirId,
    MnrId
]

/** The minors' run before the auction ends: home city to the stop its printed track reaches. */
export const MinorAuctionRun = 30

/** Shares per major: the NdM's in 5% units, so its 5% certificates are whole (1.3.2). */
export const ChartersMex = companyCharters(() => ({
    shareCounts: {
        ...Object.fromEntries(MajorIdsMex.map((id) => [id, id === NdmId ? 20 : 10])),
        ...Object.fromEntries(MinorIdsMex.map((id) => [id, 1]))
    },
    privateRevenues: Object.fromEntries(
        PrivateCatalogMex.privates.map((company) => [company.id, company.revenue])
    )
}))
