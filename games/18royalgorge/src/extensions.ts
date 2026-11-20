import { ActionSource, assert } from '@tabletop/common'
import {
    actsFor,
    stepAction,
    titleAction,
    trainsOwnedBy,
    type RouteResult,
    type Train,
    type TrainDefinition
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CoalCreekId, CoalDepotId, TrackEngineerId } from './ids.js'
import { CoalCreekLocationId } from './map.js'
import { operatedBy } from './operator.js'
import { ownsOpenPrivate, privateCompanyHolder } from './privateHoldings.js'
import { requireStateRoyalGorge, type HydratedStateRoyalGorge } from './state.js'

/** Coal Creek's railroad spends at most two cubes a turn (Y3). */
const CoalCreekPerTurn = 2

/** A way to lengthen a train: the private or coal it comes from, and the stops it adds. */
export type ExtensionChoice = { sourceId: string; stops: number }

/** The extensions the company may still make to a train this turn, by source and stops. */
export function extensionChoices(
    state: object,
    companyId: string,
    trainId: string
): ExtensionChoice[] {
    const title = requireStateRoyalGorge(state)
    if (
        title.routeStep?.companyId !== companyId ||
        title.routeStep.result ||
        !trainsOwnedBy(title, { kind: 'company', companyId }).some((train) => train.id === trainId)
    )
        return []
    const used = (sourceId: string) =>
        title.trainExtensions.filter((extension) => extension.sourceId === sourceId)
    const onTrain = (sourceId: string) =>
        title.trainExtensions.some(
            (extension) => extension.sourceId === sourceId && extension.trainId === trainId
        )
    const choices: ExtensionChoice[] = []
    // The Track Engineer lengthens one train a turn, not the Coal Depot's (B5).
    if (
        ownsOpenPrivate(title, companyId, TrackEngineerId) &&
        !used(TrackEngineerId).length &&
        !onTrain(CoalDepotId)
    )
        choices.push({ sourceId: TrackEngineerId, stops: 1 })
    // Coal Creek's cubes, up to two a turn, on one train or two (Y3).
    const creekLeft = Math.min(
        title.coalCreekCubes,
        CoalCreekPerTurn - used(CoalCreekId).reduce((sum, extension) => sum + extension.stops, 0)
    )
    if (ownsOpenPrivate(title, companyId, CoalCreekId))
        for (let stops = 1; stops <= creekLeft; stops++)
            choices.push({ sourceId: CoalCreekId, stops })
    // The Coal Depot's one or two cubes, on one train, not the Track Engineer's (G6).
    if (
        ownsOpenPrivate(title, companyId, CoalDepotId) &&
        !used(CoalDepotId).length &&
        !onTrain(TrackEngineerId)
    )
        for (let stops = 1; stops <= Math.min(2, title.coalDepotCubes); stops++)
            choices.push({ sourceId: CoalDepotId, stops })
    return choices
}

/** The train as it runs this turn, a stop longer for each extension (B5, Y3, G6). */
export function extendedDefinition(
    state: object,
    train: Train,
    definition: TrainDefinition
): TrainDefinition {
    const stops = requireStateRoyalGorge(state)
        .trainExtensions.filter((extension) => extension.trainId === train.id)
        .reduce((sum, extension) => sum + extension.stops, 0)
    const { maximum } = definition.distance
    return stops && maximum !== 'unlimited'
        ? { ...definition, distance: { ...definition.distance, maximum: maximum + stops } }
        : definition
}

const ExtendTrainAction = titleAction('ExtendTrain', {
    companyId: Type.String({ minLength: 1 }),
    trainId: Type.String({ minLength: 1 }),
    sourceId: Type.String({ minLength: 1 }),
    stops: Type.Integer({ minimum: 1, maximum: 2 })
})
export const ExtendTrain = ExtendTrainAction.schema
export type ExtendTrain = Type.Static<typeof ExtendTrain>
export const isExtendTrain = ExtendTrainAction.is

/** Before running, the company lengthens a train with the Track Engineer or its coal. */
export class HydratedExtendTrain extends ExtendTrainAction.Base {
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare sourceId: string
    declare stops: number
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            extensionChoices(state, this.companyId, this.trainId).some(
                (choice) => choice.sourceId === this.sourceId && choice.stops === this.stops
            )
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'This train cannot be lengthened so')
        if (this.sourceId === CoalCreekId) state.coalCreekCubes -= this.stops
        if (this.sourceId === CoalDepotId) state.coalDepotCubes -= this.stops
        state.trainExtensions = [
            ...state.trainExtensions,
            { trainId: this.trainId, sourceId: this.sourceId, stops: this.stops }
        ]
    }
}

export const ExtendTrainStep = stepAction<HydratedStateRoyalGorge, HydratedExtendTrain>(
    ExtendTrainAction.type,
    (action): action is HydratedExtendTrain => action instanceof HydratedExtendTrain,
    (state, playerId) => {
        const companyId = operatedBy(state, playerId)
        return (
            !!companyId &&
            trainsOwnedBy(state, { kind: 'company', companyId }).some(
                (train) => extensionChoices(state, companyId, train.id).length > 0
            )
        )
    }
)

export const ExtensionActions = [
    ExtendTrainAction.define((action) => new HydratedExtendTrain(action))
]

/**
 * Coal Creek's railroad takes a cube from the mine for each railroad's run through Coal Creek,
 * while any are left (Y3, OQ-13).
 */
export function mineCoal(state: object, routes: readonly RouteResult[]): void {
    const title = requireStateRoyalGorge(state)
    if (
        !privateCompanyHolder(title, CoalCreekId) ||
        title.coalCreekSupply === 0 ||
        !routes.some((route) => route.paths.some((path) => path.locationId === CoalCreekLocationId))
    )
        return
    title.coalCreekSupply -= 1
    title.coalCreekCubes += 1
}
