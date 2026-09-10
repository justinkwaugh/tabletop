import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import { trainsOwnedBy, unownedTrain } from './train.js'
import type { TrainRules } from './trainPurchase.js'
import {
    continuePhaseChange,
    type PhaseChangeState,
    type PhaseRules
} from '../phases/phaseChange.js'
export function discardableTrains(state: PhaseChangeState, companyId: string, rules: TrainRules) {
    const trains = trainsOwnedBy(state, { kind: 'company', companyId })
    return state.phaseChange?.discardCompanyIds[0] === companyId &&
        trains.length > rules.trainLimit(state, companyId)
        ? trains
        : []
}
export const DiscardTrain = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('DiscardTrain'),
        companyId: Type.String(),
        trainId: Type.String(),
        metadata: Type.Optional(
            Type.Object(
                {
                    destination: Type.Union([Type.Literal('market'), Type.Literal('removed')]),
                    nextState: Type.String()
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type DiscardTrain = Type.Static<typeof DiscardTrain>
const Validator = Compile(DiscardTrain)
export function isDiscardTrain(action: GameAction): action is DiscardTrain {
    return (
        action instanceof HydratedDiscardTrain ||
        (action.type === 'DiscardTrain' && Validator.Check(action))
    )
}
export class HydratedDiscardTrain
    extends HydratableAction<typeof DiscardTrain>
    implements DiscardTrain
{
    declare type: 'DiscardTrain'
    declare playerId: string
    declare companyId: string
    declare trainId: string
    declare metadata?: DiscardTrain['metadata']
    readonly #rules: TrainRules
    readonly #phases: PhaseRules
    constructor(data: DiscardTrain, rules: TrainRules, phases: PhaseRules) {
        super(data instanceof HydratedDiscardTrain ? data.dehydrate() : data, Validator)
        this.#rules = rules
        this.#phases = phases
    }
    apply(state: HydratedGameState & PhaseChangeState): void {
        assert(
            this.source === ActionSource.User &&
                state.activePlayerIds.includes(this.playerId) &&
                controllingOwner(state, this.companyId)?.playerId === this.playerId,
            'Only the deciding company’s controlling owner may discard'
        )
        const train = discardableTrains(state, this.companyId, this.#rules).find(
            (train) => train.id === this.trainId
        )
        assert(train, 'This train is not available for compulsory discard')
        state.trainInventory.trains = state.trainInventory.trains.map((entry) =>
            entry.id !== train.id ? entry : unownedTrain(entry, this.#phases.discardDestination)
        )
        if (
            trainsOwnedBy(state, { kind: 'company', companyId: this.companyId }).length <=
            this.#rules.trainLimit(state, this.companyId)
        )
            state.phaseChange!.discardCompanyIds.shift()
        this.metadata = {
            destination: this.#phases.discardDestination,
            nextState: continuePhaseChange(state)
        }
    }
}
type State = HydratedGameState & PhaseChangeState
export class DiscardingTrainsHandler implements MachineStateHandler<HydratedDiscardTrain, State> {
    constructor(private readonly rules: TrainRules) {}
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        const state = context.gameState
        return (
            isDiscardTrain(action) &&
            action.source === ActionSource.User &&
            this.validActionsForPlayer(action.playerId, context).length > 0 &&
            discardableTrains(state, action.companyId, this.rules).some(
                (train) => train.id === action.trainId
            )
        )
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState,
            companyId = state.phaseChange?.discardCompanyIds[0]
        return companyId &&
            state.activePlayerIds.includes(playerId) &&
            controllingOwner(state, companyId)?.playerId === playerId &&
            discardableTrains(state, companyId, this.rules).length
            ? ['DiscardTrain']
            : []
    }
    enter(): void {}
    onAction(action: HydratedDiscardTrain): string {
        assert(action.metadata, 'Discard requires an outcome')
        return action.metadata.nextState
    }
}
