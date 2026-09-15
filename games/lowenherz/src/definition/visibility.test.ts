import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assert,
    GameEngine,
    GameStatus,
    PlayerStatus,
    Visibility,
    getPrng,
    type Game,
    type GameAction
} from '@tabletop/common'
import { LowenherzRuntime } from './runtime.js'
import { LowenherzActionSchemas } from './actionSchemas.js'
import {
    LowenherzGameStateValidator,
    type LowenherzGameState,
    type LowenherzProjectedState
} from '../model/gameState.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { ActionCardType, CardBack } from './actionCards.js'
import {
    PoliticsCardDeck,
    PoliticsCardType,
    samePoliticsCard,
    type PoliticsCard
} from './politicsCards.js'
import type { LookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import type { TakePoliticsCard } from '../actions/takePoliticsCard.js'
import type { SubmitDuelBid } from '../actions/submitDuelBid.js'
import { populatePoliticsCards } from '../util/politicsExploration.js'
import { negotiationProposalIsValid } from '../util/legality.js'
import { HydratedNegotiationMove, NegotiationMoveKind, type NegotiationMove } from '../actions/negotiationMove.js'

const game: Game = {
    id: 'privacy',
    typeId: 'lowenherz',
    name: 'Privacy',
    ownerId: 'p1',
    status: GameStatus.Started,
    deleted: false,
    isPublic: false,
    hotseat: false,
    createdAt: new Date(0),
    winningPlayerIds: [],
    seed: 19,
    players: ['p1', 'p2', 'p3'].map((id) => ({
        id,
        name: id,
        isHuman: true,
        status: PlayerStatus.Joined
    })),
    config: { playerPlacedCastles: false }
}
const engine = new GameEngine(LowenherzRuntime)
const owner = { kind: 'player', playerId: 'p1' } as const
const other = { kind: 'player', playerId: 'p2' } as const
const spectator = { kind: 'spectator' } as const
function canonical(state: LowenherzProjectedState): LowenherzGameState {
    assert(LowenherzGameStateValidator.Check(state))
    return state
}
function initialize(version = 3, seed = 31, configuredGame = game) {
    const state = new GameEngine({
        ...LowenherzRuntime,
        randomnessVersion: undefined
    }).generateUninitializedState(game)
    state.id = 'state'
    state.systemVersion = version
    if (version >= 3) state.protectedPrng = { seed, invocations: 0 }
    else delete state.protectedPrng
    return canonical(LowenherzRuntime.initializer.initializeGameState(configuredGame, state).dehydrate())
}
function execute(state: LowenherzGameState, action: GameAction) {
    const result = engine.executeCanonicalAction({ state, action, game })
    return { ...result, updatedState: canonical(result.updatedState) }
}
function inspect(state: LowenherzGameState, playerId = 'p1', pile: 'A' | 'B' = 'A') {
    state.machineState = MachineState.TakingPoliticsCard
    state.activePlayerIds = [playerId]
    state.politicsTakingPlayerId = playerId
    state.openedPoliticsPile = undefined
    state.currentActionCard = {
        id: 'fixture',
        type: ActionCardType.Standard,
        back: CardBack.B,
        top: { kind: 'politics' },
        middle: { kind: 'knight', count: 1 },
        bottom: { kind: 'knight', count: 1 }
    }
    state.resolvedSlots = [{ slot: 1, winnerPlayerId: playerId }]
    const action: LookAtPoliticsPile = {
        id: `look-${state.actionCount}`,
        gameId: game.id,
        source: ActionSource.User,
        type: ActionType.LookAtPoliticsPile,
        playerId,
        pile,
        revealsInfo: true
    }
    return execute(state, action)
}
function take(state: LowenherzGameState, card: PoliticsCard) {
    const action: TakePoliticsCard = {
        id: `take-${state.actionCount}`,
        gameId: game.id,
        source: ActionSource.User,
        type: ActionType.TakePoliticsCard,
        playerId: state.politicsTakingPlayerId!,
        pile: state.openedPoliticsPile!,
        card
    }
    return execute(state, action)
}
function view(state: LowenherzGameState, perspective: Visibility.Perspective = owner) {
    return LowenherzRuntime.visibility.state.project(state, perspective, { config: game.config })
}
function sorted(cards: PoliticsCard[]) {
    return cards.map((card) => `${card.type}:${card.value ?? ''}`).sort()
}

describe('Lowenherz privacy', () => {
    it('reproduces canonical setup from a master seed and conceals it in projections', () => {
        const masterSeed = '0123456789abcdef0123456789abcdef'
        const initialize = () => {
            const state = engine.generateUninitializedState(game, masterSeed)
            state.id = 'reproduction-state'
            return LowenherzRuntime.initializer.initializeGameState(game, state).dehydrate()
        }
        const first = initialize()
        expect(initialize()).toEqual(first)
        assert(LowenherzGameStateValidator.Check(first), 'Expected canonical seeded state')
        expect(first.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
        expect(
            LowenherzRuntime.visibility.state.project(first, { kind: 'spectator' }, { config: game.config })
        ).not.toHaveProperty('masterSeed')
    })

    it('registers every Action and separates protected initialization from public setup', () => {
        expect(Object.keys(LowenherzActionSchemas).sort()).toEqual(Object.values(ActionType).sort())
        const first = initialize(3, 1),
            second = initialize(3, 91)
        expect(first.board).toEqual(second.board)
        expect(first.prng).toEqual(second.prng)
        expect(first.actionDeck).not.toEqual(second.actionDeck)
        expect(first.protectedPrng?.invocations).toBeGreaterThan(0)
        const projected = view(first)
        expect(projected.actionDeck).toBeUndefined()
        expect(projected.politicsCardPileA).toBeUndefined()
        expect(
            projected.players.find((player) => player.playerId === 'p2')?.politicsCards
        ).toBeUndefined()
        expect(projected.actionDeckBacks).toEqual(first.actionDeck.map((card) => card.back))
        expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
        expect(LowenherzGameStateValidator.Check(projected)).toBe(false)
        expect(() => LowenherzRuntime.hydrator.hydrateState(projected)).not.toThrow()
    })
    it.each([1, 2])('keeps legacy version %i playable without protected entropy', (version) => {
        const state = initialize(version)
        expect(state.protectedPrng).toBeUndefined()
        expect(state.privateInformation).toBeUndefined()
        const sample = LowenherzRuntime.exploration.createFromProjectedState({
            game,
            state,
            actions: [],
            perspective: owner,
            random: getPrng(4)
        })
        expect(LowenherzGameStateValidator.Check(sample)).toBe(true)
        expect(sample.systemVersion).toBe(version)

        const result = inspect(state)
        expect(result.updatedState.systemVersion).toBe(version)
        expect(
            take(result.updatedState, result.updatedState.politicsCardPileA[0]).updatedState
                .systemVersion
        ).toBe(version)
    })
    it('normalizes legacy current saves before projecting their private fields', () => {
        const { updatedState: state } = inspect(initialize(2))
        delete state.actionDeckBacks
        delete state.politicsPileACount
        delete state.politicsPileBCount
        for (const player of state.players) {
            delete player.politicsCardCount
            delete player.politicsInspection
        }
        const original = structuredClone(state)
        const projected = view(state)
        expect(projected.actionDeckBacks).toEqual(state.actionDeck.map((card) => card.back))
        expect(projected.politicsPileACount).toBe(state.politicsCardPileA.length)
        expect(projected.players.every((player) => player.politicsCardCount === 0)).toBe(true)
        expect(
            projected.players.find((player) => player.playerId === 'p1')?.politicsInspection?.cards
        ).toEqual(state.politicsCardPileA)
        expect(
            view(state, other).players.every((player) => player.politicsInspection === undefined)
        ).toBe(true)
        expect(
            engine.getValidActionTypesForPlayer(game, projected, 'p1', { perspective: owner })
        ).toContain(ActionType.TakePoliticsCard)
        expect(() => take(state, state.politicsCardPileA[0])).not.toThrow()
        expect(state).toEqual(original)
    })
    it('exposes inspections only to the inspector, with safe history patches and legal discovery', () => {
        const result = inspect(initialize())
        const history = Visibility.projectActionHistory({
            currentState: result.updatedState,
            actions: result.processedActions,
            visibility: LowenherzRuntime.visibility,
            perspective: other,
            replay: { game, runtime: LowenherzRuntime }
        })
        expect(
            history.currentState.players.every((player) => player.politicsInspection === undefined)
        ).toBe(true)
        expect(JSON.stringify(history.actions)).not.toContain('"cards"')
        expect(JSON.stringify(history.actions)).not.toContain('politicsCardPileA')
        const projected = view(result.updatedState)
        expect(
            projected.players.find((player) => player.playerId === 'p1')?.politicsInspection?.cards
        ).toEqual(result.updatedState.politicsCardPileA)
        expect(
            engine.getValidActionTypesForPlayer(game, projected, 'p1', { perspective: owner })
        ).toContain(ActionType.TakePoliticsCard)
        const taken = take(result.updatedState, result.updatedState.politicsCardPileA[0])
        expect(
            LowenherzRuntime.visibility.actions.project(taken.processedActions[0], other)
        ).not.toHaveProperty('card')
        expect(
            view(taken.updatedState).players.find((player) => player.playerId === 'p1')
                ?.politicsInspection
        ).toBeUndefined()
        const restored = canonical(
            engine.undoProcessedAction({
                state: taken.updatedState,
                action: taken.processedActions[0]
            })
        )
        expect(
            restored.players.find((player) => player.playerId === 'p1')?.politicsInspection?.cards
        ).toEqual(result.updatedState.politicsCardPileA)
    })
    it('seals submissions and publishes all bids at resolution, retaining losing treasure', () => {
        let state = initialize()
        state.machineState = MachineState.Dueling
        state.activePlayerIds = ['p1', 'p2']
        state.duel = { slot: 1, playerIds: ['p1', 'p2'], bids: [], tieCount: 0 }
        state.currentActionCard = {
            id: 'fixture',
            type: ActionCardType.Standard,
            back: CardBack.B,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 1 }
        }
        const p1 = state.players.find((player) => player.playerId === 'p1')!
        p1.politicsCards = [{ type: PoliticsCardType.Treasure, value: 8 }]
        p1.politicsCardCount = 1
        const bid: SubmitDuelBid = {
            id: 'bid1',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId: 'p1',
            amount: 0,
            treasureValues: [8]
        }
        const first = execute(state, bid)
        state = first.updatedState
        const hidden = LowenherzRuntime.visibility.actions.project(first.processedActions[0], other)
        expect(hidden).not.toHaveProperty('amount')
        expect(hidden).not.toHaveProperty('treasureValues')
        expect(view(state, other).duel?.bids).toEqual([{ playerId: 'p1' }])
        const finalBid: SubmitDuelBid = {
            ...bid,
            id: 'bid2',
            playerId: 'p2',
            amount: 12,
            treasureValues: []
        }
        const last = execute(state, finalBid)
        const publicLast = LowenherzRuntime.visibility.actions.project(
            last.processedActions[0],
            spectator
        )
        expect(publicLast).toMatchObject({
            metadata: {
                roundResult: {
                    bids: [
                        { playerId: 'p1', amount: 0, treasureValues: [8] },
                        { playerId: 'p2', amount: 12, treasureValues: [] }
                    ]
                }
            }
        })
        expect(
            last.updatedState.players.find((player) => player.playerId === 'p1')?.politicsCards
        ).toEqual(p1.politicsCards)
    })
    it('reveals complete action cards and prevents drawing optimistically through a hidden deck', () => {
        const state = initialize()
        state.activePlayerIds = [state.firstPlayerId]
        const action = {
            id: 'draw',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.DrawActionCard,
            playerId: state.firstPlayerId
        }
        expect(
            engine.getValidActionTypesForPlayer(
                game,
                view(state, { kind: 'player', playerId: state.firstPlayerId }),
                state.firstPlayerId,
                { perspective: { kind: 'player', playerId: state.firstPlayerId } }
            )
        ).toContain(ActionType.DrawActionCard)
        const result = execute(state, action)
        expect(result.processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { card: state.actionDeck[0] }
        })
        const projected = LowenherzRuntime.visibility.state.project(result.updatedState, spectator, { config: game.config })
        const sample = LowenherzRuntime.exploration.createFromProjectedState({
            game,
            state: projected,
            actions: result.processedActions,
            perspective: spectator,
            random: getPrng(18)
        })
        expect(sample.actionDeck.some((card) => card.id === state.actionDeck[0].id)).toBe(false)
        expect(sample.actionDeck.map((card) => card.back)).toEqual(projected.actionDeckBacks)
    })
})

describe('Lowenherz hypothetical politics', () => {
    it('preserves prior inspection contents and known hand without learning a later hidden removal', () => {
        let result = inspect(initialize())
        let state = result.updatedState
        const observed = structuredClone(state.politicsCardPileA)
        const actions = [...result.processedActions]
        result = take(state, observed[0])
        state = result.updatedState
        actions.push(...result.processedActions)
        result = inspect(state, 'p2')
        state = result.updatedState
        actions.push(...result.processedActions)
        result = take(state, state.politicsCardPileA[0])
        state = result.updatedState
        actions.push(...result.processedActions)
        const projected = view(state)
        const history = actions.map((action) =>
            LowenherzRuntime.visibility.actions.project(action, owner)
        )
        const samples = new Set<string>()
        for (let seed = 0; seed < 20; seed++) {
            const sample = LowenherzRuntime.exploration.createFromProjectedState({
                game,
                state: projected,
                actions: history,
                perspective: owner,
                random: getPrng(seed)
            })
            const p1 = sample.players.find((player) => player.playerId === 'p1')!
            const p2 = sample.players.find((player) => player.playerId === 'p2')!
            expect(p1.politicsCards).toEqual([observed[0]])
            expect(
                sorted([...sample.politicsCardPileA, ...p1.politicsCards, ...p2.politicsCards])
            ).toEqual(sorted(observed))
            expect(
                sorted([
                    ...sample.politicsCardPileA,
                    ...sample.politicsCardPileB,
                    ...sample.players.flatMap((player) => player.politicsCards)
                ])
            ).toEqual(sorted(PoliticsCardDeck))
            samples.add(JSON.stringify(p2.politicsCards))
        }
        expect(samples.size).toBeGreaterThan(1)
        const before = structuredClone(projected)
        populatePoliticsCards(projected, history, getPrng(33))
        expect(projected).toEqual(before)
        result = inspect(state)
        state = result.updatedState
        actions.push(...result.processedActions)
        const secondHistory = actions.map((action) =>
            LowenherzRuntime.visibility.actions.project(action, owner)
        )
        const sample = populatePoliticsCards(view(state), secondHistory, getPrng(33))
        expect(sorted(sample.politicsCardPileA)).toEqual(sorted(state.politicsCardPileA))
        expect(sample.hands.get('p2')).toEqual(
            state.players.find((player) => player.playerId === 'p2')?.politicsCards
        )
    })
    it('retains publicly revealed losing treasure and samples only submitted hidden bids', () => {
        let state = initialize()
        const treasure = { type: PoliticsCardType.Treasure, value: 8 }
        const pile = state.politicsCardPileA.some((card) => samePoliticsCard(card, treasure))
            ? 'A'
            : 'B'
        let result = inspect(state, 'p2', pile)
        const actions = [...result.processedActions]
        result = take(result.updatedState, treasure)
        actions.push(...result.processedActions)
        state = result.updatedState
        const reveal: SubmitDuelBid = {
            id: 'reveal',
            gameId: game.id,
            index: actions.length,
            source: ActionSource.User,
            type: ActionType.SubmitDuelBid,
            playerId: 'p1',
            amount: 12,
            metadata: {
                duelResult: 'win',
                winnerId: 'p1',
                roundResult: {
                    slot: 1,
                    bids: [
                        { playerId: 'p2', amount: 0, treasureValues: [8] },
                        { playerId: 'p1', amount: 12, treasureValues: [] }
                    ]
                }
            }
        }
        actions.push(reveal)
        state.actionCount = actions.length
        state.duel = {
            slot: 2,
            playerIds: ['p1', 'p2', 'p3'],
            tieCount: 0,
            bids: [
                { playerId: 'p1', amount: 0 },
                { playerId: 'p2', amount: 1, treasureValues: [8] }
            ]
        }
        const history = actions.map((action) =>
            LowenherzRuntime.visibility.actions.project(action, owner)
        )
        const projected = view(state)
        for (let seed = 0; seed < 10; seed++) {
            const sample = LowenherzRuntime.exploration.createFromProjectedState({
                game,
                state: projected,
                actions: history,
                perspective: owner,
                random: getPrng(seed)
            })
            expect(
                sample.players.find((player) => player.playerId === 'p2')?.politicsCards
            ).toEqual([treasure])
            expect(sample.duel?.bids).toHaveLength(2)
            expect(sample.duel?.bids[0]).toEqual({ playerId: 'p1', amount: 0, treasureValues: [] })
            expect(sample.duel?.bids[1].amount).toBeGreaterThanOrEqual(0)
            expect(sample.duel?.bids[1].treasureValues?.every((value) => value === 8)).toBe(true)
        }
        state.finalHands = state.players.map((player) => ({
            playerId: player.playerId,
            cards: player.politicsCards
        }))
        expect(view(state, spectator).finalHands).toEqual(state.finalHands)
    })
    it('requires the selected source prefix and never fills missing private observations from real piles', () => {
        const result = inspect(initialize())
        const projected = view(result.updatedState)
        expect(() =>
            LowenherzRuntime.exploration.createFromProjectedState({
                game,
                state: projected,
                actions: [],
                perspective: owner,
                random: getPrng(1)
            })
        ).toThrow(/complete permitted history/)
        const hiddenHistory = result.processedActions.map((action) =>
            LowenherzRuntime.visibility.actions.project(action, spectator)
        )
        expect(() =>
            LowenherzRuntime.exploration.createFromProjectedState({
                game,
                state: projected,
                actions: hiddenHistory,
                perspective: owner,
                random: getPrng(1)
            })
        ).toThrow(/prior inspection records/)
    })
    it('rejects contradictory observations instead of relaxing them', () => {
        const result = inspect(initialize())
        const projected = view(result.updatedState)
        const hand = projected.players.find((player) => player.playerId === 'p1')!
        hand.politicsInspection!.cards = Array.from(
            { length: hand.politicsInspection!.cards.length },
            () => ({ type: PoliticsCardType.Alliance })
        )
        expect(() =>
            populatePoliticsCards(projected, result.processedActions, getPrng(33))
        ).toThrow(/No hypothetical/)
    })
})

describe('Lowenherz private money', () => {
    const privateGame = { ...game, config: { ...game.config, publicMoney: false } }
    const context = { config: privateGame.config }

    it.each([1, 2, 3])(
        'keeps unmarked legacy version %i negotiation on complete-state delivery',
        (version) => {
            const state = initialize(version, 31, privateGame)
            delete state.publicMoney
            state.machineState = MachineState.Negotiating
            state.negotiation = { slot: 1, playerIds: ['p1', 'p2'] }
            state.activePlayerIds = ['p1', 'p2']
            const legacyGame = { ...privateGame, state }
            expect(legacyGame).not.toHaveProperty('protectedInformation')

            const visibility = Visibility.getGameVisibility(legacyGame, LowenherzRuntime)
            expect(visibility).toBeUndefined()
            const delivered = visibility
                ? visibility.state.project(state, owner, context)
                : state
            assert(LowenherzGameStateValidator.Check(delivered), 'Legacy delivery must be complete')
            const hydrated = LowenherzRuntime.hydrator.hydrateState(delivered)
            expect(hydrated.getPlayerState('p2').getMoney()).toBe(12)
            expect(negotiationProposalIsValid(hydrated, 'p1', 'p2', 4)).toBe(true)
            expect(negotiationProposalIsValid(hydrated, 'p1', 'p2', 20)).toBe(false)

            const demand: NegotiationMove = {
                id: 'legacy-demand',
                gameId: game.id,
                source: ActionSource.User,
                type: ActionType.NegotiationMove,
                playerId: 'p1',
                kind: NegotiationMoveKind.Propose,
                fromPlayerId: 'p2',
                amount: 4
            }
            const result = engine.executeAction({
                game: legacyGame,
                state: delivered,
                action: demand
            })
            expect(result.updatedState.negotiation?.offer).toEqual({
                fromPlayerId: 'p2',
                amount: 4
            })
            expect(result.updatedState.systemVersion).toBe(version)
            expect(result.updatedState).not.toHaveProperty('publicMoney')
        }
    )

    it.each([owner, other, spectator])(
        'omits other balances for %j and reveals final balances',
        (perspective) => {
            const state = initialize(3, 31, privateGame)
            expect(state.publicMoney).toBe(false)
            const projected = LowenherzRuntime.visibility.state.project(state, perspective, context)
            for (const player of projected.players) {
                if (perspective.kind === 'player' && player.playerId === perspective.playerId) {
                    expect(player.money).toBe(12)
                } else {
                    expect(player).not.toHaveProperty('money')
                }
            }
            expect(() => LowenherzRuntime.hydrator.hydrateState(projected)).not.toThrow()
            state.machineState = MachineState.EndOfGame
            expect(
                LowenherzRuntime.visibility.state
                    .project(state, spectator, context)
                    .players.map((player) => player.money)
            ).toEqual([12, 12, 12])
        }
    )

    const publicConfigs: Game['config'][] = [{}, { publicMoney: true }]
    it.each(publicConfigs)('keeps money public with config %j', (config) => {
        const projected = LowenherzRuntime.visibility.state.project(initialize(), spectator, {
            config
        })
        expect(projected.players.map((player) => player.money)).toEqual([12, 12, 12])
    })

    it('guards private balances while permitting the owner and public-money execution', () => {
        const state = initialize(3, 31, privateGame)
        const projected = LowenherzRuntime.visibility.state.project(state, owner, context)
        const guarded = LowenherzRuntime.visibility.state.guardForExecution(
            LowenherzRuntime.hydrator.hydrateState(projected),
            owner,
            context
        )
        expect(guarded.getPlayerState('p1').getMoney()).toBe(12)
        expect(() => guarded.getPlayerState('p2').getMoney()).toThrow(/protected value/)
        const publicState = LowenherzRuntime.visibility.state.project(state, owner, {
            config: { publicMoney: true }
        })
        const publicGuard = LowenherzRuntime.visibility.state.guardForExecution(
            LowenherzRuntime.hydrator.hydrateState(publicState),
            owner,
            { config: { publicMoney: true } }
        )
        expect(publicGuard.getPlayerState('p2').getMoney()).toBe(12)
    })

    it.each([1, 2, 3])(
        'blocks projected exploration with private money in version %i',
        (version) => {
            const state = initialize(version, 31, privateGame)
            expect(() =>
                LowenherzRuntime.exploration.createFromProjectedState({
                    game: privateGame,
                    state,
                    actions: [],
                    perspective: owner,
                    random: getPrng(1)
                })
            ).toThrow(/private money/)
        }
    )

    it.each([1, 2, 3])('allows canonical exploration with private money in version %i', (version) => {
        const state = initialize(version, 31, privateGame)
        const exploration = LowenherzRuntime.exploration.createFromCanonicalState(state)
        expect(LowenherzGameStateValidator.Check(exploration)).toBe(true)
        expect(exploration.publicMoney).toBe(state.publicMoney)
        expect(exploration.players.map((player) => player.money)).toEqual(
            state.players.map((player) => player.money)
        )
        expect(exploration.actionDeck?.map((card) => card.id).sort()).toEqual(
            state.actionDeck.map((card) => card.id).sort()
        )
    })

    it('preserves the private-money restriction for projected exploration in state', () => {
        const state = initialize(3, 31, privateGame)
        expect(() =>
            LowenherzRuntime.exploration.createFromProjectedState({
                game,
                state,
                actions: [],
                perspective: owner,
                random: getPrng(1)
            })
        ).toThrow(/private money/)
    })

    it('accepts demands independently of the other balance but rejects unaffordable commitments', () => {
        const state = initialize(3, 31, privateGame)
        state.machineState = MachineState.Negotiating
        state.negotiation = { slot: 1, playerIds: ['p1', 'p2'] }
        state.activePlayerIds = ['p1', 'p2']
        const demand = new HydratedNegotiationMove({
            id: 'demand',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.NegotiationMove,
            playerId: 'p1',
            kind: NegotiationMoveKind.Propose,
            fromPlayerId: 'p2',
            amount: 20
        })
        const hydrated = LowenherzRuntime.hydrator.hydrateState(state)
        const projected = LowenherzRuntime.visibility.state.project(state, owner, context)
        const guarded = LowenherzRuntime.visibility.state.guardForExecution(
            LowenherzRuntime.hydrator.hydrateState(projected),
            owner,
            context
        )
        expect(demand.isValidNegotiationMove(guarded)).toBe(true)
        demand.apply(hydrated)
        const accept = new HydratedNegotiationMove({
            ...demand.dehydrate(),
            id: 'accept',
            playerId: 'p2'
        })
        expect(accept.isValidNegotiationMove(hydrated)).toBe(false)
        expect(() => accept.apply(hydrated)).toThrow(/Invalid NegotiationMove/)
        hydrated.getPlayerState('p2').money = 25
        accept.apply(hydrated)
        expect(hydrated.getPlayerState('p2').getMoney()).toBe(5)
        expect(hydrated.getPlayerState('p1').getMoney()).toBe(32)
    })

    it('projects payment history and Undo without disclosing balances', () => {
        const state = initialize(3, 31, privateGame)
        state.machineState = MachineState.Negotiating
        state.activePlayerIds = ['p1']
        state.currentActionCard = {
            id: 'negotiated',
            type: ActionCardType.Standard,
            back: CardBack.B,
            top: { kind: 'politics' },
            middle: { kind: 'knight', count: 1 },
            bottom: { kind: 'knight', count: 1 }
        }
        state.negotiation = {
            slot: 1,
            playerIds: ['p1', 'p2'],
            lastProposedBy: 'p2',
            offer: { fromPlayerId: 'p2', amount: 4 }
        }
        const action: NegotiationMove = {
            id: 'accept',
            gameId: game.id,
            source: ActionSource.User,
            type: ActionType.NegotiationMove,
            playerId: 'p1',
            kind: NegotiationMoveKind.Propose,
            fromPlayerId: 'p2',
            amount: 4
        }
        const result = engine.executeCanonicalAction({ game: privateGame, state, action })
        const history = Visibility.projectActionHistory({
            currentState: result.updatedState,
            actions: result.processedActions,
            game: privateGame,
            visibility: LowenherzRuntime.visibility,
            perspective: spectator,
            replay: { game: privateGame, runtime: LowenherzRuntime }
        })
        expect(JSON.stringify(history)).not.toContain('"money"')
        expect(JSON.stringify(history.actions)).not.toContain('/money')
        expect(history.actions[0]).toMatchObject({ metadata: { executedOffer: { amount: 4 } } })
    })
})
