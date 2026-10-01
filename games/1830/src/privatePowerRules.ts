import {
    EighteenXXTransferTiming,
    controllingOwner,
    privateOwner,
    type PrivatePowerRules
} from '@tabletop/18xx'

// The company owning C&StL may lay one of these tiles on B20 in addition to its ordinary lay; the
// company owning D&H may lay 57 on F16 as its ordinary lay, then place a station there.
const PrivateLays: Readonly<
    Record<string, { locationId: string; definitionIds: readonly string[]; ordinaryLay?: true }>
> = {
    CS: { locationId: 'B20', definitionIds: ['18xx:3', '18xx:4', '18xx:58'] },
    DH: { locationId: 'F16', definitionIds: ['18xx:57'], ordinaryLay: true }
}

export const EighteenThirtyPrivatePowerRules: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        const lay = PrivateLays[privateCompanyId]
        if (!lay || state.usedPrivatePowerIds.includes(privateCompanyId)) return undefined
        const owner = privateOwner(state, privateCompanyId)
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        if (
            owner?.kind !== 'company' ||
            owner.companyId !== companyId ||
            controllingOwner(state, companyId)?.playerId !== playerId ||
            state.tileInventory.placements[lay.locationId]
        )
            return undefined
        if (
            lay.ordinaryLay &&
            (state.machineState !== 'LayingTrack' ||
                state.trackStep?.companyId !== companyId ||
                state.trackStep.lays.length > 0)
        )
            return undefined
        return {
            companyId,
            locationIds: [lay.locationId],
            definitionIds: lay.definitionIds,
            payer: owner,
            connected: false,
            ...(lay.ordinaryLay ? { ordinaryLay: true } : {})
        }
    },
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: [],
    stationPrivateIds: ['DH']
}
