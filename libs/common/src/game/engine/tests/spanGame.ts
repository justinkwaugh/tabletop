import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    BaseGameInitializer,
    Color,
    GameAction,
    GameEngine,
    GameState,
    HydratableAction,
    HydratableGameState,
    isBranchClose,
    PlayerAction,
    PlayerState,
    PlayerStatus,
    type Game,
    type GameRuntime,
    type MachineContext,
    type UninitializedGameState,
    Visibility
} from '../../../index.js'

export const SPAN_GAME_MASTER_SEED = '000102030405060708090a0b0c0d0e0f'

const SpanPlayerState = Type.Object({
    ...PlayerState.properties,
    work: Type.Number(),
    rolls: Type.Array(Type.Number()),
    queued: Type.Number(),
    idle: Type.Boolean()
})
type SpanPlayerState = Type.Static<typeof SpanPlayerState>

const SpanItem = Type.Object({ playerId: Type.String(), label: Type.String() })
const SpanFlag = Type.Object({ label: Type.String(), playerId: Type.Optional(Type.String()) })

const SpanGameSchema = Type.Object({
    ...GameState.properties,
    machineState: Type.Union([
        Type.Literal('setup'),
        Type.Literal('branching'),
        Type.Literal('working'),
        Type.Literal('scoring')
    ]),
    players: Type.Array(SpanPlayerState),
    pot: Type.Number(),
    spansCompleted: Type.Number(),
    items: Type.Record(Type.String(), SpanItem),
    line: Type.Array(SpanItem),
    flag: SpanFlag,
    log: Type.Array(Type.String())
})
export type SpanGameState = Type.Static<typeof SpanGameSchema>
const Validator = Compile(SpanGameSchema)

export class HydratedSpanGameState
    extends HydratableGameState<typeof SpanGameSchema, SpanPlayerState>
    implements SpanGameState
{
    declare machineState: SpanGameState['machineState']
    declare pot: number
    declare spansCompleted: number
    declare items: Record<string, Type.Static<typeof SpanItem>>
    declare line: Type.Static<typeof SpanItem>[]
    declare flag: Type.Static<typeof SpanFlag>
    declare log: string[]
    constructor(data: SpanGameState) {
        super(data, Validator)
    }
}

function userAction<const Name extends string, Properties extends Type.TProperties>(
    name: Name,
    properties: Properties
) {
    return Type.Object({ ...PlayerAction.properties, type: Type.Literal(name), ...properties })
}

function systemAction<const Name extends string, Properties extends Type.TProperties>(
    name: Name,
    properties: Properties
) {
    return Type.Object({ ...GameAction.properties, type: Type.Literal(name), ...properties })
}

const Begin = userAction('begin', {})
const Work = userAction('work', {})
const Roll = userAction('roll', {})
const Stash = userAction('stash', { label: Type.String() })
const Drop = userAction('drop', { itemId: Type.String() })
const Grab = userAction('grab', {})
const LogIt = userAction('logIt', {})
const Queue = userAction('queue', { amount: Type.Number() })
const Peek = userAction('peek', { otherPlayerId: Type.String() })
const Poke = userAction('poke', { otherPlayerId: Type.String() })
const CutIn = userAction('cutIn', {})
const Claim = userAction('claim', {})
const Finish = userAction('finish', {})
const Shout = userAction('shout', { outOfTurn: Type.Literal(true) })
const OpenBranch = systemAction('openBranch', { playerId: Type.String() })
const IdleSkip = systemAction('idleSkip', { playerId: Type.String() })
const Noise = systemAction('noise', {})
const NextSpan = systemAction('nextSpan', {})
const Complete = systemAction('complete', {})

const BeginValidator = Compile(Begin)
const WorkValidator = Compile(Work)
const RollValidator = Compile(Roll)
const StashValidator = Compile(Stash)
const DropValidator = Compile(Drop)
const GrabValidator = Compile(Grab)
const LogItValidator = Compile(LogIt)
const QueueValidator = Compile(Queue)
const PeekValidator = Compile(Peek)
const PokeValidator = Compile(Poke)
const CutInValidator = Compile(CutIn)
const ClaimValidator = Compile(Claim)
const NoiseValidator = Compile(Noise)
const NextSpanValidator = Compile(NextSpan)
const FinishValidator = Compile(Finish)
const ShoutValidator = Compile(Shout)
const OpenBranchValidator = Compile(OpenBranch)
const IdleSkipValidator = Compile(IdleSkip)
const CompleteValidator = Compile(Complete)

class HydratedBegin extends HydratableAction<typeof Begin> {
    constructor(data: Type.Static<typeof Begin>) {
        super(data, BeginValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.log.push('span')
    }
}

class HydratedWork extends HydratableAction<typeof Work> {
    declare playerId: string
    constructor(data: Type.Static<typeof Work>) {
        super(data, WorkValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.getPlayerState(this.playerId).work += 1
    }
}

class HydratedRoll extends HydratableAction<typeof Roll> {
    declare playerId: string
    constructor(data: Type.Static<typeof Roll>) {
        super(data, RollValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state
            .getPlayerState(this.playerId)
            .rolls.push(state.getPlayerPrng(this.playerId).dieRoll(6))
        this.revealsInfo = true
    }
}

class HydratedStash extends HydratableAction<typeof Stash> {
    declare playerId: string
    declare label: string
    constructor(data: Type.Static<typeof Stash>) {
        super(data, StashValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.items[this.id] = { playerId: this.playerId, label: this.label }
    }
}

class HydratedDrop extends HydratableAction<typeof Drop> {
    declare itemId: string
    constructor(data: Type.Static<typeof Drop>) {
        super(data, DropValidator)
    }
    apply(state: HydratedSpanGameState): void {
        Reflect.deleteProperty(state.items, this.itemId)
    }
}

class HydratedGrab extends HydratableAction<typeof Grab> {
    constructor(data: Type.Static<typeof Grab>) {
        super(data, GrabValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.pot += 1
    }
}

class HydratedLogIt extends HydratableAction<typeof LogIt> {
    declare playerId: string
    constructor(data: Type.Static<typeof LogIt>) {
        super(data, LogItValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.log.push(this.playerId)
    }
}

class HydratedQueue extends HydratableAction<typeof Queue> {
    declare playerId: string
    declare amount: number
    constructor(data: Type.Static<typeof Queue>) {
        super(data, QueueValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.getPlayerState(this.playerId).queued += this.amount
    }
}

class HydratedPeek extends HydratableAction<typeof Peek> {
    declare playerId: string
    declare otherPlayerId: string
    constructor(data: Type.Static<typeof Peek>) {
        super(data, PeekValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.getPlayerState(this.playerId).work = state.getPlayerState(this.otherPlayerId).work
    }
}

class HydratedPoke extends HydratableAction<typeof Poke> {
    declare otherPlayerId: string
    constructor(data: Type.Static<typeof Poke>) {
        super(data, PokeValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.getPlayerState(this.otherPlayerId).work += 1
    }
}

class HydratedCutIn extends HydratableAction<typeof CutIn> {
    declare playerId: string
    constructor(data: Type.Static<typeof CutIn>) {
        super(data, CutInValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.line.unshift({ playerId: this.playerId, label: 'cut in' })
    }
}

class HydratedClaim extends HydratableAction<typeof Claim> {
    declare playerId: string
    constructor(data: Type.Static<typeof Claim>) {
        super(data, ClaimValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.flag.playerId = this.playerId
    }
}

class HydratedNoise extends HydratableAction<typeof Noise> {
    constructor(data: Type.Static<typeof Noise>) {
        super(data, NoiseValidator)
    }
    apply(): void {}
}

class HydratedFinish extends HydratableAction<typeof Finish> {
    constructor(data: Type.Static<typeof Finish>) {
        super(data, FinishValidator)
    }
    apply(): void {}
}

class HydratedShout extends HydratableAction<typeof Shout> {
    constructor(data: Type.Static<typeof Shout>) {
        super(data, ShoutValidator)
    }
    apply(): void {}
}

class HydratedOpenBranch extends HydratableAction<typeof OpenBranch> {
    constructor(data: Type.Static<typeof OpenBranch>) {
        super(data, OpenBranchValidator)
    }
    apply(): void {}
}

class HydratedIdleSkip extends HydratableAction<typeof IdleSkip> {
    constructor(data: Type.Static<typeof IdleSkip>) {
        super(data, IdleSkipValidator)
    }
    apply(): void {}
}

class HydratedNextSpan extends HydratableAction<typeof NextSpan> {
    constructor(data: Type.Static<typeof NextSpan>) {
        super(data, NextSpanValidator)
    }
    apply(): void {}
}

class HydratedComplete extends HydratableAction<typeof Complete> {
    constructor(data: Type.Static<typeof Complete>) {
        super(data, CompleteValidator)
    }
    apply(state: HydratedSpanGameState): void {
        state.spansCompleted += 1
        for (const playerId of mergeOrder(state)) {
            const player = state.getPlayerState(playerId)
            state.pot += player.queued
            player.queued = 0
        }
    }
}

function mergeOrder(state: HydratedSpanGameState): string[] {
    return state.turnManager.turnOrder.toReversed()
}

export interface SpanGameOptions {
    readonly idle?: readonly string[]
    readonly branchingEntry?: 'quiet' | 'writesSharedState' | 'queuesWhenBranchReturns'
    readonly merge?: 'barrier' | 'ordered'
    readonly startsInSpan?: boolean
    readonly sitsOut?: readonly string[]
    readonly mergeOrderOmits?: readonly string[]
    readonly spans?: number
}

class Initializer extends BaseGameInitializer<SpanGameState, HydratedSpanGameState> {
    constructor(private readonly options: SpanGameOptions) {
        super()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedSpanGameState {
        const playerIds = game.players.map((player) => player.id)
        return new HydratedSpanGameState({
            ...state,
            activePlayerIds: [playerIds[0]],
            machineState: this.options.startsInSpan ? 'branching' : 'setup',
            pot: 0,
            spansCompleted: 0,
            items: {},
            line: playerIds.map((playerId) => ({ playerId, label: 'waiting' })),
            flag: { label: 'unclaimed' },
            log: [],
            players: playerIds.map((playerId, index) => ({
                playerId,
                color: [Color.Red, Color.Blue, Color.Green][index],
                work: 0,
                rolls: [],
                queued: 0,
                idle: this.options.idle?.includes(playerId) ?? false
            })),
            turnManager: {
                series: [],
                turnOrder: playerIds,
                turnCounts: Object.fromEntries(playerIds.map((id) => [id, 0]))
            }
        })
    }
}

const UserActions = {
    begin: Begin,
    work: Work,
    roll: Roll,
    stash: Stash,
    drop: Drop,
    grab: Grab,
    logIt: LogIt,
    queue: Queue,
    peek: Peek,
    poke: Poke,
    cutIn: CutIn,
    claim: Claim,
    finish: Finish,
    shout: Shout
}

const spanGameVisibility = {
    state: Visibility.createProjector(SpanGameSchema),
    actions: Visibility.createActionProjector({
        ...UserActions,
        openBranch: OpenBranch,
        idleSkip: IdleSkip,
        noise: Noise,
        nextSpan: NextSpan,
        complete: Complete
    })
}

const WorkingValidators = [
    WorkValidator,
    RollValidator,
    StashValidator,
    DropValidator,
    GrabValidator,
    LogItValidator,
    QueueValidator,
    PeekValidator,
    PokeValidator,
    CutInValidator,
    ClaimValidator,
    FinishValidator,
    ShoutValidator,
    IdleSkipValidator
]

export function spanGameRuntime(
    options: SpanGameOptions = {}
): GameRuntime<SpanGameState, HydratedSpanGameState> {
    return {
        randomnessVersion: 1,
        initializer: new Initializer(options),
        hydrator: {
            hydrateState: (state) => new HydratedSpanGameState(state),
            hydrateAction: (action) => {
                if (BeginValidator.Check(action)) return new HydratedBegin(action)
                if (WorkValidator.Check(action)) return new HydratedWork(action)
                if (RollValidator.Check(action)) return new HydratedRoll(action)
                if (StashValidator.Check(action)) return new HydratedStash(action)
                if (DropValidator.Check(action)) return new HydratedDrop(action)
                if (GrabValidator.Check(action)) return new HydratedGrab(action)
                if (LogItValidator.Check(action)) return new HydratedLogIt(action)
                if (QueueValidator.Check(action)) return new HydratedQueue(action)
                if (PeekValidator.Check(action)) return new HydratedPeek(action)
                if (PokeValidator.Check(action)) return new HydratedPoke(action)
                if (CutInValidator.Check(action)) return new HydratedCutIn(action)
                if (ClaimValidator.Check(action)) return new HydratedClaim(action)
                if (FinishValidator.Check(action)) return new HydratedFinish(action)
                if (ShoutValidator.Check(action)) return new HydratedShout(action)
                if (OpenBranchValidator.Check(action)) return new HydratedOpenBranch(action)
                if (IdleSkipValidator.Check(action)) return new HydratedIdleSkip(action)
                if (NoiseValidator.Check(action)) return new HydratedNoise(action)
                if (NextSpanValidator.Check(action)) return new HydratedNextSpan(action)
                if (CompleteValidator.Check(action)) return new HydratedComplete(action)
                throw Error(`Unknown action ${action.type}`)
            }
        },
        canonicalStateValidator: Validator,
        playerColors: [Color.Red, Color.Blue, Color.Green],
        apiActions: UserActions,
        visibility: spanGameVisibility,
        parallelSpans: {
            branching: {
                mergeOrder: (state) =>
                    mergeOrder(state).filter(
                        (playerId) => !options.mergeOrderOmits?.includes(playerId)
                    ),
                merge: options.merge ?? 'ordered',
                branchStart: OpenBranch,
                spanCompletion: Complete
            }
        },
        stateHandlers: {
            setup: {
                enter() {},
                validActionsForPlayer: () => ['begin', 'shout'],
                isValidAction: (action) =>
                    BeginValidator.Check(action) || ShoutValidator.Check(action),
                onAction: (action) => (BeginValidator.Check(action) ? 'branching' : 'setup')
            },
            branching: {
                enter(context: MachineContext<HydratedSpanGameState>) {
                    const state = context.gameState
                    state.activePlayerIds = state.players
                        .map((player) => player.playerId)
                        .filter((playerId) => !options.sitsOut?.includes(playerId))
                    if (options.branchingEntry === 'writesSharedState') state.log.push('entered')
                    if (
                        options.branchingEntry === 'queuesWhenBranchReturns' &&
                        state.parallelSpan?.branchPlayerId !== undefined
                    ) {
                        context.addSystemAction(Noise)
                    }
                },
                validActionsForPlayer: () => [],
                isValidAction: (action) =>
                    OpenBranchValidator.Check(action) ||
                    CompleteValidator.Check(action) ||
                    NoiseValidator.Check(action),
                onAction: (action) => {
                    if (CompleteValidator.Check(action)) return 'scoring'
                    return NoiseValidator.Check(action) ? 'branching' : 'working'
                }
            },
            working: {
                enter(context: MachineContext<HydratedSpanGameState>) {
                    const playerId = context.gameState.parallelSpan?.branchPlayerId
                    if (playerId !== undefined && context.gameState.getPlayerState(playerId).idle) {
                        context.addSystemAction(IdleSkip, { playerId })
                    }
                },
                validActionsForPlayer: (
                    playerId: string,
                    context: MachineContext<HydratedSpanGameState>
                ) => (context.gameState.isActivePlayer(playerId) ? ['work', 'roll', 'finish'] : []),
                isValidAction: (action) =>
                    WorkingValidators.some((validator) => validator.Check(action)),
                onAction: (action) =>
                    FinishValidator.Check(action) || IdleSkipValidator.Check(action)
                        ? 'branching'
                        : 'working'
            },
            scoring: {
                enter(context: MachineContext<HydratedSpanGameState>) {
                    context.gameState.activePlayerIds = []
                    if (context.gameState.spansCompleted < (options.spans ?? 1)) {
                        context.addSystemAction(NextSpan)
                    }
                },
                validActionsForPlayer: () => [],
                isValidAction: (action) => NextSpanValidator.Check(action),
                onAction: () => 'branching'
            }
        }
    }
}

export const spanGameInfo = {
    id: 'span-game',
    metadata: {
        name: 'Span Game',
        description: 'Parallel Span fixture',
        version: '1.0.0',
        designer: 'Tabletop',
        year: '2026',
        minPlayers: 3,
        maxPlayers: 3,
        defaultPlayerCount: 3,
        beta: true
    }
}

export const SPAN_GAME_ID = 'span-game'
export const SPAN_PLAYER_IDS = ['p1', 'p2', 'p3']
export const SPAN_MERGE_ORDER = ['p3', 'p2', 'p1']

export function createSpanGame(options: SpanGameOptions = {}) {
    const runtime = spanGameRuntime(options)
    const engine = new GameEngine(runtime)
    const game = runtime.initializer.initializeGame(
        {
            id: SPAN_GAME_ID,
            typeId: SPAN_GAME_ID,
            ownerId: 'p1',
            players: SPAN_PLAYER_IDS.map((id) => ({
                id,
                name: id,
                userId: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        { info: spanGameInfo, runtime }
    )
    const { startedGame, initialState } = engine.startGame(game, {
        masterSeed: SPAN_GAME_MASTER_SEED
    })
    return { engine, runtime, game: startedGame, state: initialState }
}

export type SpanActionType = keyof typeof UserActions
type SpanActionFields<Name extends SpanActionType> = Omit<
    Type.Static<(typeof UserActions)[Name]>,
    keyof PlayerAction
>

export function spanAction<Name extends SpanActionType>(
    id: string,
    type: Name,
    playerId: string,
    fields?: Partial<SpanActionFields<Name>>
): GameAction {
    return {
        id,
        gameId: SPAN_GAME_ID,
        type,
        source: ActionSource.User,
        playerId,
        ...(type === 'shout' ? { outOfTurn: true } : {}),
        ...fields
    }
}

export function summary(actions: readonly GameAction[]): string[] {
    return actions.map(
        (action) =>
            `${isBranchClose(action) ? 'closeBranch' : action.type}:${action.playerId ?? ''}`
    )
}
