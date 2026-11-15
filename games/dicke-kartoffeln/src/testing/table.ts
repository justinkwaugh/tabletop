import {
    ActionSource,
    GameEngine,
    assertExists,
    type Game,
    type GameAction,
    type GameConfig
} from '@tabletop/common'
import { DickeKartoffelnRuntime } from '../definition/runtime.js'
import {
    HydratedDickeKartoffelnGameState,
    type DickeKartoffelnProjectedState
} from '../model/gameState.js'
import type { Plan } from '../model/plans.js'
import type { SubmitPlan } from '../actions/submitPlan.js'
import { ActionType } from '../definition/actions.js'
import { botAction, createGame } from './bot.js'

export const engine = new GameEngine(DickeKartoffelnRuntime)
export const masterSeed = '0123456789abcdef0123456789abcdef'

export class Table {
    readonly game: Game
    state: DickeKartoffelnProjectedState
    processed: GameAction[] = []
    private step = 0

    constructor(count: number, config: GameConfig = {}) {
        this.game = { ...createGame(count, config), protectedInformation: true }
        this.state = engine.startGame(this.game, {
            masterSeed,
            startingPositions: {
                playerIds: Array.from({ length: count }, (_, index) => `p${index}`)
            }
        }).initialState
    }

    get hydrated(): HydratedDickeKartoffelnGameState {
        return new HydratedDickeKartoffelnGameState(structuredClone(this.state))
    }

    submit(playerId: string, plan: Plan): GameAction[] {
        const action: SubmitPlan = {
            id: `a${this.step++}`,
            gameId: this.state.gameId,
            source: ActionSource.User,
            type: ActionType.SubmitPlan,
            playerId,
            plan,
            simultaneousGroupId: `${this.hydrated.year()}-${this.state.machineState}`
        }
        return this.execute(action)
    }

    // Every waiting farmer submits the bot's plan, unless a plan is supplied for them.
    playRound(plans: Record<string, Plan> = {}): GameAction[] {
        const round = this.state.machineState
        const processed: GameAction[] = []
        while (this.state.machineState === round && this.state.activePlayerIds.length > 0) {
            const [playerId] = this.state.activePlayerIds
            assertExists(playerId, 'Someone is planning')
            const plan = plans[playerId]
            processed.push(
                ...(plan
                    ? this.submit(playerId, plan)
                    : this.execute(botAction(this.hydrated, playerId, this.step++)))
            )
        }
        return processed
    }

    edit(change: (state: HydratedDickeKartoffelnGameState) => void) {
        const hydrated = this.hydrated
        change(hydrated)
        this.state = hydrated.dehydrate()
    }

    private execute(action: GameAction): GameAction[] {
        const result = engine.executeCanonicalAction({ game: this.game, state: this.state, action })
        this.state = result.updatedState
        this.processed.push(...result.processedActions)
        return result.processedActions
    }
}
