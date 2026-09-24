import {
    privateOwner,
    EighteenXXTransferTiming,
    controllingOwner,
    type PrivatePowerRules
} from '@tabletop/18xx'
export const TheOldPrincePrivatePowerRules: PrivatePowerRules = {
    trackTerms: () => undefined,
    earlyTrainCompany(state, privateCompanyId, playerId) {
        if (
            privateCompanyId !== 'HS' ||
            !state.companies.some((company) => company.id === 'HS' && !company.closed)
        )
            return undefined
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        const owner = privateOwner(state, privateCompanyId)
        return privateCompanyId === 'HS' &&
            !state.companies.find((company) => company.id === 'HS')?.closed &&
            companyId &&
            companyId !== 'PEIR' &&
            owner?.kind === 'company' &&
            owner.companyId === companyId &&
            controllingOwner(state, companyId)?.playerId === playerId
            ? companyId
            : undefined
    }
}
