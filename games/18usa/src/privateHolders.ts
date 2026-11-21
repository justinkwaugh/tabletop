import { privateOwningCompany, type FinancialState } from '@tabletop/18xx'

export const LehighCoalId = 'P1'
export const FoxBridgeId = 'P2'
export const ReeceOilId = 'P3'
export const HendricksonIronId = 'P4'
export const NobelsBlastingId = 'P5'
export const ImportExportHubId = 'P6'
export const TrackEngineersId = 'P7'
export const ExpressFreightId = 'P8'
export const BoomtownId = 'P9'
export const CarnegieSteelId = 'P10'
export const PettiboneMullikenId = 'P11'
export const StandardOilId = 'P12'
export const PennsyBoneyardId = 'P13'
export const PyramidSchemeId = 'P14'
export const WesternLandGrantId = 'P15'
export const RegionalHeadquartersId = 'P16'
export const GreatNorthernId = 'P17'
export const PeabodyCoalId = 'P18'
export const UnionSwitchId = 'P19'
export const SuemWynnId = 'P20'
export const KeystoneBridgeId = 'P21'
export const AmericanBridgeId = 'P22'
export const BaileyYardId = 'P23'
export const AnacondaCopperId = 'P24'
export const AmericanLocomotiveId = 'P25'
export const RuralJunctionId = 'P26'
export const CompanyTownId = 'P27'
export const ConsolidationCoalId = 'P28'
export const BankruptRailroadId = 'P29'
export const DoubleHeadingId = 'P30'

/** Whether the game has the private and it is still open. */
export function privateOpen(state: FinancialState, privateId: string): boolean {
    return state.companies.some((company) => company.id === privateId && !company.closed)
}

/** The company holding a private, when the game has the private at all. */
export function companyHolding(state: FinancialState, privateId: string): string | undefined {
    return state.companies.some((company) => company.id === privateId && !company.closed)
        ? privateOwningCompany(state, privateId)
        : undefined
}
