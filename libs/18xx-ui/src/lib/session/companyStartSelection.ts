import type { CompanyStartRequest } from '@tabletop/18xx'

export type CompanyStartStages = {
    company: Omit<CompanyStartRequest, 'marketSpaceId'>
    marketSpaceId: string
}
export const CompanyStartStageOrder = ['company', 'marketSpaceId'] as const
