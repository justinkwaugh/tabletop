export const BmId = 'BM'
export const BoId = 'BO'
export const CoId = 'CO'
export const CprId = 'CPR'
export const GtId = 'GT'
export const ErieId = 'ERIE'
export const IcId = 'IC'
export const McId = 'MC'
export const MpId = 'MP'
export const NycId = 'NYC'
export const NkpId = 'NKP'
export const NyhId = 'NYH'
export const NwId = 'NW'
export const OshId = 'OSH'
export const PrrId = 'PRR'
export const WabId = 'WAB'

export const SvnId = 'SVN'
export const StctId = 'STCT'
export const CslId = 'CSL'
export const DhId = 'DH'
export const CpId = 'CP'
export const MhId = 'MH'
export const EkId = 'EK'
export const CaId = 'CA'

/** The unsaleable $250 private company that brings a public company's directorship. */
export function directorPrivateId(companyId: string): string {
    return `${companyId}P`
}

/**
 * The Cobourg & Peterborough's railway, a minor its private's owning player runs at the start of
 * each operating round, apart from the private itself (§13.2.2.5).
 */
export const CobourgRailwayId = 'CPRY'
