import type { CompanyStartRequest, HomePosition } from '@tabletop/18xx'

export type CompanyStartStages = {
    company: Omit<CompanyStartRequest, 'marketSpaceId' | 'home'>
    /** Chosen on the map for a company whose president places its home as it starts. */
    home: HomePosition
    marketSpaceId: string
}
export const CompanyStartStageOrder = ['company', 'home', 'marketSpaceId'] as const
