import type { CompanyStartRequest, HomePosition } from '@tabletop/18xx'

export type CompanyStartStages = {
    company: Omit<CompanyStartRequest, 'marketSpaceId' | 'home'>
    /** Chosen on the map for a company whose president places its home as it starts. */
    home: HomePosition
    /** Ordinary certificates bought with the president's, where the title allows (1849 §9.4). */
    extraCertificates: number
    marketSpaceId: string
}
export const CompanyStartStageOrder = [
    'company',
    'home',
    'extraCertificates',
    'marketSpaceId'
] as const
