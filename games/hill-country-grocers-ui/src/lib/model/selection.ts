import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { CompanyId } from '@tabletop/hill-country-grocers'

// Building: the company, then each cube's hex in placement order.
export type BuildSelectionValues = {
    company: CompanyId
    firstHex: string
    secondHex: string
    thirdHex: string
}

export type BuildSelection = StagedSelectionState<BuildSelectionValues>

export const BuildStageOrder = [
    'company',
    'firstHex',
    'secondHex',
    'thirdHex'
] as const satisfies readonly (keyof BuildSelectionValues)[]
type MissingBuildStages = Exclude<keyof BuildSelectionValues, (typeof BuildStageOrder)[number]>
const buildCoverage: MissingBuildStages extends never ? true : never = true
void buildCoverage

const HEX_STAGES = ['firstHex', 'secondHex', 'thirdHex'] as const

export function selectBuildCompany(selection: BuildSelection, companyId: CompanyId) {
    return setStagedSelectionValue<BuildSelectionValues, 'company'>(
        selection,
        BuildStageOrder,
        'company',
        companyId,
        'manual'
    )
}

export function selectedHexes(selection: BuildSelection): string[] {
    return HEX_STAGES.flatMap((stage) => {
        const entry = selection[stage]
        return entry ? [entry.value] : []
    })
}

export function addBuildHex(selection: BuildSelection, hexId: string): BuildSelection {
    const stage = HEX_STAGES[selectedHexes(selection).length]
    return setStagedSelectionValue<BuildSelectionValues, typeof stage>(
        selection,
        BuildStageOrder,
        stage,
        hexId,
        'manual'
    )
}

// Developing: the city, then each grocer Balcones Builders pays when it cannot pay them all.
export type DevelopSelectionValues = {
    city: string
    firstPayee: CompanyId
    secondPayee: CompanyId
    thirdPayee: CompanyId
}

export type DevelopSelection = StagedSelectionState<DevelopSelectionValues>

export const DevelopStageOrder = [
    'city',
    'firstPayee',
    'secondPayee',
    'thirdPayee'
] as const satisfies readonly (keyof DevelopSelectionValues)[]
type MissingDevelopStages = Exclude<
    keyof DevelopSelectionValues,
    (typeof DevelopStageOrder)[number]
>
const developCoverage: MissingDevelopStages extends never ? true : never = true
void developCoverage

const PAYEE_STAGES = ['firstPayee', 'secondPayee', 'thirdPayee'] as const

export function selectDevelopCity(selection: DevelopSelection, cityId: string) {
    return setStagedSelectionValue<DevelopSelectionValues, 'city'>(
        selection,
        DevelopStageOrder,
        'city',
        cityId,
        'manual'
    )
}

export function selectedPayees(selection: DevelopSelection): CompanyId[] {
    return PAYEE_STAGES.flatMap((stage) => {
        const entry = selection[stage]
        return entry ? [entry.value] : []
    })
}

export function addPayee(selection: DevelopSelection, companyId: CompanyId): DevelopSelection {
    const stage = PAYEE_STAGES[selectedPayees(selection).length]
    return setStagedSelectionValue<DevelopSelectionValues, typeof stage>(
        selection,
        DevelopStageOrder,
        stage,
        companyId,
        'manual'
    )
}

// Starting an auction: the company whose share goes up, before the opening bid.
export type AuctionSelectionValues = { company: CompanyId }

export type AuctionSelection = StagedSelectionState<AuctionSelectionValues>

export const AuctionStageOrder = [
    'company'
] as const satisfies readonly (keyof AuctionSelectionValues)[]

export function selectAuctionCompany(selection: AuctionSelection, companyId: CompanyId) {
    return setStagedSelectionValue<AuctionSelectionValues, 'company'>(
        selection,
        AuctionStageOrder,
        'company',
        companyId,
        'manual'
    )
}

export function hasManualSelection(
    build: BuildSelection,
    develop: DevelopSelection,
    auction: AuctionSelection
): boolean {
    return (
        hasManualStagedSelection<BuildSelectionValues>(build, BuildStageOrder) ||
        hasManualStagedSelection<DevelopSelectionValues>(develop, DevelopStageOrder) ||
        hasManualStagedSelection<AuctionSelectionValues>(auction, AuctionStageOrder)
    )
}

export function popBuildSelection(selection: BuildSelection): BuildSelection {
    return popHighestManualStagedSelection<BuildSelectionValues>(selection, BuildStageOrder)
        .nextState
}

export function popDevelopSelection(selection: DevelopSelection): DevelopSelection {
    return popHighestManualStagedSelection<DevelopSelectionValues>(selection, DevelopStageOrder)
        .nextState
}

export function popAuctionSelection(selection: AuctionSelection): AuctionSelection {
    return popHighestManualStagedSelection<AuctionSelectionValues>(selection, AuctionStageOrder)
        .nextState
}
