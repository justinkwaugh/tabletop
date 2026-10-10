import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { Side, UnitType, type Face } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedNapoleonsTriumphGameState,
    NapoleonsTriumphGameStateValidator,
    type NapoleonsTriumphGameState,
    type NapoleonsTriumphProjectedState
} from '../model/gameState.js'
import { suggestedDeployment, type Deployment } from '../model/setup.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export class TestGame {
    readonly engine = new GameEngine(NapoleonsTriumphRuntime)
    game: Game
    state: NapoleonsTriumphProjectedState
    private actionNumber = 0

    constructor(config: GameConfig = {}, masterSeed = MASTER_SEED) {
        const game = NapoleonsTriumphRuntime.initializer.initializeGame(
            {
                id: 'napoleons-triumph-test',
                typeId: Definition.info.id,
                ownerId: 'owner',
                config,
                players: ['p0', 'p1'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        )
        const { startedGame, initialState } = this.engine.startGame(game, { masterSeed })
        this.game = startedGame
        this.state = initialState
    }

    get hydrated(): HydratedNapoleonsTriumphGameState {
        return new HydratedNapoleonsTriumphGameState(structuredClone(this.state))
    }

    get canonical(): NapoleonsTriumphGameState {
        if (!NapoleonsTriumphGameStateValidator.Check(this.state)) {
            throw new Error('Expected complete canonical state')
        }
        return this.state
    }

    playerOf(side: Side): string {
        return this.hydrated.playerOf(side).playerId
    }

    get activePlayerId(): string {
        const [playerId] = this.state.activePlayerIds
        assertExists(playerId, 'Expected an acting player')
        return playerId
    }

    act(type: ActionType, playerId: string, payload: Record<string, unknown> = {}) {
        const result = this.engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action: {
                id: `action-${this.actionNumber++}`,
                gameId: this.game.id,
                source: ActionSource.User,
                playerId,
                type,
                ...payload
            }
        })
        this.state = result.updatedState
        return result.processedActions
    }

    outcome(type: ActionType, playerId: string, payload: Record<string, unknown> = {}): unknown {
        const [action] = this.act(type, playerId, payload)
        return Reflect.get(action, 'metadata')
    }

    arrange(edit: (state: HydratedNapoleonsTriumphGameState) => void) {
        const hydrated = this.hydrated
        edit(hydrated)
        this.state = hydrated.dehydrate()
    }

    deploy(side: Side, adjust?: (deployment: Deployment) => void) {
        const deployment = suggestedDeployment(this.hydrated, side)
        adjust?.(deployment)
        return this.act(ActionType.DeployArmy, this.playerOf(side), { deployment })
    }

    deployBoth() {
        this.deploy(Side.Allied)
        this.deploy(Side.French)
        if (this.state.machineState !== MachineState.Commanding) {
            throw new Error(`Expected play to begin, but the game is in ${this.state.machineState}`)
        }
    }
}

export interface PiecePlacement {
    id: string
    side: Side
    face: Face
    locale: number
    facing?: number
    commanderId?: string
}

export function arrangeBattlefield(game: TestGame, placements: readonly PiecePlacement[]) {
    game.arrange((state) => {
        const positionOf = (placement: PiecePlacement) => ({
            locale: placement.locale,
            approach:
                placement.facing === undefined
                    ? undefined
                    : state.map.approachBetween(placement.locale, placement.facing).id
        })
        state.units = placements.map((placement) => ({
            id: placement.id,
            playerId: state.playerOf(placement.side).playerId,
            face: { ...placement.face },
            commanderId: placement.commanderId,
            position: positionOf(placement)
        }))
        for (const commander of state.commanders) {
            const lead = placements.find((placement) => placement.commanderId === commander.id)
            commander.position = lead ? positionOf(lead) : undefined
            commander.eliminated = lead ? undefined : true
        }
    })
}

export const infantry = (strength: number): Face => ({ type: UnitType.Infantry, strength })
export const cavalry = (strength: number): Face => ({ type: UnitType.Cavalry, strength })
export const artillery = (): Face => ({ type: UnitType.Artillery, strength: 1 })
export const guard = (): Face => ({ type: UnitType.Infantry, strength: 3, guard: true })
