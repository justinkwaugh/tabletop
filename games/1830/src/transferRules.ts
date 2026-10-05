import { assertExists } from '@tabletop/common'
import { EighteenThirtyPrivateCatalog } from './privates.js'
import { EighteenThirtyPhases, EighteenThirtyTrainRules } from './trains.js'
import {
    EighteenXXTransferTiming,
    controllingOwner,
    privateOwner,
    trainsOwnedBy,
    type TransferRules
} from '@tabletop/18xx'
export const EighteenThirtyTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        return EighteenThirtyPhases.isAtLeast(state.phaseId, '3') &&
            !EighteenThirtyPhases.isAtLeast(state.phaseId, '5') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? EighteenThirtyPrivateCatalog.priceRange(asset.privateCompanyId)
            : undefined
    },
    // A company that must buy a train may take another company's train for up to its face
    // value, with its president paying what the treasury cannot.
    purchaseFunding(state, companyId, asset) {
        if (
            asset.kind !== 'train' ||
            trainsOwnedBy(state, { kind: 'company', companyId }).length ||
            !EighteenThirtyTrainRules.requiresTrain(state, companyId)
        )
            return undefined
        const train = state.trainInventory.trains.find((train) => train.id === asset.trainId)
        const president = controllingOwner(state, companyId)
        assertExists(train, 'A funded purchase names a known train')
        assertExists(president, 'A company buying a train has a president')
        return {
            contributors: [president],
            maximumPrice: EighteenThirtyTrainRules.depot.trainDefinition(train.definitionId).price
        }
    },
    afterPurchase: () => {}
}
