import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { controllingOwner } from '../finance/finance.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import {
    StationPlacement,
    StationPlacementDetails,
    applyStationPlacement,
    releaseHomeReservations,
    type HomeStationChoice,
    type OperatingStationState,
    type StationRules
} from './stationPlacement.js'

type State = HydratedGameState & OperatingStationState

export const ChooseHomeStation = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ChooseHomeStation'),
        companyId: Type.String(),
        locationId: Type.String(),
        nodeId: Type.String(),
        metadata: Type.Optional(StationPlacementDetails)
    },
    { additionalProperties: false }
)
export type ChooseHomeStation = Type.Static<typeof ChooseHomeStation>
const Validator = Compile(ChooseHomeStation)
export function isChooseHomeStation(action: GameAction): action is ChooseHomeStation {
    return (
        action instanceof HydratedChooseHomeStation ||
        (action.type === 'ChooseHomeStation' && Validator.Check(action))
    )
}

export function pendingHomeChoice(
    state: OperatingStationState,
    rules: StationRules
): HomeStationChoice | undefined {
    if (!state.operatingSet?.privateIncomePaid) return undefined
    const choice = rules.homeChoice?.(state)
    assert(
        !choice || choice.companyId === nextOperatingCompany(state),
        'A home choice belongs to the next operating company'
    )
    return choice
}

/** Home placement holds the operating set, whether the home is placed automatically or chosen. */
export function homeStationPending(state: OperatingStationState, rules: StationRules): boolean {
    return rules.pendingHomes(state).length > 0 || pendingHomeChoice(state, rules) !== undefined
}

export class HydratedChooseHomeStation
    extends HydratableAction<typeof ChooseHomeStation>
    implements ChooseHomeStation
{
    declare type: 'ChooseHomeStation'
    declare playerId: string
    declare companyId: string
    declare locationId: string
    declare nodeId: string
    declare metadata?: StationPlacementDetails
    readonly #rules: StationRules
    constructor(data: ChooseHomeStation, rules: StationRules) {
        super(data instanceof HydratedChooseHomeStation ? data.dehydrate() : data, Validator)
        this.#rules = rules
    }
    isValid(state: State): boolean {
        const choice = pendingHomeChoice(state, this.#rules)
        return (
            this.source === ActionSource.User &&
            choice?.companyId === this.companyId &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            choice.positions.some(
                (position) =>
                    position.locationId === this.locationId && position.nodeId === this.nodeId
            ) &&
            this.openSlot(state) !== undefined
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Only the president may choose an offered home city')
        const choice = pendingHomeChoice(state, this.#rules)
        const slot = this.openSlot(state)
        assertExists(choice, 'A home choice is pending')
        assertExists(slot, 'The chosen home city has an open slot')
        const details = {
            companyId: this.companyId,
            stationId: choice.stationId,
            position: { locationId: this.locationId, nodeId: this.nodeId, slot },
            cost: 0
        }
        applyStationPlacement(state, details)
        releaseHomeReservations(state, this.companyId, [
            ...new Set(choice.positions.map((position) => position.locationId))
        ])
        this.metadata = details
    }
    private openSlot(state: State): number | undefined {
        return new StationPlacement(state, this.#rules).openSlots(
            this.companyId,
            this.locationId,
            this.nodeId
        )[0]
    }
}

/** Holds the operating set before a company's turn until its president chooses its home city. */
export class HomeStationChoiceHandler<
    State extends HydratedGameState & OperatingStationState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: StationRules
    ) {}
    private president(state: State): string | undefined {
        const choice = pendingHomeChoice(state, this.rules)
        return choice ? controllingOwner(state, choice.companyId)?.playerId : undefined
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (!this.president(context.gameState)) return this.handler.isValidAction(action, context)
        return action instanceof HydratedChooseHomeStation && action.isValid(context.gameState)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const president = this.president(context.gameState)
        if (!president) return this.handler.validActionsForPlayer(playerId, context)
        return president === playerId ? ['ChooseHomeStation'] : []
    }
    enter(context: MachineContext<State>): void {
        const president = this.president(context.gameState)
        if (president) context.gameState.activePlayerIds = [president]
        else this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedChooseHomeStation
            ? 'OperatingSet'
            : this.handler.onAction(action, context)
    }
}
