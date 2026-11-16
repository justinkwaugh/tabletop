import {
    companyCharters,
    createOrdinaryShareCertificates,
    treasuryPoolId,
    type OpenShare
} from '@tabletop/18xx'
import { Privates1849 } from './privates.js'

export type Corporation1849 = {
    id: string
    name: string
    nickname: string
    color: string
    /** The home city, or the cities the president chooses from as it starts (§9.4.1). */
    homeLocationIds: readonly string[]
    /** Paid as it starts, for all three station tokens (§9.4). */
    tokenFee: number
}

export const GaribaldiId = 'AFG'
/** Caltanissetta, Messina, Ragusa, Terranova and Trapani (§7.2). */
export const GaribaldiHomeLocationIds: readonly string[] = ['H8', 'B14', 'M11', 'M9', 'C1']

// The six public corporations (§7.2).
export const Corporations1849: readonly Corporation1849[] = [
    {
        id: GaribaldiId,
        name: 'Azienda Ferroviaria Garibaldi',
        nickname: 'Garibaldi',
        color: 'red',
        homeLocationIds: GaribaldiHomeLocationIds,
        tokenFee: 40
    },
    {
        id: 'ATA',
        name: 'Azienda Trasporti Archimede',
        nickname: 'Archimede',
        color: 'green',
        homeLocationIds: ['M13'],
        tokenFee: 30
    },
    {
        id: 'CTL',
        name: 'Compagnia Trasporti Lilibeo',
        nickname: 'Lilibeo',
        color: 'yellow',
        homeLocationIds: ['E1'],
        tokenFee: 40
    },
    {
        id: 'IFT',
        name: 'Impresa Ferroviaria Trinacria',
        nickname: 'Trinacria',
        color: 'blue',
        homeLocationIds: ['H12'],
        tokenFee: 90
    },
    {
        id: 'RCS',
        name: 'Rete Centrale Sicula',
        nickname: 'Sicula',
        color: 'orange',
        homeLocationIds: ['C5'],
        tokenFee: 130
    },
    {
        id: 'SFA',
        name: 'Società Ferroviaria Akragas',
        nickname: 'Akragas',
        color: 'pink',
        homeLocationIds: ['J6'],
        tokenFee: 40
    }
]

export const CorporationIds1849: readonly string[] = Corporations1849.map(({ id }) => id)
export const TokenFees1849: Readonly<Record<string, number>> = Object.fromEntries(
    Corporations1849.map(({ id, tokenFee }) => [id, tokenFee])
)
export const Homes1849: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
    Corporations1849.map(({ id, homeLocationIds }) => [id, homeLocationIds])
)
export const StationTokenCount1849 = 3
export const ShareCount1849 = 10
const OrdinaryCertificateCount = 6

/** The two-share certificate bought last of any held in the same place (§9.6). */
export function lastCertificateId(companyId: string): string {
    return `${companyId}:last`
}

/**
 * A corporation's eight certificates, all on its charter until bought (§7.2, §9.3): the
 * president's of two shares, six of one and the two-share last certificate.
 */
export function createCertificates1849(companyId: string): OpenShare[] {
    const treasury: Pick<OpenShare, 'owner' | 'poolId'> = {
        owner: { kind: 'company', companyId },
        poolId: treasuryPoolId(companyId)
    }
    return [
        ...createOrdinaryShareCertificates(
            companyId,
            Array.from({ length: OrdinaryCertificateCount }, () => treasury),
            treasury
        ),
        { id: lastCertificateId(companyId), companyId, kind: 'share', shares: 2, ...treasury }
    ]
}

export const Charters1849 = companyCharters(() => ({
    shareCounts: Object.fromEntries(CorporationIds1849.map((id) => [id, ShareCount1849])),
    privateRevenues: Object.fromEntries(
        Privates1849.map((company) => [company.id, company.revenue])
    )
}))
