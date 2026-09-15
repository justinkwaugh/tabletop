import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists } from '../../../util/assertions.js'
import {
    ActionSource,
    GameAction,
    type HydratedAction,
    HydratableAction
} from '../../engine/gameAction.js'
import type { MachineContext } from '../../engine/machineContext.js'
import type { MachineStateHandler } from '../../engine/machineStateHandler.js'
import type { GameRuntime } from '../../definition/gameDefinition.js'
import type { Game } from '../../model/game.js'
import { GameStatus } from '../../model/game.js'
import {
    GameState,
    HydratableGameState,
    type UninitializedGameState
} from '../../model/gameState.js'
import { GameResult } from '../../model/gameResult.js'
import { Color } from '../../model/colors.js'
import { PlayerStatus } from '../../model/player.js'
import type { PlayerState } from '../../model/playerState.js'
import { shuffle } from '../../../util/shuffle.js'
import * as Visibility from '../index.js'

export const PlayerIds = ['player-1', 'player-2', 'player-3', 'player-4'] as const

export const ActionType = {
    StartRound: 'scenario.start-round',
    DealCards: 'scenario.deal-cards',
    PrepareDeck: 'scenario.prepare-deck',
    ShuffleDeck: 'scenario.shuffle-deck',
    DeckPrepared: 'scenario.deck-prepared',
    PeekTopCard: 'scenario.peek-top-card',
    DrawTopCard: 'scenario.draw-top-card',
    EndRound: 'scenario.end-round',
    ForgetKnownCards: 'scenario.forget-known-cards',
    StealTopCard: 'scenario.steal-top-card',
    AdvanceSecretAudience: 'scenario.advance-secret-audience',
    RevealCard: 'scenario.reveal-card',
    CompleteGame: 'scenario.complete-game'
} as const

const MachineState = 'scenario.round'
const CardVisibilityPolicy = 'scenario.card-visibility'
const ActionParticipantPolicy = 'scenario.action-participant'
const TeamSecretPolicy = 'scenario.team-secret'
const CardZoneScope = 'scenario.card-zone'
const TeamSecretScope = 'scenario.team-secret'
const Card = Type.String()

const SecretRevealLevel = {
    Owner: 'owner',
    Team: 'team',
    Public: 'public'
} as const

const SecretRevealLevelSchema = Type.Union([
    Type.Literal(SecretRevealLevel.Owner),
    Type.Literal(SecretRevealLevel.Team),
    Type.Literal(SecretRevealLevel.Public)
])

const TeamSecretContext = Visibility.scope(
    Type.Object({
        ownerPlayerId: Type.String(),
        teamPlayerIds: Type.Array(Type.String()),
        revealLevel: SecretRevealLevelSchema
    }),
    TeamSecretScope
)

const TeamSecret = Visibility.scope(
    Type.Object({
        ownerPlayerId: Type.String(),
        teamPlayerIds: Type.Array(Type.String()),
        revealLevel: SecretRevealLevelSchema,
        value: Visibility.protect(Type.Optional(Type.String()), { policy: TeamSecretPolicy })
    }),
    TeamSecretScope
)

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
                Type.Literal('playing'),
                Type.Literal('complete')
            ]),
            deck: PrivateDeck,
            hands: Type.Array(OwnedCards),
            revealedCardIds: Type.Array(Card),
            knowledge: Visibility.protect(Type.Array(CardKnowledge), {
                policy: Visibility.Policy.HostOnly,
                redaction: Visibility.redaction.emptyArray()
            }),
            generatedActionIds: Type.Optional(Type.Array(Type.String())),
            siblingCount: Type.Optional(Type.Number()),
            teamSecret: Type.Optional(TeamSecret)
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

type PrepareDeck = Type.Static<typeof PrepareDeck>
const PrepareDeck = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({ type: Type.Literal(ActionType.PrepareDeck) })
    ])
)

type ShuffleDeck = Type.Static<typeof ShuffleDeck>
const ShuffleDeck = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({ type: Type.Literal(ActionType.ShuffleDeck) })
    ])
)

type DeckPrepared = Type.Static<typeof DeckPrepared>
const DeckPrepared = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({ type: Type.Literal(ActionType.DeckPrepared) })
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

type StealTopCard = Type.Static<typeof StealTopCard>
const PrivateTransferMetadata = Type.Object({
    publicDescription: Type.String(),
    historyDescription: Visibility.protect(Type.String(), {
        policy: ActionParticipantPolicy
    }),
    animation: Type.Object({
        kind: Type.Literal('private-card-transfer'),
        cardId: Visibility.protect(Card, { policy: ActionParticipantPolicy }),
        fromPlayerId: Type.String(),
        toPlayerId: Type.String()
    })
})
const StealTopCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.StealTopCard),
            playerId: Type.String(),
            targetPlayerId: Type.String(),
            revealsInfo: Type.Literal(true),
            stolenCard: Visibility.protect(Type.Optional(Card), {
                policy: ActionParticipantPolicy
            }),
            metadata: Type.Optional(PrivateTransferMetadata)
        })
    ])
)

type AdvanceSecretAudience = Type.Static<typeof AdvanceSecretAudience>
const AdvanceSecretAudience = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.AdvanceSecretAudience),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true)
        })
    ])
)

type RevealCard = Type.Static<typeof RevealCard>
const RevealCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.RevealCard),
            playerId: Type.String(),
            cardId: Card,
            revealsInfo: Type.Literal(true)
        })
    ])
)

type CompleteGame = Type.Static<typeof CompleteGame>
const CompleteGame = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CompleteGame),
            playerId: Type.String()
        })
    ])
)

const HiddenCardStateValidator = Compile(HiddenCardState)
const StartRoundValidator = Compile(StartRound)
const DealCardsValidator = Compile(DealCards)
const PrepareDeckValidator = Compile(PrepareDeck)
const ShuffleDeckValidator = Compile(ShuffleDeck)
const DeckPreparedValidator = Compile(DeckPrepared)
const PeekTopCardValidator = Compile(PeekTopCard)
const DrawTopCardValidator = Compile(DrawTopCard)
const EndRoundValidator = Compile(EndRound)
const ForgetKnownCardsValidator = Compile(ForgetKnownCards)
const StealTopCardValidator = Compile(StealTopCard)
const AdvanceSecretAudienceValidator = Compile(AdvanceSecretAudience)
const RevealCardValidator = Compile(RevealCard)
const CompleteGameValidator = Compile(CompleteGame)

class HydratedHiddenCardState
    extends HydratableGameState<typeof HiddenCardState, PlayerState>
    implements HiddenCardState
{
    declare machineState: typeof MachineState
    declare phase: 'waiting' | 'dealing' | 'playing' | 'complete'
    declare deck: Type.Static<typeof PrivateDeck>
    declare hands: Type.Static<typeof OwnedCards>[]
    declare revealedCardIds: string[]
    declare knowledge: Type.Static<typeof CardKnowledge>[]
    declare generatedActionIds?: string[]
    declare siblingCount?: number
    declare teamSecret?: Type.Static<typeof TeamSecret>

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

class HydratedPrepareDeck extends HydratableAction<typeof PrepareDeck> implements PrepareDeck {
    declare type: typeof ActionType.PrepareDeck

    constructor(action: PrepareDeck) {
        super(action, PrepareDeckValidator)
    }

    apply(state: HydratedHiddenCardState, context?: MachineContext): void {
        assertExists(context, 'Prepare Deck requires a Machine Context')
        state.phase = 'dealing'
        const shuffleAction = context.createSystemAction(ShuffleDeck)
        state.generatedActionIds?.push(shuffleAction.id)
        context.getPendingActions().push(shuffleAction)
        for (let index = 0; index < (state.siblingCount ?? 0); index++) {
            const sibling = context.createSystemAction(DeckPrepared)
            state.generatedActionIds?.push(sibling.id)
            context.getPendingActions().push(sibling)
        }
    }
}

class HydratedShuffleDeck extends HydratableAction<typeof ShuffleDeck> implements ShuffleDeck {
    declare type: typeof ActionType.ShuffleDeck

    constructor(action: ShuffleDeck) {
        super(action, ShuffleDeckValidator)
    }

    apply(state: HydratedHiddenCardState, context?: MachineContext): void {
        assertExists(context, 'Shuffle Deck requires a Machine Context')
        const random = state.getProtectedPrng().random
        shuffle(state.deck.items, random)
        const prepared = context.createSystemAction(DeckPrepared)
        state.generatedActionIds?.push(prepared.id)
        context.getPendingActions().push(prepared)
    }
}

class HydratedDeckPrepared extends HydratableAction<typeof DeckPrepared> implements DeckPrepared {
    declare type: typeof ActionType.DeckPrepared

    constructor(action: DeckPrepared) {
        super(action, DeckPreparedValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        state.phase = 'playing'
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

class HydratedStealTopCard extends HydratableAction<typeof StealTopCard> implements StealTopCard {
    declare type: typeof ActionType.StealTopCard
    declare playerId: string
    declare targetPlayerId: string
    declare revealsInfo: true
    declare stolenCard?: string
    declare metadata?: Type.Static<typeof PrivateTransferMetadata>

    constructor(action: StealTopCard) {
        super(action, StealTopCardValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const actorHand = state.hands.find(({ playerId }) => playerId === this.playerId)
        assertExists(actorHand, `Cannot find a hand for Player ${this.playerId}`)
        const targetHand = state.hands.find(({ playerId }) => playerId === this.targetPlayerId)
        assertExists(targetHand, `Cannot find a hand for Player ${this.targetPlayerId}`)
        const stolenCard = targetHand.cards.shift()
        assertExists(stolenCard, `Cannot steal from Player ${this.targetPlayerId}'s empty hand`)

        actorHand.cards.push(stolenCard)
        actorHand.cardCount = actorHand.cards.length
        targetHand.cardCount = targetHand.cards.length
        this.stolenCard = stolenCard
        this.metadata = {
            publicDescription: 'One card changed hands',
            historyDescription: `Player 1 stole ${stolenCard} from Player 2`,
            animation: {
                kind: 'private-card-transfer',
                cardId: stolenCard,
                fromPlayerId: this.targetPlayerId,
                toPlayerId: this.playerId
            }
        }

        const existingKnowledge = state.knowledge.find(
            ({ playerId }) => playerId === this.targetPlayerId
        )
        if (existingKnowledge === undefined) {
            state.knowledge.push({ playerId: this.targetPlayerId, cardIds: [stolenCard] })
        } else if (!existingKnowledge.cardIds.includes(stolenCard)) {
            existingKnowledge.cardIds.push(stolenCard)
        }
    }
}

class HydratedAdvanceSecretAudience
    extends HydratableAction<typeof AdvanceSecretAudience>
    implements AdvanceSecretAudience
{
    declare type: typeof ActionType.AdvanceSecretAudience
    declare playerId: string
    declare revealsInfo: true

    constructor(action: AdvanceSecretAudience) {
        super(action, AdvanceSecretAudienceValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const teamSecret = state.teamSecret
        assertExists(teamSecret, 'Cannot advance a missing team secret')
        if (teamSecret.revealLevel === SecretRevealLevel.Owner) {
            teamSecret.revealLevel = SecretRevealLevel.Team
            return
        }
        if (teamSecret.revealLevel === SecretRevealLevel.Team) {
            teamSecret.revealLevel = SecretRevealLevel.Public
            return
        }
        throw Error('Cannot advance an already-public team secret')
    }
}

class HydratedRevealCard extends HydratableAction<typeof RevealCard> implements RevealCard {
    declare type: typeof ActionType.RevealCard
    declare playerId: string
    declare cardId: string
    declare revealsInfo: true

    constructor(action: RevealCard) {
        super(action, RevealCardValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        const hand = state.hands.find(({ playerId }) => playerId === this.playerId)
        assertExists(hand, `Cannot find a hand for Player ${this.playerId}`)
        assert(
            hand.cards.includes(this.cardId),
            `Player ${this.playerId} cannot reveal a Card outside their hand`
        )
        if (!state.revealedCardIds.includes(this.cardId)) {
            state.revealedCardIds.push(this.cardId)
        }
    }
}

class HydratedCompleteGame extends HydratableAction<typeof CompleteGame> implements CompleteGame {
    declare type: typeof ActionType.CompleteGame
    declare playerId: string

    constructor(action: CompleteGame) {
        super(action, CompleteGameValidator)
    }

    apply(state: HydratedHiddenCardState): void {
        state.phase = 'complete'
        state.result = GameResult.Win
        state.winningPlayerIds = [this.playerId]
        state.activePlayerIds = []
    }
}

function isStartRound(action: GameAction): action is StartRound {
    return action.type === ActionType.StartRound
}

function isDealCards(action: GameAction): action is DealCards {
    return action.type === ActionType.DealCards
}

function isPrepareDeck(action: GameAction): action is PrepareDeck {
    return action.type === ActionType.PrepareDeck
}

function isShuffleDeck(action: GameAction): action is ShuffleDeck {
    return action.type === ActionType.ShuffleDeck
}

function isDeckPrepared(action: GameAction): action is DeckPrepared {
    return action.type === ActionType.DeckPrepared
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

function isStealTopCard(action: GameAction): action is StealTopCard {
    return action.type === ActionType.StealTopCard
}

function isAdvanceSecretAudience(action: GameAction): action is AdvanceSecretAudience {
    return action.type === ActionType.AdvanceSecretAudience
}

function isRevealCard(action: GameAction): action is RevealCard {
    return action.type === ActionType.RevealCard
}

function isCompleteGame(action: GameAction): action is CompleteGame {
    return action.type === ActionType.CompleteGame
}

function stringPropertyOf(value: unknown, property: string): string | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined
    }
    const propertyValue: unknown = Reflect.get(value, property)
    return typeof propertyValue === 'string' ? propertyValue : undefined
}

function playerIdOf(value: unknown): string | undefined {
    return stringPropertyOf(value, 'playerId')
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

function cardIsPubliclyRevealed(root: unknown, card: unknown): boolean {
    if (typeof root !== 'object' || root === null) {
        return false
    }
    const revealedCardIds: unknown = Reflect.get(root, 'revealedCardIds')
    return Array.isArray(revealedCardIds) && revealedCardIds.includes(card)
}

function canViewCard(context: Visibility.PolicyContext<unknown>): boolean {
    if (cardIsPubliclyRevealed(context.root, context.value)) {
        return true
    }
    if (context.perspective.kind === 'spectator') {
        return false
    }
    const zone = context.requireScope(CardZoneContext)
    return (
        zone.playerId === context.perspective.playerId ||
        cardIsKnownTo(context.root, context.perspective.playerId, context.value)
    )
}

function canViewActionParticipant(context: Visibility.PolicyContext<unknown>): boolean {
    return (
        context.perspective.kind === 'player' &&
        (context.perspective.playerId === playerIdOf(context.root) ||
            context.perspective.playerId === stringPropertyOf(context.root, 'targetPlayerId'))
    )
}

function canViewTeamSecret(context: Visibility.PolicyContext<unknown>): boolean {
    const teamSecret = context.requireScope(TeamSecretContext)
    if (teamSecret.revealLevel === SecretRevealLevel.Public) {
        return true
    }
    if (context.perspective.kind === 'spectator') {
        return false
    }
    if (context.perspective.playerId === teamSecret.ownerPlayerId) {
        return true
    }
    return (
        teamSecret.revealLevel === SecretRevealLevel.Team &&
        teamSecret.teamPlayerIds.includes(context.perspective.playerId)
    )
}

const policies = {
    [CardVisibilityPolicy]: canViewCard,
    [ActionParticipantPolicy]: canViewActionParticipant,
    [TeamSecretPolicy]: canViewTeamSecret
}

const actionSchemas = {
    [ActionType.StartRound]: StartRound,
    [ActionType.DealCards]: DealCards,
    [ActionType.PrepareDeck]: PrepareDeck,
    [ActionType.ShuffleDeck]: Visibility.protectAction(ShuffleDeck, {
        policy: Visibility.Policy.HostOnly
    }),
    [ActionType.DeckPrepared]: DeckPrepared,
    [ActionType.PeekTopCard]: PeekTopCard,
    [ActionType.DrawTopCard]: DrawTopCard,
    [ActionType.EndRound]: EndRound,
    [ActionType.ForgetKnownCards]: ForgetKnownCards,
    [ActionType.StealTopCard]: StealTopCard,
    [ActionType.AdvanceSecretAudience]: AdvanceSecretAudience,
    [ActionType.RevealCard]: RevealCard,
    [ActionType.CompleteGame]: CompleteGame
}

const visibility = {
    state: Visibility.createProjector(HiddenCardState, { policies }),
    actions: Visibility.createActionProjector(actionSchemas, { policies })
}

const runtime = {
    initializer: {
        initializeGame: () => {
            throw Error('Scenario does not initialize Games')
        },
        initializeGameState: (_game: Game, _state: UninitializedGameState) => {
            throw Error('Scenario does not initialize Game State')
        }
    },
    hydrator: {
        hydrateAction: (action: GameAction) => {
            if (isStartRound(action)) {
                return new HydratedStartRound(action)
            }
            if (isDealCards(action)) {
                return new HydratedDealCards(action)
            }
            if (isPrepareDeck(action)) {
                return new HydratedPrepareDeck(action)
            }
            if (isShuffleDeck(action)) {
                return new HydratedShuffleDeck(action)
            }
            if (isDeckPrepared(action)) {
                return new HydratedDeckPrepared(action)
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
            if (isStealTopCard(action)) {
                return new HydratedStealTopCard(action)
            }
            if (isAdvanceSecretAudience(action)) {
                return new HydratedAdvanceSecretAudience(action)
            }
            if (isRevealCard(action)) {
                return new HydratedRevealCard(action)
            }
            if (isCompleteGame(action)) {
                return new HydratedCompleteGame(action)
            }
            throw Error(`Unknown scenario Action ${action.type}`)
        },
        hydrateState: (state: HiddenCardState) => new HydratedHiddenCardState(state)
    },
    playerColors: [Color.Red, Color.Blue, Color.Green, Color.Yellow],
    apiActions: {
        [ActionType.StartRound]: StartRound,
        [ActionType.PrepareDeck]: PrepareDeck,
        [ActionType.PeekTopCard]: PeekTopCard,
        [ActionType.DrawTopCard]: DrawTopCard,
        [ActionType.EndRound]: EndRound,
        [ActionType.StealTopCard]: StealTopCard,
        [ActionType.AdvanceSecretAudience]: AdvanceSecretAudience,
        [ActionType.RevealCard]: RevealCard,
        [ActionType.CompleteGame]: CompleteGame
    },
    stateHandlers: {
        [MachineState]: {
            isValidAction: () => true,
            validActionsForPlayer: () => [
                ActionType.StartRound,
                ActionType.PrepareDeck,
                ActionType.PeekTopCard,
                ActionType.DrawTopCard,
                ActionType.EndRound,
                ActionType.StealTopCard,
                ActionType.AdvanceSecretAudience,
                ActionType.RevealCard,
                ActionType.CompleteGame
            ],
            enter: () => undefined,
            onAction: () => MachineState
        }
    },
    visibility
} satisfies GameRuntime<HiddenCardState, HydratedHiddenCardState>

const publicShuffleRuntime = {
    ...runtime,
    visibility: {
        ...visibility,
        actions: Visibility.createActionProjector(
            {
                ...actionSchemas,
                [ActionType.ShuffleDeck]: ShuffleDeck
            },
            { policies }
        )
    }
} satisfies GameRuntime<HiddenCardState, HydratedHiddenCardState>

function runtimeWithValidActionsForPlayer(
    validActionsForPlayer: MachineStateHandler<
        HydratedAction,
        HydratedHiddenCardState
    >['validActionsForPlayer']
) {
    return {
        ...runtime,
        stateHandlers: {
            ...runtime.stateHandlers,
            [MachineState]: {
                ...runtime.stateHandlers[MachineState],
                validActionsForPlayer
            }
        }
    } satisfies GameRuntime<HiddenCardState, HydratedHiddenCardState>
}

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
        systemVersion: 3,
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
        protectedPrng: { seed: 791946283, invocations: 0 },
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
        revealedCardIds: [],
        knowledge: []
    }
}

function createGame(): Game {
    return {
        id: 'hidden-card-game',
        protectedInformation: true,
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

export function createOpaqueDealScenario() {
    const scenario = createPrivateDealScenario()
    const opaqueDealRuntime = {
        ...runtime,
        visibility: {
            ...visibility,
            actions: Visibility.createActionProjector(
                {
                    ...actionSchemas,
                    [ActionType.DealCards]: Visibility.protectAction(DealCards, {
                        policy: Visibility.Policy.HostOnly
                    })
                },
                { policies }
            )
        }
    } satisfies GameRuntime<HiddenCardState, HydratedHiddenCardState>

    return { ...scenario, runtime: opaqueDealRuntime }
}

export function createSecretRandomnessScenario() {
    const before = createCardState([
        'hidden-card-a',
        'hidden-card-b',
        'hidden-card-c',
        'hidden-card-d',
        'hidden-card-e'
    ])
    const prepareDeck: PrepareDeck = {
        id: 'prepare-secret-deck',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.PrepareDeck,
        playerId: PlayerIds[0]
    }
    const continueAfterShuffle: EndRound = {
        id: 'continue-after-shuffle',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.EndRound,
        playerId: PlayerIds[0],
        targetPlayerId: PlayerIds[1]
    }
    return {
        before,
        continueAfterShuffle,
        game: createGame(),
        prepareDeck,
        publicShuffleRuntime,
        runtime
    }
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

export function createPrivateTransferScenario() {
    const before = createCardState(['stock-card'])
    before.phase = 'playing'
    before.hands = [
        { playerId: PlayerIds[0], cards: ['actor-card'], cardCount: 1 },
        {
            playerId: PlayerIds[1],
            cards: ['transferred-card', 'target-card'],
            cardCount: 2
        },
        { playerId: PlayerIds[2], cards: ['observer-card'], cardCount: 1 },
        { playerId: PlayerIds[3], cards: ['fourth-player-card'], cardCount: 1 }
    ]

    const stealTopCard: StealTopCard = {
        id: 'steal-top-card',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.StealTopCard,
        playerId: PlayerIds[0],
        targetPlayerId: PlayerIds[1],
        revealsInfo: true
    }
    return { before, game: createGame(), runtime, stealTopCard }
}

export function createLegalChoiceScenario() {
    const before = createCardState(['unused-deck-card'])
    before.phase = 'playing'
    before.hands = [
        {
            playerId: PlayerIds[0],
            cards: ['player-1-playable-card', 'player-1-second-card'],
            cardCount: 2
        },
        { playerId: PlayerIds[1], cards: ['player-2-playable-card'], cardCount: 1 },
        { playerId: PlayerIds[2], cards: [], cardCount: 0 },
        { playerId: PlayerIds[3], cards: ['player-4-playable-card'], cardCount: 1 }
    ]

    const legalChoiceRuntime = runtimeWithValidActionsForPlayer((playerId, context) => {
        const hand = context.gameState.hands.find((candidate) => candidate.playerId === playerId)
        assertExists(hand, `Cannot find a hand for Player ${playerId}`)
        return hand.cardCount > 0 ? [ActionType.RevealCard] : []
    })

    const secretDependentRuntime = runtimeWithValidActionsForPlayer((playerId, context) => {
        const opponentHand = context.gameState.hands.find(
            (candidate) => candidate.playerId !== playerId
        )
        assertExists(opponentHand, `Cannot find an opponent hand for Player ${playerId}`)
        return opponentHand.cards[0] === 'player-2-playable-card' ? [ActionType.StealTopCard] : []
    })

    return {
        before,
        game: createGame(),
        runtime: legalChoiceRuntime,
        secretDependentRuntime
    }
}

export function createProgressiveTeamRevealScenario() {
    const before = createCardState(['stock-card'])
    before.phase = 'playing'
    before.teamSecret = {
        ownerPlayerId: PlayerIds[0],
        teamPlayerIds: [PlayerIds[0], PlayerIds[1]],
        revealLevel: SecretRevealLevel.Owner,
        value: 'shared-plan'
    }

    const shareWithTeam: AdvanceSecretAudience = {
        id: 'share-secret-with-team',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.AdvanceSecretAudience,
        playerId: PlayerIds[0],
        revealsInfo: true
    }
    const revealPublicly: AdvanceSecretAudience = {
        id: 'reveal-secret-publicly',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.AdvanceSecretAudience,
        playerId: PlayerIds[0],
        revealsInfo: true
    }
    return { before, game: createGame(), revealPublicly, runtime, shareWithTeam }
}

export function createSelectiveRevealScenario() {
    const before = createCardState(['unused-deck-card'])
    before.phase = 'playing'
    before.hands = [
        {
            playerId: PlayerIds[0],
            cards: ['revealed-card', 'permanently-hidden-card'],
            cardCount: 2
        },
        ...PlayerIds.slice(1).map((playerId) => ({ playerId, cards: [], cardCount: 0 }))
    ]

    const revealCard: RevealCard = {
        id: 'reveal-card',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.RevealCard,
        playerId: PlayerIds[0],
        cardId: 'revealed-card',
        revealsInfo: true
    }
    const completeGame: CompleteGame = {
        id: 'complete-game',
        gameId: before.gameId,
        source: ActionSource.User,
        type: ActionType.CompleteGame,
        playerId: PlayerIds[0]
    }
    return { before, completeGame, game: createGame(), revealCard, runtime }
}
