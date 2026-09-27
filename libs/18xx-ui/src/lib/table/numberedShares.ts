import { assertExists } from '@tabletop/common'
import { certificatesOwnedBy, type FinancialState, type Owner } from '@tabletop/18xx'

export function numberedSharesOwned(
    state: Pick<FinancialState, 'certificates'>,
    owner: Owner,
    companyId: string
): number[] {
    return certificatesOwnedBy(state, owner)
        .filter((certificate) => certificate.kind === 'share')
        .filter((certificate) => certificate.companyId === companyId)
        .map((certificate) => {
            assertExists(certificate.number, 'Numbered shares require a number')
            return certificate.number
        })
        .sort((a, b) => a - b)
}
