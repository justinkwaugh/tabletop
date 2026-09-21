import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { CompanyStartRequest } from '@tabletop/18xx'

type StartStages = { company: Omit<CompanyStartRequest, 'marketSpaceId'>; marketSpaceId: string }
const Stages = ['company', 'marketSpaceId'] as const satisfies readonly (keyof StartStages)[]
export type CompanyStartSelection = StagedSelectionState<StartStages>
export function chooseStartCompany(company: StartStages['company']): CompanyStartSelection {
    return setStagedSelectionValue<StartStages, 'company'>({}, Stages, 'company', company, 'manual')
}
export function chooseStartPrice(
    selection: CompanyStartSelection,
    marketSpaceId: string
): CompanyStartSelection {
    return setStagedSelectionValue(selection, Stages, 'marketSpaceId', marketSpaceId, 'manual')
}
export function backFromCompanyStart(selection: CompanyStartSelection): CompanyStartSelection {
    return popHighestManualStagedSelection(selection, Stages).nextState
}
export function companyStartRequest(
    selection: CompanyStartSelection
): CompanyStartRequest | undefined {
    return selection.company && selection.marketSpaceId
        ? { ...selection.company.value, marketSpaceId: selection.marketSpaceId.value }
        : undefined
}
