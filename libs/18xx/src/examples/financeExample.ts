import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import {
    BaseGameInitializer,
    Color,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    TerminalStateHandler,
    assert,
    type Game,
    type GameRuntime,
    type HydratedGameState,
    type PlayerState,
    type UninitializedGameState
} from '@tabletop/common'
import { FinanceFields, validateFinances, type FinancialState } from '../finance/finance.js'

const ExampleFields = Type.Object({
    example: Type.Literal('finances'),
    machineState: Type.Literal('InspectFinances'),
    ...FinanceFields
})
export const FinanceExampleState: Type.TObject<
    Omit<typeof GameState.properties, 'machineState'> & typeof ExampleFields.properties
> = Type.Object(
    {
        ...GameState.properties,
        ...ExampleFields.properties
    },
    { additionalProperties: false }
)
export type FinanceExampleState = Type.Static<typeof FinanceExampleState>
export const FinanceExampleValidator: Validator<{}, typeof FinanceExampleState> =
    Compile(FinanceExampleState)
export class HydratedFinanceExampleState
    extends HydratableGameState<typeof FinanceExampleState, PlayerState>
    implements FinanceExampleState
{
    declare example: 'finances'
    declare machineState: 'InspectFinances'
    declare companies: FinancialState['companies']
    declare bank: FinancialState['bank']
    declare certificatePools: FinancialState['certificatePools']
    declare cash: FinancialState['cash']
    declare certificates: FinancialState['certificates']
    constructor(data: FinanceExampleState) {
        super(data, FinanceExampleValidator)
        assert(
            new Set(this.players.map((player) => player.playerId)).size === this.players.length,
            'Duplicate player identity'
        )
        validateFinances(
            this,
            this.players.map((player) => player.playerId)
        )
    }
}

const ScenarioColors = [Color.Blue, Color.Red, Color.Green]
type CreateFinances = (players: readonly PlayerState[]) => FinancialState
class FinanceExampleInitializer extends BaseGameInitializer<
    FinanceExampleState,
    HydratedFinanceExampleState
> {
    constructor(private readonly createFinances: CreateFinances) {
        super()
    }
    initializeGameState(game: Game, state: UninitializedGameState): HydratedFinanceExampleState {
        assert(game.players.length === 3, 'The finance example requires three players')
        const players = game.players.map((player, index) => ({
            playerId: player.id,
            color: ScenarioColors[index]
        }))
        return new HydratedFinanceExampleState({
            ...state,
            players,
            activePlayerIds: [],
            example: 'finances',
            machineState: 'InspectFinances',
            turnManager: new HydratedTurnManager({
                series: [],
                turnOrder: players.map((player) => player.playerId),
                turnCounts: Object.fromEntries(players.map((player) => [player.playerId, 0]))
            }),
            ...this.createFinances(players)
        })
    }
}
export function createFinanceExampleRuntime(
    createFinances: CreateFinances
): GameRuntime<FinanceExampleState, HydratedFinanceExampleState> {
    return {
        initializer: new FinanceExampleInitializer(createFinances),
        hydrator: {
            hydrateState: (state) => new HydratedFinanceExampleState(state),
            hydrateAction: (action) => {
                throw new Error(`The finance example has no actions: ${action.type}`)
            }
        },
        canonicalStateValidator: FinanceExampleValidator,
        playerColors: ScenarioColors,
        apiActions: {},
        stateHandlers: { InspectFinances: new TerminalStateHandler() }
    }
}

export function requireFinanceExampleState(
    state: HydratedGameState
): HydratedFinanceExampleState {
    assert(state instanceof HydratedFinanceExampleState, 'Expected a hydrated finance example')
    return state
}
