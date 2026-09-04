import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists } from '../../util/assertions.js'
import { DrawBag } from '../components/drawBag.js'
import { ActionSource, GameAction, HydratableAction } from '../engine/gameAction.js'
import type { MachineContext } from '../engine/machineContext.js'
import type { GameRuntime } from '../definition/gameDefinition.js'
import type { Game } from '../model/game.js'
import { GameStatus } from '../model/game.js'
import { GameState, HydratableGameState, type UninitializedGameState } from '../model/gameState.js'
import { Color } from '../model/colors.js'
import { PlayerStatus } from '../model/player.js'
import type { PlayerState } from '../model/playerState.js'
import * as Visibility from './index.js'

export const PlayerIds = ['player-1', 'player-2', 'player-3', 'player-4'] as const

export const ActionType = {
    StartRound: 'scenario.start-round',
    DealCards: 'scenario.deal-cards'
} as const

const MachineState = 'scenario.round'
const HandOwnerPolicy = 'scenario.hand-owner'
const Card = Type.String()

const OwnedCards = Type.Object({
    playerId: Type.String(),
    cards: Visibility.protect(Type.Array(Card), {
        policy: HandOwnerPolicy,
        redaction: Visibility.redaction.emptyArray()
    }),
    cardCount: Type.Number()
})

type PrivateDealState = Type.Static<typeof PrivateDealState>
const PrivateDealState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['machineState']),
        Type.Object({
            machineState: Type.Literal(MachineState),
            phase: Type.Union([
                Type.Literal('waiting'),
                Type.Literal('dealing'),
                Type.Literal('playing')
            ]),
            deck: DrawBag(Card),
            hands: Type.Array(OwnedCards)
        })
    ])
)

type StartRound = Type.Static<typeof StartRound>
const StartRound = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({ type: Type.Literal(ActionType.StartRound) })
    ])
)

type DealCards = Type.Static<typeof DealCards>
const DealCards = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.DealCards),
            deals: Type.Optional(Type.Array(OwnedCards)),
            hostNote: Visibility.protect(Type.Optional(Type.String()), {
                policy: Visibility.Policy.HostOnly
            })
        })
    ])
)

const PrivateDealStateValidator = Compile(PrivateDealState)
const StartRoundValidator = Compile(StartRound)
const DealCardsValidator = Compile(DealCards)

class HydratedPrivateDealState
    extends HydratableGameState<typeof PrivateDealState, PlayerState>
    implements PrivateDealState
{
    declare machineState: typeof MachineState
    declare phase: 'waiting' | 'dealing' | 'playing'
    declare deck: Type.Static<ReturnType<typeof DrawBag<typeof Card>>>
    declare hands: Type.Static<typeof OwnedCards>[]

    constructor(state: PrivateDealState) {
        super(state, PrivateDealStateValidator)
    }
}

class HydratedStartRound extends HydratableAction<typeof StartRound> implements StartRound {
    declare type: typeof ActionType.StartRound

    constructor(action: StartRound) {
        super(action, StartRoundValidator)
    }

    apply(state: HydratedPrivateDealState, context?: MachineContext): void {
        assertExists(context, 'Start Round requires a Machine Context')
        state.phase = 'dealing'
        context.addSystemAction(DealCards)
    }
}

class HydratedDealCards extends HydratableAction<typeof DealCards> implements DealCards {
    declare type: typeof ActionType.DealCards
    declare deals?: Type.Static<typeof OwnedCards>[]
    declare hostNote?: string

    constructor(action: DealCards) {
        super(action, DealCardsValidator)
    }

    apply(state: HydratedPrivateDealState): void {
        const deals: Type.Static<typeof OwnedCards>[] = []
        for (const hand of state.hands) {
            const cards = state.deck.items.splice(0, 2)
            hand.cards.push(...cards)
            hand.cardCount = hand.cards.length
            deals.push({ playerId: hand.playerId, cards, cardCount: cards.length })
        }
        state.deck.remaining = state.deck.items.length
        state.phase = 'playing'
        this.deals = deals
        this.hostNote = 'host-only-deal-note'
    }
}

function isStartRound(action: GameAction): action is StartRound {
    return action.type === ActionType.StartRound
}

function isDealCards(action: GameAction): action is DealCards {
    return action.type === ActionType.DealCards
}

function playerIdOf(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined
    }
    const playerId: unknown = Reflect.get(value, 'playerId')
    return typeof playerId === 'string' ? playerId : undefined
}

function canViewOwnedHand(context: Visibility.PolicyContext<unknown>): boolean {
    return (
        context.perspective.kind === 'player' &&
        context.perspective.playerId === playerIdOf(context.parent)
    )
}

const policies = { [HandOwnerPolicy]: canViewOwnedHand }

const visibility = {
    state: Visibility.createProjector(PrivateDealState, { policies }),
    actions: Visibility.createActionProjector(
        {
            [ActionType.StartRound]: StartRound,
            [ActionType.DealCards]: DealCards
        },
        { policies }
    )
}

const runtime = {
    initializer: {
        initializeGame: () => {
            throw Error('Scenario does not initialize Games')
        },
        initializeGameState: (_game: Game, _state: UninitializedGameState) => {
            throw Error('Scenario does not initialize Game State')
        },
        initializeExplorationState: (state: PrivateDealState) => structuredClone(state)
    },
    hydrator: {
        hydrateAction: (action: GameAction) => {
            if (isStartRound(action)) {
                return new HydratedStartRound(action)
            }
            if (isDealCards(action)) {
                return new HydratedDealCards(action)
            }
            throw Error(`Unknown scenario Action ${action.type}`)
        },
        hydrateState: (state: PrivateDealState) => new HydratedPrivateDealState(state)
    },
    playerColors: [Color.Red, Color.Blue, Color.Green, Color.Yellow],
    apiActions: { [ActionType.StartRound]: StartRound },
    stateHandlers: {
        [MachineState]: {
            isValidAction: () => true,
            validActionsForPlayer: () => [ActionType.StartRound],
            enter: () => undefined,
            onAction: () => MachineState
        }
    },
    visibility
} satisfies GameRuntime<PrivateDealState, HydratedPrivateDealState>

function createBeforeState(): PrivateDealState {
    return {
        systemVersion: 2,
        id: 'private-deal-state',
        gameId: 'private-deal-game',
        players: [
            { playerId: PlayerIds[0], color: Color.Red },
            { playerId: PlayerIds[1], color: Color.Blue },
            { playerId: PlayerIds[2], color: Color.Green },
            { playerId: PlayerIds[3], color: Color.Yellow }
        ],
        activePlayerIds: [PlayerIds[0]],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 101, invocations: 0 },
        machineState: MachineState,
        turnManager: {
            series: [],
            turnOrder: [...PlayerIds],
            turnCounts: Object.fromEntries(PlayerIds.map((playerId) => [playerId, 0]))
        },
        winningPlayerIds: [],
        phase: 'waiting',
        deck: {
            items: [
                'player-1-card-a',
                'player-1-card-b',
                'player-2-card-a',
                'player-2-card-b',
                'player-3-card-a',
                'player-3-card-b',
                'player-4-card-a',
                'player-4-card-b',
                'undealt-stock-card'
            ],
            remaining: 9
        },
        hands: PlayerIds.map((playerId) => ({ playerId, cards: [], cardCount: 0 }))
    }
}

function createGame(): Game {
    return {
        id: 'private-deal-game',
        typeId: 'hidden-information-scenario',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'scenario-owner',
        name: 'Private Deal Scenario',
        players: PlayerIds.map((id, index) => ({
            id,
            isHuman: false,
            name: `Player ${index + 1}`,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 101,
        createdAt: new Date(0)
    }
}

export function createPrivateDealScenario() {
    const before = createBeforeState()
    const startRound: StartRound = {
        id: 'start-round',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.StartRound,
        playerId: PlayerIds[0]
    }
    return { before, game: createGame(), runtime, startRound }
}
