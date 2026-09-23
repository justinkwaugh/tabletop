import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    BaseGameInitializer,
    Color,
    GameEngine,
    GameState,
    HydratableAction,
    HydratableGameState,
    PlayerAction,
    PlayerState,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameRuntime,
    type MachineContext,
    type UninitializedGameState
} from '../../../index.js'

const NoteGameSchema = Type.Object({
    ...GameState.properties,
    machineState: Type.Literal('playing'),
    steps: Type.Array(Type.String()),
    notes: Type.Record(Type.String(), Type.String())
})
export type NoteGameState = Type.Static<typeof NoteGameSchema>
const Validator = Compile(NoteGameSchema)

export class HydratedNoteGameState
    extends HydratableGameState<typeof NoteGameSchema, PlayerState>
    implements NoteGameState
{
    declare machineState: 'playing'
    declare steps: string[]
    declare notes: Record<string, string>
    constructor(data: NoteGameState) {
        super(data, Validator)
    }
}

export const Step = Type.Object({ ...PlayerAction.properties, type: Type.Literal('step') })
export type Step = Type.Static<typeof Step>
const StepValidator = Compile(Step)
class HydratedStep extends HydratableAction<typeof Step> {
    declare playerId: string
    constructor(data: Step) {
        super(data, StepValidator)
    }
    apply(state: HydratedNoteGameState): void {
        state.steps.push(this.playerId)
    }
}

export const Note = Type.Object({
    ...PlayerAction.properties,
    type: Type.Literal('note'),
    outOfTurn: Type.Literal(true),
    text: Type.String()
})
export type Note = Type.Static<typeof Note>
const NoteValidator = Compile(Note)
class HydratedNote extends HydratableAction<typeof Note> {
    declare playerId: string
    declare text: string
    constructor(data: Note) {
        super(data, NoteValidator)
    }
    apply(state: HydratedNoteGameState): void {
        state.notes[this.playerId] = this.text
    }
}

class Initializer extends BaseGameInitializer<NoteGameState, HydratedNoteGameState> {
    initializeGameState(game: Game, state: UninitializedGameState): HydratedNoteGameState {
        const playerIds = game.players.map((player) => player.id)
        return new HydratedNoteGameState({
            ...state,
            activePlayerIds: [playerIds[0]],
            machineState: 'playing',
            steps: [],
            notes: {},
            players: playerIds.map((playerId, index) => ({
                playerId,
                color: [Color.Red, Color.Blue, Color.Green][index]
            })),
            turnManager: {
                series: [],
                turnOrder: playerIds,
                turnCounts: Object.fromEntries(playerIds.map((id) => [id, 0]))
            }
        })
    }
}

export const noteGameRuntime: GameRuntime<NoteGameState, HydratedNoteGameState> = {
    initializer: new Initializer(),
    hydrator: {
        hydrateState: (state) => new HydratedNoteGameState(state),
        hydrateAction: (action) => {
            if (StepValidator.Check(action)) return new HydratedStep(action)
            if (NoteValidator.Check(action)) return new HydratedNote(action)
            throw Error(`Unknown action ${action.type}`)
        }
    },
    canonicalStateValidator: Validator,
    playerColors: [Color.Red, Color.Blue, Color.Green],
    apiActions: { step: Step, note: Note },
    stateHandlers: {
        playing: {
            enter(context: MachineContext<HydratedNoteGameState>) {
                if (!context.gameState.turnManager.currentTurn())
                    context.gameState.turnManager.startTurn(context.gameState.activePlayerIds[0], 0)
            },
            validActionsForPlayer(
                playerId: string,
                context: MachineContext<HydratedNoteGameState>
            ) {
                return context.gameState.isActivePlayer(playerId) ? ['step', 'note'] : ['note']
            },
            isValidAction(action: GameAction) {
                return StepValidator.Check(action) || NoteValidator.Check(action)
            },
            onAction(action: GameAction, context: MachineContext<HydratedNoteGameState>) {
                const state = context.gameState
                if (StepValidator.Check(action)) {
                    state.turnManager.endTurn(state.actionCount)
                    state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount)]
                }
                return 'playing'
            }
        }
    }
}

export function createNoteGame() {
    const engine = new GameEngine(noteGameRuntime)
    const game = noteGameRuntime.initializer.initializeGame(
        {
            id: 'note-game',
            typeId: 'note-game',
            ownerId: 'p1',
            seed: 5,
            players: ['p1', 'p2', 'p3'].map((id) => ({
                id,
                name: id,
                userId: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        { info: noteGameInfo, runtime: noteGameRuntime }
    )
    const { startedGame, initialState } = engine.startGame(game)
    return { engine, game: startedGame, state: initialState }
}

export const noteGameInfo = {
    id: 'note-game',
    metadata: {
        name: 'Note Game',
        description: 'Out-of-turn Action fixture',
        version: '1.0.0',
        designer: 'Tabletop',
        year: '2026',
        minPlayers: 3,
        maxPlayers: 3,
        defaultPlayerCount: 3,
        beta: true
    }
}

export function step(id: string, gameId: string, playerId: string, index?: number): Step {
    return { id, gameId, type: 'step', source: ActionSource.User, playerId, index }
}

export function note(
    id: string,
    gameId: string,
    playerId: string,
    text: string,
    index?: number
): Note {
    return {
        id,
        gameId,
        type: 'note',
        source: ActionSource.User,
        playerId,
        outOfTurn: true,
        text,
        index
    }
}
