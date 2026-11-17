import type { CompanyStartRequest, HomePosition, StartChoices } from '@tabletop/18xx'

export type CompanyStartStages = {
    company: Omit<CompanyStartRequest, 'marketSpaceId' | 'home'>
    /** Chosen on the map for a company whose president places its home as it starts. */
    home: HomePosition
    /** Ordinary certificates bought with the president's, where the title allows (1849 §9.4). */
    extraCertificates: number
    /** The president's certificate's size, where the title lets the president choose (1880 §XII). */
    presidentShares: number
    marketSpaceId: string
    /** The title's start choices made so far, such as 1880's permits and par slot. */
    choices: StartChoices
}
export const CompanyStartStageOrder = [
    'company',
    'home',
    'extraCertificates',
    'presidentShares',
    'marketSpaceId',
    'choices'
] as const

/** A par set after an award: its price, then any of the title's start choices. */
export type ParStages = { marketSpaceId: string; choices: StartChoices }
export const ParStageOrder = ['marketSpaceId', 'choices'] as const
