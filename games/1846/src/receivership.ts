import { assertExists } from '@tabletop/common'
import { controllingOwner, getCompany, type FinancialState, type StockState } from '@tabletop/18xx'

export function inReceivership(state: FinancialState, companyId: string): boolean {
    const company = getCompany(state, companyId)
    return (
        company.kind === 'major' &&
        !company.closed &&
        !company.president &&
        state.certificates.some(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.president &&
                certificate.poolId === 'open-market'
        )
    )
}
export function operatingPlayers1846(state: StockState, companyId: string): string[] {
    if (inReceivership(state, companyId)) return [...state.turnManager.turnOrder]
    const owner = controllingOwner(state, companyId)
    assertExists(owner, 'An operated corporation requires a president or receivership')
    return [owner.playerId]
}
