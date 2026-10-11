import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side, UnitType, opposingSide, type Face } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { MoveOrder } from '../model/attack.js'
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

function battleIn(turn: Side, placements: readonly PiecePlacement[], config: GameConfig): TestGame {
    const game = new TestGame(config)
    game.deployBoth()
    if (turn === Side.French) {
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
    }
    arrangeBattlefield(game, placements)
    return game
}

export function alliedTurn(
    placements: readonly PiecePlacement[],
    config: GameConfig = {}
): TestGame {
    return battleIn(Side.Allied, placements, config)
}

export function frenchTurn(
    placements: readonly PiecePlacement[],
    config: GameConfig = {}
): TestGame {
    return battleIn(Side.French, placements, config)
}

export function passTurns(game: TestGame, turns: number) {
    for (let turn = 0; turn < turns; turn++) {
        game.act(ActionType.EndTurn, game.activePlayerId)
    }
}

export function playOut(game: TestGame) {
    while (game.state.machineState !== MachineState.EndOfGame) {
        passTurns(game, 1)
    }
}

export interface Assault {
    attacker: Side
    from: number
    into: number
    guardUnitId?: string
    defenders: string[]
    defenseLeaders: string[]
    orders: MoveOrder[]
    wide?: boolean
    leaders: string[]
    target?: string
}

/** Rule 11, steps 1 to 6: a threat the defender stands against and the attacker presses home. */
export function assault(game: TestGame, plan: Assault): unknown {
    const attacker = game.playerOf(plan.attacker)
    const approach = AUSTERLITZ.approachBetween(plan.from, plan.into).id
    game.act(
        ActionType.ThreatenAttack,
        attacker,
        plan.guardUnitId === undefined ? { approach } : { approach, guardUnitId: plan.guardUnitId }
    )
    game.act(ActionType.DeclareDefense, game.playerOf(opposingSide(plan.attacker)), {
        unitIds: plan.defenders,
        leaderIds: plan.defenseLeaders
    })
    if (game.state.machineState === MachineState.FeintDecision) {
        game.act(ActionType.PressAttack, attacker)
    }
    const declaration = { orders: plan.orders, wide: plan.wide ?? false, leaderIds: plan.leaders }
    return game.outcome(
        ActionType.DeclareAttack,
        attacker,
        plan.target === undefined ? declaration : { ...declaration, targetLeaderId: plan.target }
    )
}

export const infantry = (strength: number): Face => ({ type: UnitType.Infantry, strength })
export const cavalry = (strength: number): Face => ({ type: UnitType.Cavalry, strength })
export const artillery = (): Face => ({ type: UnitType.Artillery, strength: 1 })
export const guard = (): Face => ({ type: UnitType.Infantry, strength: 3, guard: true })
