import {
    requiresStationRoute,
    trainsOwnedBy,
    type TrainPurchaseState,
    type TrainRules
} from '@tabletop/18xx'
import { CoalAccess } from './coal.js'
import { CobourgRailwayId, directorPrivateId } from './ids.js'
import { Map1828 } from './map.js'
import { constituents, forgetShellTrain, trainShells } from './systems.js'
import { TileSet1828 } from './tiles.js'
import { Phases1828, TrainDepot1828, phaseTrainLimit } from './trains.js'

const stationRoute = requiresStationRoute(Map1828, TileSet1828, (state, companyId, center) =>
    CoalAccess.open(state, companyId, center)
)

function hasEmptyShell(state: TrainPurchaseState, companyId: string): boolean {
    const shells = trainShells(state, companyId)
    return (
        shells.length > 1 &&
        shells.some((shell) => !shell.length) &&
        shells.some((shell) => shell.length > 0)
    )
}

export const TrainRules1828: TrainRules = {
    depot: TrainDepot1828,
    // A company with a route from one of its stations to another revenue centre must own a
    // train; the C&P never buys one (§8.3.5.2, §13.2.2.5).
    requiresTrain: (state, companyId) =>
        companyId !== CobourgRailwayId &&
        !trainsOwnedBy(state, { kind: 'company', companyId }).length &&
        stationRoute(state, companyId),
    // A system with a train in one shell only need not buy another, but its director may enter
    // emergency buying for the empty shell (§8.3.5.1; designer, BGG thread 2368855).
    satisfiesRequirement: (state, train) =>
        train.status !== 'owned' ||
        train.owner.kind !== 'company' ||
        !hasEmptyShell(state, train.owner.companyId),
    mayRequireTrain: (state, companyId) =>
        hasEmptyShell(state, companyId) && stationRoute(state, companyId),
    exchangePrice: () => undefined,
    // Trains are bought colour by colour (§8.3.5.1).
    availableDefinitions(state) {
        const next = TrainDepot1828.nextDefinitionId(state.trainInventory)
        return next ? [next] : []
    },
    phaseAfterPurchase: (state, definitionId) =>
        Phases1828.phaseAfterPurchase(state.phaseId, definitionId),
    // Each shell of a system holds the phase's limit (§15.4).
    trainLimit: (state, companyId) =>
        phaseTrainLimit(state) * constituents(state, companyId).length,
    trainGroups: (state, companyId) =>
        trainShells(state, companyId).map((trains) => ({
            trains,
            limit: phaseTrainLimit(state)
        })),
    purchaseLimit: () => 'unlimited',
    afterTrainsDepart(state, departures) {
        for (const { owner, trainId } of departures)
            if (owner?.kind === 'company') forgetShellTrain(state, owner.companyId, trainId)
        return []
    },
    // A $250 private closes when its company, or a system it is part of, acquires a train
    // (§13.2.3).
    privatesClosedByPurchase: (state, companyId) =>
        constituents(state, companyId)
            .map(directorPrivateId)
            .filter((privateId) =>
                state.companies.some((company) => company.id === privateId && !company.closed)
            )
}
