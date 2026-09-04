import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists } from '../../../util/assertions.js'
import { ActionSource, GameAction, HydratableAction } from '../../engine/gameAction.js'
import type { MachineContext } from '../../engine/machineContext.js'
import type { GameRuntime } from '../../definition/gameDefinition.js'
import type { Game } from '../../model/game.js'
import { GameStatus } from '../../model/game.js'
import {
    GameState,
    HydratableGameState,
    type UninitializedGameState
} from '../../model/gameState.js'
import { Color } from '../../model/colors.js'
import { PlayerStatus } from '../../model/player.js'
import type { PlayerState } from '../../model/playerState.js'
import * as Visibility from '../index.js'

export const PlayerIds = ['player-1', 'player-2', 'player-3', 'player-4'] as const

export const ActionType = {
    StartRound: 'scenario.start-round',
    DealCards: 'scenario.deal-cards',
    PeekTopCard: 'scenario.peek-top-card',
    DrawTopCard: 'scenario.draw-top-card',
    EndRound: 'scenario.end-round',
    ForgetKnownCards: 'scenario.forget-known-cards'
} as const

const MachineState = 'scenario.round'
const CardVisibilityPolicy = 'scenario.card-visibility'
const CardZoneScope = 'scenario.card-zone'
const Card = Type.String()

const ProtectedCard = Visibility.protect(Card, { policy: CardVisibilityPolicy })

const CardZoneContext = Visibility.scope(
    Type.Object({ playerId: Type.Optional(Type.String()) }),
    CardZoneScope
)

const OwnedCards = Visibility.scope(
    Type.Object({
        playerId: Type.String(),
        cards: Type.Array(ProtectedCard),
        cardCount: Type.Number()
    }),
    CardZoneScope
)

const PrivateDeck = Visibility.scope(
    Type.Object({
        items: Type.Array(ProtectedCard),
        remaining: Type.Number()
    }),
    CardZoneScope
)

const CardKnowledge = Type.Object({
    playerId: Type.String(),
    cardIds: Type.Array(Card)
})

type HiddenCardState = Type.Static<typeof HiddenCardState>
const HiddenCardState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['machineState']),
        Type.Object({
            machineState: Type.Literal(MachineState),
            phase: Type.Union([
                Type.Literal('waiting'),
                Type.Literal('dealing'),
                Type.Literal('playing')
            ]),
            deck: PrivateDeck,
            hands: Type.Array(OwnedCards),
            knowledge: Visibility.protect(Type.Array(CardKnowledge), {
                policy: Visibility.Policy.HostOnly,
                redaction: Visibility.redaction.emptyArray()
            })
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

type PeekTopCard = Type.Static<typeof PeekTopCard>
const PeekTopCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.PeekTopCard),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true),
            observedCard: Visibility.protect(Type.Optional(Card), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

type DrawTopCard = Type.Static<typeof DrawTopCard>
const DrawTopCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.DrawTopCard),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true),
            drawnCard: Visibility.protect(Type.Optional(Card), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

type EndRound = Type.Static<typeof EndRound>
const EndRound = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.EndRound),
            targetPlayerId: Type.String()
        })
    ])
)

type ForgetKnownCards = Type.Static<typeof ForgetKnownCards>
const ForgetKnownCards = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.ForgetKnownCards),
            targetPlayerId: Type.String()
        })
    ])
)

const HiddenCardStateValidator = Compile(HiddenCardState)
const StartRoundValidator = Compile(StartRound)
const DealCardsValidator = Compile(DealCards)
const PeekTopCardValidator = Compile(PeekTopCard)
const DrawTopCardValidator = Compile(DrawTopCard)
const EndRoundValidator = Compile(EndRound)
const ForgetKnownCardsValidator = Compile(ForgetKnownCards)

class HydratedHiddenCardState
    extends HydratableGameState<typeof HiddenCardState, PlayerState>
    implements HiddenCardState
{
    declare machineState: typeof MachineState
    declare phase: 'waiting' | 'dealing' | 'playing'
    declare deck: Type.Static<typeof PrivateDeck>
    declare hands: Type.Static<typeof OwnedCards>[]
    declare knowledge: Type.Static<typeof CardKnowledge>[]

    constructor(state: HiddenCardState) {
        super(state, HiddenCardStateValidator)
    }
}

class HydratedStartRound extends HydratableAction<typeof StartRound> implements StartRound {
    declare type: typeof ActionType.StartRound

    constructor(action: StartRound) {
        super(action, StartRoundValidator)
    }

    apply(state: HydratedHiddenCardState, context?: MachineContext): void {
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

    apply(state: HydratedHiddenCardState): void {
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

class HydratedPeekTopCard extends HydratableAction<typeof PeekTopCard> implements PeekTopCard {
    declare type: typeof ActionType.PeekTopCard
    declare playerId: string
    declare revealsInfo: true
    declare observedCard?: string

    constructor(action: PeekTopCard) {
        super(action, PeekTopCardValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const observedCard = state.deck.items[0]
        assertExists(observedCard, 'Cannot observe the top Card of an empty deck')
        this.observedCard = observedCard

        const existingKnowledge = state.knowledge.find(
            (knowledge) => knowledge.playerId === this.playerId
        )
        if (existingKnowledge === undefined) {
            state.knowledge.push({ playerId: this.playerId, cardIds: [observedCard] })
        } else if (!existingKnowledge.cardIds.includes(observedCard)) {
            existingKnowledge.cardIds.push(observedCard)
        }
    }
}

class HydratedDrawTopCard extends HydratableAction<typeof DrawTopCard> implements DrawTopCard {
    declare type: typeof ActionType.DrawTopCard
    declare playerId: string
    declare revealsInfo: true
    declare drawnCard?: string

    constructor(action: DrawTopCard) {
        super(action, DrawTopCardValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const drawnCard = state.deck.items.shift()
        assertExists(drawnCard, 'Cannot draw the top Card of an empty deck')
        const hand = state.hands.find(({ playerId }) => playerId === this.playerId)
        assertExists(hand, `Cannot find a hand for Player ${this.playerId}`)

        state.deck.remaining = state.deck.items.length
        hand.cards.push(drawnCard)
        hand.cardCount = hand.cards.length
        this.drawnCard = drawnCard
    }
}

class HydratedEndRound extends HydratableAction<typeof EndRound> implements EndRound {
    declare type: typeof ActionType.EndRound
    declare targetPlayerId: string

    constructor(action: EndRound) {
        super(action, EndRoundValidator)
    }

    apply(_state: HydratedHiddenCardState, context?: MachineContext): void {
        assertExists(context, 'End Round requires a Machine Context')
        context.addSystemAction(ForgetKnownCards, { targetPlayerId: this.targetPlayerId })
    }
}

class HydratedForgetKnownCards
    extends HydratableAction<typeof ForgetKnownCards>
    implements ForgetKnownCards
{
    declare type: typeof ActionType.ForgetKnownCards
    declare targetPlayerId: string

    constructor(action: ForgetKnownCards) {
        super(action, ForgetKnownCardsValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const knowledgeIndex = state.knowledge.findIndex(
            ({ playerId }) => playerId === this.targetPlayerId
        )
        if (knowledgeIndex >= 0) {
            state.knowledge.splice(knowledgeIndex, 1)
        }
    }
}

function isStartRound(action: GameAction): action is StartRound {
    return action.type === ActionType.StartRound
}

function isDealCards(action: GameAction): action is DealCards {
    return action.type === ActionType.DealCards
}

function isPeekTopCard(action: GameAction): action is PeekTopCard {
    return action.type === ActionType.PeekTopCard
}

function isDrawTopCard(action: GameAction): action is DrawTopCard {
    return action.type === ActionType.DrawTopCard
}

function isEndRound(action: GameAction): action is EndRound {
    return action.type === ActionType.EndRound
}

function isForgetKnownCards(action: GameAction): action is ForgetKnownCards {
    return action.type === ActionType.ForgetKnownCards
}

function playerIdOf(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined
    }
    const playerId: unknown = Reflect.get(value, 'playerId')
    return typeof playerId === 'string' ? playerId : undefined
}

function cardIsKnownTo(root: unknown, playerId: string, card: unknown): boolean {
    if (typeof root !== 'object' || root === null) {
        return false
    }
    const knowledge: unknown = Reflect.get(root, 'knowledge')
    if (!Array.isArray(knowledge)) {
        return false
    }
    return knowledge.some((entry) => {
        if (playerIdOf(entry) !== playerId || typeof entry !== 'object' || entry === null) {
            return false
        }
        const cardIds: unknown = Reflect.get(entry, 'cardIds')
        return Array.isArray(cardIds) && cardIds.includes(card)
    })
}

function canViewCard(context: Visibility.PolicyContext<unknown>): boolean {
    if (context.perspective.kind === 'spectator') {
        return false
    }
    const zone = context.requireScope(CardZoneContext)
    return (
        zone.playerId === context.perspective.playerId ||
        cardIsKnownTo(context.root, context.perspective.playerId, context.value)
    )
}

const policies = { [CardVisibilityPolicy]: canViewCard }

const visibility = {
    state: Visibility.createProjector(HiddenCardState, { policies }),
    actions: Visibility.createActionProjector(
        {
            [ActionType.StartRound]: StartRound,
            [ActionType.DealCards]: DealCards,
            [ActionType.PeekTopCard]: PeekTopCard,
            [ActionType.DrawTopCard]: DrawTopCard,
            [ActionType.EndRound]: EndRound,
            [ActionType.ForgetKnownCards]: ForgetKnownCards
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
        initializeExplorationState: (state: HiddenCardState) => structuredClone(state)
    },
    hydrator: {
        hydrateAction: (action: GameAction) => {
            if (isStartRound(action)) {
                return new HydratedStartRound(action)
            }
            if (isDealCards(action)) {
                return new HydratedDealCards(action)
            }
            if (isPeekTopCard(action)) {
                return new HydratedPeekTopCard(action)
            }
            if (isDrawTopCard(action)) {
                return new HydratedDrawTopCard(action)
            }
            if (isEndRound(action)) {
                return new HydratedEndRound(action)
            }
            if (isForgetKnownCards(action)) {
                return new HydratedForgetKnownCards(action)
            }
            throw Error(`Unknown scenario Action ${action.type}`)
        },
        hydrateState: (state: HiddenCardState) => new HydratedHiddenCardState(state)
    },
    playerColors: [Color.Red, Color.Blue, Color.Green, Color.Yellow],
    apiActions: {
        [ActionType.StartRound]: StartRound,
        [ActionType.PeekTopCard]: PeekTopCard,
        [ActionType.DrawTopCard]: DrawTopCard,
        [ActionType.EndRound]: EndRound
    },
    stateHandlers: {
        [MachineState]: {
            isValidAction: () => true,
            validActionsForPlayer: () => [
                ActionType.StartRound,
                ActionType.PeekTopCard,
                ActionType.DrawTopCard,
                ActionType.EndRound
            ],
            enter: () => undefined,
            onAction: () => MachineState
        }
    },
    visibility
} satisfies GameRuntime<HiddenCardState, HydratedHiddenCardState>

function createCardState(
    deckItems: string[] = [
        'player-1-card-a',
        'player-1-card-b',
        'player-2-card-a',
        'player-2-card-b',
        'player-3-card-a',
        'player-3-card-b',
        'player-4-card-a',
        'player-4-card-b',
        'undealt-stock-card'
    ]
): HiddenCardState {
    return {
        systemVersion: 2,
        id: 'hidden-card-state',
        gameId: 'hidden-card-game',
        players: [
            { playerId: PlayerIds[0], color: Color.Red },
            { playerId: PlayerIds[1], color: Color.Blue },
            { playerId: PlayerIds[2], color: Color.Green },
            { playerId: PlayerIds[3], color: Color.Yellow }
        ],
        activePlayerIds: [...PlayerIds],
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
            items: deckItems,
            remaining: deckItems.length
        },
        hands: PlayerIds.map((playerId) => ({ playerId, cards: [], cardCount: 0 })),
        knowledge: []
    }
}

function createGame(): Game {
    return {
        id: 'hidden-card-game',
        typeId: 'hidden-information-scenario',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'scenario-owner',
        name: 'Hidden Card Scenario',
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
    const before = createCardState()
    const startRound: StartRound = {
        id: 'start-round',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.StartRound,
        playerId: PlayerIds[0]
    }
    return { before, game: createGame(), runtime, startRound }
}

export function createPrivateObservationScenario() {
    const before = createCardState(['observed-card', 'unknown-stock-card'])
    before.phase = 'playing'
    const peekTopCard: PeekTopCard = {
        id: 'peek-top-card',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.PeekTopCard,
        playerId: PlayerIds[0],
        revealsInfo: true
    }
    const drawTopCard: DrawTopCard = {
        id: 'draw-top-card',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.DrawTopCard,
        playerId: PlayerIds[1],
        revealsInfo: true
    }
    return { before, drawTopCard, game: createGame(), peekTopCard, runtime }
}

export function createForgetKnowledgeScenario() {
    const before = createCardState(['unknown-stock-card'])
    before.phase = 'playing'
    const cardOwnerHand = before.hands.find(({ playerId }) => playerId === PlayerIds[1])
    assertExists(cardOwnerHand, `Cannot find a hand for Player ${PlayerIds[1]}`)
    cardOwnerHand.cards.push('observed-card')
    cardOwnerHand.cardCount = 1
    before.knowledge.push({ playerId: PlayerIds[0], cardIds: ['observed-card'] })

    const endRound: EndRound = {
        id: 'end-round',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.EndRound,
        playerId: PlayerIds[1],
        targetPlayerId: PlayerIds[0]
    }
    return { before, endRound, game: createGame(), runtime }
}
