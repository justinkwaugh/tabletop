import type { CompanyStartRequest } from '@tabletop/18xx'

export type CompanyStartStages = {
    company: Omit<CompanyStartRequest, 'marketSpaceId' | 'homeLocationId'>
    marketSpaceId: string
    /** The home hex, for a company whose president chooses one as it starts. */
    homeLocationId: string
}
export const CompanyStartStageOrder = ['company', 'marketSpaceId', 'homeLocationId'] as const
