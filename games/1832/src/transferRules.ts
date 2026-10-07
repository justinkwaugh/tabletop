import { EighteenXXTransferTiming, privateOwner, type TransferRules } from '@tabletop/18xx'
import { EighteenThirtyTwoPrivateCatalog } from './privates.js'
import { EighteenThirtyTwoPhases } from './trains.js'

const CoalFields = 'P5'

export const EighteenThirtyTwoTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    // Companies buy trains from one another for at least $1 (§10.5). From phase 3 until privates
    // close they buy players' privates for half to double face value; the coal fields alone may be
    // bought in phase 2, for up to face value (§12.1).
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        const { privateCompanyId } = asset
        if (
            privateOwner(state, privateCompanyId)?.kind !== 'player' ||
            EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '5')
        )
            return undefined
        const range = EighteenThirtyTwoPrivateCatalog.priceRange(privateCompanyId)
        if (!range) return undefined
        if (EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '3')) return range
        return privateCompanyId === CoalFields
            ? { ...range, maximum: EighteenThirtyTwoPrivateCatalog.faceValue(privateCompanyId) }
            : undefined
    },
    afterPurchase: () => {}
}
