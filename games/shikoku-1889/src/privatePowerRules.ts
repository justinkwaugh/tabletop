import {
    privateOwner,
    EighteenXXTransferTiming,
    nextOperatingCompany,
    controllingOwner,
    type PrivatePowerRules
} from '@tabletop/18xx'
export const Shikoku1889PrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (
            state.companies.find((company) => company.id === privateCompanyId)?.closed ||
            state.usedPrivatePowerIds.includes(privateCompanyId)
        )
            return undefined
        const pending = state.privateTrackLay
        if (pending)
            return pending.privateCompanyId === privateCompanyId &&
                pending.playerId === playerId &&
                privateCompanyId === 'ER'
                ? {
                      companyId: pending.companyId,
                      locationIds: ['C4'],
                      definitionIds: ['12', '13', '14', '15', '205', '206'].map(
                          (id) => `18xx:${id}`
                      ),
                      payer: { kind: 'player', playerId },
                      connected: false
                  }
                : undefined
        const owner = privateOwner(state, privateCompanyId)
        if (privateCompanyId !== 'MF' || owner?.kind !== 'player' || owner.playerId !== playerId)
            return undefined
        const buyer = EighteenXXTransferTiming.operatingCompany(state)
        const betweenCompanies =
            state.machineState === 'OperatingSet' &&
            state.operatingSet?.privateIncomePaid &&
            nextOperatingCompany(state) &&
            controllingOwner(state, nextOperatingCompany(state)!)?.playerId !== playerId
        if (
            !betweenCompanies &&
            (state.machineState === 'StockRound'
                ? state.stockRound.completed
                : !buyer || controllingOwner(state, buyer)?.playerId !== playerId)
        )
            return undefined
        return {
            companyId: 'MF',
            locationIds: ['B11', 'G10', 'I12', 'J9'].filter(
                (id) => !state.tileInventory.placements[id]
            ),
            definitionIds: ['18xx:437'],
            payer: owner,
            connected: false
        }
    },
    earlyTrainCompany: () => undefined
}
