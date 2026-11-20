import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import {
    EighteenNinetyFourPhases,
    EighteenNinetyFourTrainDepot,
    TrainColorOrder
} from './trains.js'
import {
    requiresStationRoute,
    type AccessRightState,
    type MapStateData,
    type TrainRules
} from '@tabletop/18xx'
import { londonAccess } from './london.js'

const depot = EighteenNinetyFourTrainDepot

/**
 * What upgrading a train to another costs: the new train's price less half the old one's, to the
 * next colour or to a diesel (§7.3.7.2); undefined when the upgrade is not allowed.
 */
function upgradeCost(fromId: string, toId: string): number | undefined {
    const from = TrainColorOrder.indexOf(fromId)
    const to = TrainColorOrder.indexOf(toId)
    if (from < 0 || (to !== from + 1 && !(toId === 'D' && to > from))) return undefined
    return depot.trainDefinition(toId).price - depot.trainDefinition(fromId).price / 2
}

/** A train's upgrade price, once a round (§7.3.7.2). */
export const upgradePrice: TrainRules['exchangePrice'] = (
    state,
    _companyId,
    definitionId,
    train
) => {
    if (state.trainPurchaseStep?.exchangedTrainIds?.length) return undefined
    return upgradeCost(train.definitionId, definitionId)
}

/**
 * The upgrades a train can ever make, as the train table lists them (§13.2): those to a train
 * that reaches the supply before this one rusts.
 */
export function trainUpgrades(definitionId: string): { definitionId: string; price: number }[] {
    const rustsOn = depot.trainDefinition(definitionId).rustsOn
    const lastTarget = rustsOn ? TrainColorOrder.indexOf(rustsOn) : TrainColorOrder.length
    return TrainColorOrder.slice(0, lastTarget + 1).flatMap((toId) => {
        const price = upgradeCost(definitionId, toId)
        return price === undefined ? [] : [{ definitionId: toId, price }]
    })
}

export const EighteenNinetyFourTrainRules: TrainRules = {
    depot,
    // London counts as a route's stop only for a company with a ferry marker (§14).
    requiresTrain: requiresStationRoute<MapStateData & AccessRightState>(
        EighteenNinetyFourMap,
        EighteenNinetyFourTileSet,
        londonAccess
    ),
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
