import { GameEngine, PlayerStatus, assert, type Game, type GameAction } from '@tabletop/common'
import { Definition } from '../definition/definition.js'
import { PowerGridRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPowerGridGameState, PowerGridProjectedState } from '../model/gameState.js'
import { botAction } from './bot.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const NAMES = ['Ada', 'Bram', 'Cleo', 'Dev', 'Eyre', 'Fenna']

export class TestGame {
    readonly engine = new GameEngine(PowerGridRuntime)
    readonly game: Game
    state: PowerGridProjectedState
    readonly actions: GameAction[] = []
    private steps = 0

    constructor(
        playerCount = 4,
        { id = 'power-grid-test', name = 'Test', seed = 97, masterSeed = MASTER_SEED } = {}
    ) {
        this.game = PowerGridRuntime.initializer.initializeGame(
            {
                id,
                name,
                typeId: Definition.info.id,
                ownerId: 'owner',
                seed,
                config: {},
                players: NAMES.slice(0, playerCount).map((name, index) => ({
                    id: `p${index}`,
                    name,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )
        this.state = this.engine.startGame(this.game, { masterSeed }).initialState
    }

    get hydrated(): HydratedPowerGridGameState {
        return PowerGridRuntime.hydrator.hydrateState(this.state)
    }

    execute<T extends GameAction>(action: T) {
        const result = this.engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        this.state = result.updatedState
        this.actions.push(...result.processedActions)
    }

    step() {
        const state = this.hydrated
        const [playerId] = state.activePlayerIds
        assert(playerId !== undefined, `No active player in ${state.machineState}`)
        const action = botAction(state, playerId, this.steps++)
        this.execute(
            state.machineState === MachineState.Powering
                ? { ...action, simultaneousGroupId: `power-${state.round}` }
                : action
        )
    }

    playUntil(done: (state: HydratedPowerGridGameState) => boolean, limit = 20000) {
        for (let count = 0; !done(this.hydrated); count++) {
            assert(count < limit && this.state.result === undefined, 'The position never came up')
            this.step()
        }
    }

    playToEnd() {
        this.playUntil((state) => state.result !== undefined)
    }
}
