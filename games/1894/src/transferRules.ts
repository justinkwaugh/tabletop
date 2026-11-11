import { EighteenNinetyFourCharters } from './charters.js'
import { assertExists } from '@tabletop/common'
import { EighteenNinetyFourPrivateCatalog } from './privates.js'
import { EighteenNinetyFourPhases } from './trains.js'
import { EighteenNinetyFourTrainRules } from './trainRules.js'
import {
    EighteenXXTransferTiming,
    controllingOwner,
    privateOwner,
    trainsOwnedBy,
    type TransferRules
} from '@tabletop/18xx'

/** Companies buy privates from players in phases 3, 4 and 5+1 (§11.2.1). */
export function privateSalesOpen(phaseId: string): boolean {
    return (
        EighteenNinetyFourPhases.isAtLeast(phaseId, '3') &&
        !EighteenNinetyFourPhases.isAtLeast(phaseId, '6')
    )
}

export const EighteenNinetyFourTransferRules: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: EighteenNinetyFourCharters,
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        return privateSalesOpen(state.phaseId) &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? EighteenNinetyFourPrivateCatalog.priceRange(asset.privateCompanyId)
            : undefined
    },
    // A company that must buy a train may take another company's for up to its face value,
    // its president paying what the treasury cannot (§7.3.7.3).
    purchaseFunding(state, companyId, asset) {
        if (
            asset.kind !== 'train' ||
            trainsOwnedBy(state, { kind: 'company', companyId }).length ||
            !EighteenNinetyFourTrainRules.requiresTrain(state, companyId)
        )
            return undefined
        const train = state.trainInventory.trains.find((train) => train.id === asset.trainId)
        const president = controllingOwner(state, companyId)
        assertExists(train, 'A funded purchase names a known train')
        assertExists(president, 'A company buying a train has a president')
        return {
            contributors: [president],
            maximumPrice: EighteenNinetyFourTrainRules.depot.trainDefinition(train.definitionId)
                .price
        }
    },
    afterPurchase: () => {}
}
