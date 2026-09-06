import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    BaseGameInitializer,
    Color,
    GameEngine,
    GameState,
    PlayerState,
    PlayerStatus,
    PlayerAction,
    Hydratable,
    HydratableAction,
    HydratableGameState,
    DrawBag,
    HydratedDrawBag,
    Visibility,
    assertExists,
    getPrng,
    shuffle,
    type Game,
    type GameAction,
    type GameRuntime,
    type UninitializedGameState,
    type MachineContext,
    type ExplorationPopulation,
    type RandomFunction
} from '../../../index.js'

const CardSchema = Type.Object({
    id: Type.String(),
    suit: Type.Union([Type.Literal('red'), Type.Literal('blue')]),
    rank: Type.Integer({ minimum: 1, maximum: 4 })
})
type Card = Type.Static<typeof CardSchema>
const CardValidator = Compile(CardSchema)
const HandSchema = Type.Object({ cards: Type.Array(CardSchema) })
const HandValidator = Compile(HandSchema)
const PlayerSchema = Type.Object({
    ...PlayerState.properties,
    hand: Visibility.protect(HandSchema, { policy: Visibility.Policy.Owner }),
    handCount: Type.Integer({ minimum: 0 })
})
const SharedPlayerSchema = Visibility.createProjectionSchema(PlayerSchema)
const SharedPlayerValidator = Compile(SharedPlayerSchema)
const BagSchema = DrawBag(CardSchema)
const SharedBagSchema = Visibility.createProjectionSchema(BagSchema)
const BagValidator = Compile(SharedBagSchema)
export const CanonicalSchema = Type.Object({
    ...GameState.properties,
    machineState: Type.Literal('playing'),
    players: Type.Array(PlayerSchema),
    table: Type.Array(CardSchema, { minItems: 1 }),
    drawPile: BagSchema,
    secretBonus: Visibility.protect(Type.Integer({ minimum: 1, maximum: 10 }), {
        policy: Visibility.Policy.HostOnly
    })
})
export type CanonicalState = Type.Static<typeof CanonicalSchema>
export const CanonicalValidator = Compile(CanonicalSchema)
export const SharedSchema = Visibility.createProjectionSchema(CanonicalSchema)
export type SharedState = Type.Static<typeof SharedSchema>
export const SharedValidator = Compile(SharedSchema)

class HydratedCard extends Hydratable<typeof CardSchema> implements Card {
    declare id: string
    declare suit: Card['suit']
    declare rank: number
    constructor(data: Card) {
        super(data, CardValidator)
    }
    matches(top: Card): boolean {
        return this.suit === top.suit || this.rank === top.rank
    }
}
class HydratedHand extends Hydratable<typeof HandSchema> {
    declare cards: HydratedCard[]
    constructor(data: Type.Static<typeof HandSchema>) {
        super(data, HandValidator)
        this.cards = data.cards.map((card) => new HydratedCard(card))
    }
    choices(top: Card): string[] {
        return this.cards.filter((card) => card.matches(top)).map((card) => card.id)
    }
}
class HydratedPlayer extends Hydratable<typeof SharedPlayerSchema> {
    declare playerId: string
    declare color: Color
    declare hand?: HydratedHand
    declare handCount: number
    constructor(data: Type.Static<typeof SharedPlayerSchema>) {
        super(data, SharedPlayerValidator)
        if (data.hand !== undefined) this.hand = new HydratedHand(data.hand)
    }
    knownHand(): HydratedHand {
        assertExists(this.hand, 'This operation requires a known hand')
        return this.hand
    }
}
export class HydratedBag extends HydratedDrawBag<Card, typeof SharedBagSchema> {
    constructor(data: Type.Static<typeof SharedBagSchema>) {
        super(data, BagValidator)
    }
}
export class HydratedPrivateHandState
    extends HydratableGameState<typeof SharedSchema, HydratedPlayer>
    implements SharedState
{
    declare machineState: 'playing'
    declare players: HydratedPlayer[]
    declare table: HydratedCard[]
    declare drawPile: HydratedBag
    declare secretBonus?: number
    constructor(data: SharedState) {
        super(data, SharedValidator)
        this.players = data.players.map((player) => new HydratedPlayer(player))
        this.table = data.table.map((card) => new HydratedCard(card))
        this.drawPile = new HydratedBag(data.drawPile)
    }
    draw(playerId: string): void {
        const player = this.getPlayerState(playerId)
        player.knownHand().cards.push(new HydratedCard(this.drawPile.draw()))
        player.handCount += 1
    }
    choices(playerId: string): string[] {
        const top = this.table.at(-1)
        assertExists(top, 'The table must have a card')
        return this.getPlayerState(playerId).knownHand().choices(top)
    }
    play(playerId: string, cardId: string): void {
        if (!this.choices(playerId).includes(cardId))
            throw Error('That card does not match the table')
        const player = this.getPlayerState(playerId)
        const cards = player.knownHand().cards
        const index = cards.findIndex((card) => card.id === cardId)
        const card = cards.splice(index, 1)[0]
        assertExists(card, 'Card must be in the hand')
        this.table.push(card)
        player.handCount = cards.length
    }
}

export const PlaySchema = Type.Object({
    ...PlayerAction.properties,
    type: Type.Literal('play'),
    cardId: Type.String()
})
const PlayValidator = Compile(PlaySchema)
class Play extends HydratableAction<typeof PlaySchema> {
    declare playerId: string
    declare cardId: string
    constructor(data: Type.Static<typeof PlaySchema>) {
        super(data, PlayValidator)
    }
    apply(state: HydratedPrivateHandState): void {
        state.play(this.playerId, this.cardId)
    }
}
export const DrawSchema = Type.Object({
    ...PlayerAction.properties,
    type: Type.Literal('draw'),
    revealsInfo: Type.Literal(true)
})
const DrawValidator = Compile(DrawSchema)
class Draw extends HydratableAction<typeof DrawSchema> {
    declare playerId: string
    constructor(data: Type.Static<typeof DrawSchema>) {
        super(data, DrawValidator)
    }
    apply(state: HydratedPrivateHandState): void {
        state.draw(this.playerId)
    }
}
const card = (id: string, suit: Card['suit'], rank: number): Card => ({ id, suit, rank })
const pack = [
    card('r1', 'red', 1),
    card('b1', 'blue', 1),
    card('r2', 'red', 2),
    card('b2', 'blue', 2),
    card('r3', 'red', 3),
    card('b3', 'blue', 3),
    card('r4', 'red', 4)
]

class Initializer extends BaseGameInitializer<SharedState, HydratedPrivateHandState> {
    initializeGameState(_game: Game, state: UninitializedGameState): HydratedPrivateHandState {
        return new HydratedPrivateHandState({
            ...state,
            activePlayerIds: ['p1'],
            machineState: 'playing',
            secretBonus: 7,
            players: [
                {
                    playerId: 'p1',
                    color: Color.Red,
                    hand: { cards: pack.slice(0, 2) },
                    handCount: 2
                },
                {
                    playerId: 'p2',
                    color: Color.Blue,
                    hand: { cards: pack.slice(2, 4) },
                    handCount: 2
                }
            ],
            table: pack.slice(6),
            drawPile: { items: pack.slice(4, 6), remaining: 2 },
            turnManager: { series: [], turnOrder: ['p1', 'p2'], turnCounts: { p1: 0, p2: 0 } }
        })
    }
    initializeExplorationState(state: SharedState): SharedState {
        const result = structuredClone(state)
        shuffle(result.drawPile.items, getPrng())
        return result
    }
    populateExplorationState({
        state,
        random
    }: ExplorationPopulation<SharedState>): CanonicalState {
        return populate(state, random)
    }
    getExplorationActions(): GameAction[] {
        return []
    }
}
export const projector = Visibility.createProjector(CanonicalSchema)

const actions = Visibility.createActionProjector({ play: PlaySchema, draw: DrawSchema })
export const runtime: GameRuntime<SharedState, HydratedPrivateHandState> = {
    initializer: new Initializer(),
    canonicalStateValidator: CanonicalValidator,
    hydrator: {
        hydrateState(state) {
            return new HydratedPrivateHandState(state)
        },
        hydrateAction(data) {
            if (PlayValidator.Check(data)) return new Play(data)
            if (DrawValidator.Check(data)) return new Draw(data)
            throw Error('Invalid private-hand Action')
        }
    },
    playerColors: [Color.Red, Color.Blue],
    apiActions: { play: PlaySchema, draw: DrawSchema },
    visibility: { state: projector, actions },
    stateHandlers: {
        playing: {
            enter(context: MachineContext<HydratedPrivateHandState>) {
                if (!context.gameState.turnManager.currentTurn())
                    context.gameState.turnManager.startTurn('p1', 0)
            },
            validActionsForPlayer(
                playerId: string,
                context: MachineContext<HydratedPrivateHandState>
            ) {
                return [
                    ...(context.gameState.choices(playerId).length > 0 ? ['play'] : []),
                    ...(context.gameState.drawPile.count() > 0 ? ['draw'] : [])
                ]
            },
            isValidAction(action: GameAction, context: MachineContext<HydratedPrivateHandState>) {
                return (
                    (PlayValidator.Check(action) &&
                        context.gameState.choices(action.playerId).includes(action.cardId)) ||
                    (DrawValidator.Check(action) && context.gameState.drawPile.count() > 0)
                )
            },
            onAction(_action: GameAction, context: MachineContext<HydratedPrivateHandState>) {
                const state = context.gameState
                state.turnManager.endTurn(state.actionCount)
                state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount)]
                return 'playing'
            }
        }
    }
}

export const info = {
    id: 'private-hand',
    metadata: {
        name: 'Private Hand',
        description: 'Shared hydration conformance fixture',
        version: '1.0.0',
        designer: 'Tabletop',
        year: '2026',
        minPlayers: 2,
        maxPlayers: 2,
        defaultPlayerCount: 2,
        beta: true
    }
}

export const p1 = { kind: 'player', playerId: 'p1' } as const
export const p2 = { kind: 'player', playerId: 'p2' } as const
export const spectator = { kind: 'spectator' } as const

export function requireCanonical(state: unknown): asserts state is CanonicalState {
    if (!CanonicalValidator.Check(state)) throw Error('Complete canonical state is required')
}

export function createPrivateHandGame() {
    const engine = new GameEngine(runtime)
    const game = runtime.initializer.initializeGame(
        {
            id: 'private-hand-game',
            typeId: info.id,
            ownerId: 'p1',
            seed: 11,
            players: ['p1', 'p2'].map((id) => ({
                id,
                name: id,
                userId: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        { info, runtime }
    )
    const { startedGame, initialState } = engine.startGame(game)
    requireCanonical(initialState)
    const firstPlay = {
        id: 'first-play',
        gameId: game.id,
        source: ActionSource.User,
        playerId: 'p1',
        type: 'play',
        cardId: 'r1'
    }
    return { game: startedGame, state: initialState, engine, firstPlay }
}

export function populate(view: SharedState, random: RandomFunction): CanonicalState {
    const known = [
        ...view.table,
        ...view.players.flatMap((player) => player.hand?.cards ?? [])
    ].map((card) => card.id)
    const remaining = pack.filter((card) => !known.includes(card.id))
    shuffle(remaining, random)
    const result = structuredClone(view)
    for (const player of result.players) {
        if (player.hand === undefined)
            player.hand = { cards: remaining.splice(0, player.handCount) }
        if (player.hand.cards.length !== player.handCount) throw Error('Invalid known hand count')
    }
    result.drawPile.items = remaining
    if (remaining.length !== result.drawPile.remaining)
        throw Error('Known information does not match the pack')
    result.secretBonus = 5
    requireCanonical(result)
    return result
}

export const refillRuntime: GameRuntime<SharedState, HydratedPrivateHandState> = {
    ...runtime,
    stateHandlers: {
        playing: {
            ...runtime.stateHandlers.playing,
            onAction(action, context) {
                if (action.type === 'play' && context.gameState.drawPile.count() > 0) {
                    assertExists(action.playerId, 'Played card has no owner')
                    context.gameState.draw(action.playerId)
                    action.revealsInfo = true
                }
                return runtime.stateHandlers.playing.onAction(action, context)
            }
        }
    }
}

export class PrivateHandHost {
    game: Game
    state: CanonicalState
    actions: GameAction[] = []
    readonly engine: GameEngine<SharedState, HydratedPrivateHandState>

    constructor(selectedRuntime = runtime) {
        const initial = createPrivateHandGame()
        this.game = initial.game
        this.state = initial.state
        this.engine = new GameEngine(selectedRuntime)
    }

    apply(action: GameAction) {
        const result = this.engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        requireCanonical(result.updatedState)
        this.state = result.updatedState
        this.actions.push(...result.processedActions)
        this.game.activePlayerIds = [...this.state.activePlayerIds]
        return result
    }

    undo(actionId: string) {
        const index = this.actions.findIndex((action) => action.id === actionId)
        if (index < 0) throw Error('Unknown Action')
        let state: SharedState = this.state
        for (const action of this.actions.slice(index).toReversed()) {
            state = this.engine.undoProcessedAction({ state, action })
        }
        this.engine.validateCanonicalState(state)
        requireCanonical(state)
        this.state = state
        this.actions = this.actions.slice(0, index)
        this.game.activePlayerIds = [...this.state.activePlayerIds]
    }

    history(perspective?: Visibility.Perspective) {
        if (perspective === undefined)
            return {
                currentState: structuredClone(this.state),
                actions: structuredClone(this.actions)
            }
        return Visibility.projectActionHistory({
            currentState: this.state,
            actions: this.actions,
            perspective,
            visibility: { state: projector, actions },
            replay: { game: this.game, runtime: this.engine.runtime }
        })
    }
}
