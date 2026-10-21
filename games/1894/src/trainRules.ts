import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import {
    EighteenNinetyFourPhases,
    EighteenNinetyFourTrainDepot,
    TrainColorOrder
} from './trains.js'
import { requiresStationRoute, type TrainRules } from '@tabletop/18xx'

const depot = EighteenNinetyFourTrainDepot

/**
 * A train's upgrade price: the next colour's price less half its own, once a round, to the next
 * colour or to a diesel (§7.3.7.2).
 */
export const upgradePrice: TrainRules['exchangePrice'] = (
    state,
    _companyId,
    definitionId,
    train
) => {
    if (state.trainPurchaseStep?.exchangedTrainIds?.length) return undefined
    const from = TrainColorOrder.indexOf(train.definitionId)
    const to = TrainColorOrder.indexOf(definitionId)
    if (from < 0 || (to !== from + 1 && !(definitionId === 'D' && to > from))) return undefined
    return (
        depot.trainDefinition(definitionId).price -
        depot.trainDefinition(train.definitionId).price / 2
    )
}

export const EighteenNinetyFourTrainRules: TrainRules = {
    depot,
    requiresTrain: requiresStationRoute(EighteenNinetyFourMap, EighteenNinetyFourTileSet),
    // Trains come from the supply in colour order (§7.3.7.1).
    availableDefinitions(state) {
        const next = depot.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    exchangePrice: upgradePrice,
    exchangedTrainDestination: 'removed',
    phaseAfterPurchase: (state, definitionId) =>
        EighteenNinetyFourPhases.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => EighteenNinetyFourPhases.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited'
}
