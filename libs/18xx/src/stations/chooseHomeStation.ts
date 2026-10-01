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
import { nextOperatingCompany, type OperatingSet } from '../operating/operatingSet.js'
import {
    StationPlacement,
    StationPlacementDetails,
    applyStationPlacement,
    type HomeStationChoice,
    type StationPlacementState,
    type StationRules
} from './stationPlacement.js'

type State = HydratedGameState & StationPlacementState & { operatingSet?: OperatingSet }

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

/** The home choice that holds the operating set before its company's turn, if any. */
export function pendingHomeChoice(
    state: StationPlacementState & { operatingSet?: OperatingSet },
    rules: StationRules
): HomeStationChoice | undefined {
    if (!state.operatingSet?.privateIncomePaid) return undefined
    const choice = rules.homeChoice?.(state)
    return choice && choice.companyId === nextOperatingCompany(state) ? choice : undefined
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
            )
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'Only the president may choose an offered home city')
        const choice = pendingHomeChoice(state, this.#rules)
        assertExists(choice, 'A home choice is pending')
        const slot = new StationPlacement(state, this.#rules).openSlots(
            this.companyId,
            this.locationId,
            this.nodeId
        )[0]
        assertExists(slot, 'The chosen home city has an open slot')
        const details = {
            companyId: this.companyId,
            stationId: choice.stationId,
            position: { locationId: this.locationId, nodeId: this.nodeId, slot },
            cost: 0
        }
        applyStationPlacement(state, details)
        // The home fulfils the company's reservation of the whole hex.
        state.stationReservations = state.stationReservations.filter(
            (reservation) =>
                reservation.companyId !== this.companyId ||
                reservation.locationId !== this.locationId
        )
        this.metadata = details
    }
}

/** Holds a machine state for a pending home choice by the operating company's president. */
export class HomeStationChoiceHandler<State extends HydratedGameState & StationPlacementState>
    implements MachineStateHandler<HydratedAction, State>
{
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: StationRules,
        private readonly machineState: string
    ) {}
    private president(state: State): string | undefined {
        const choice = pendingHomeChoice(state, this.rules)
        return choice ? controllingOwner(state, choice.companyId)?.playerId : undefined
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (!this.president(context.gameState))
            return this.handler.isValidAction(action, context)
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
            ? this.machineState
            : this.handler.onAction(action, context)
    }
}
