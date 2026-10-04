import { stockChoices } from './stock.js'
import {
    GameEngine,
    PlayerStatus,
    ActionSource,
    assert,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { Runtime, Definition } from './definition/gameDefinition.js'
import {
    CanonicalValidator,
    HydratedEighteenFortySixState,
    type EighteenFortySixProjectedState
} from './state.js'
import { choicesFor } from './distribution.js'
import { isBlank } from './catalog.js'
type TestGame = {
    game: Game
    state: EighteenFortySixProjectedState
    engine: GameEngine<EighteenFortySixProjectedState, HydratedEighteenFortySixState>
}
export function start(count = 3, seed = 7): TestGame {
    const engine = new GameEngine(Runtime)
    const game = Runtime.initializer.initializeGame(
        {
            id: '1846-test',
            typeId: '1846',
            ownerId: 'p1',
            seed,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index + 1}`,
                userId: `p${index + 1}`,
                name: `Player ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(
        game,
        seed.toString(16).padStart(32, '0')
    )
    return { game: startedGame, state: initialState, engine }
}
export function action(state: EighteenFortySixProjectedState, cardId?: string): GameAction {
    return {
        id: `action:${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        playerId: state.activePlayerIds[0],
        type: cardId === undefined ? 'PassFinalCompany' : 'ChooseDraftCard',
        revealsInfo: true,
        ...(cardId === undefined ? {} : { cardId })
    }
}
export function finish(
    count: number,
    seed: number,
    blanksFirst = false
): TestGame & {
    initialState: EighteenFortySixProjectedState
    actions: GameAction[]
} {
    const { game, engine, state: initialState } = start(count, seed)
    let state = initialState
    const actions: GameAction[] = []
    for (let turn = 0; turn < 100 && state.machineState !== 'StockRound'; turn++) {
        const hydrated = new HydratedEighteenFortySixState(state)
        const choices = choicesFor(hydrated, state.activePlayerIds[0])
        const cardId = blanksFirst
            ? (choices.find(isBlank) ?? choices[0])
            : (choices.find((id) => !isBlank(id)) ?? choices[0])
        assertExists(cardId, 'Draft must have a choice')
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, state.draft.finalOffer ? undefined : cardId)
        })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    assert(state.machineState === 'StockRound', 'The distribution must finish')
    return { game, engine, initialState, state, actions }
}

type TransactionResult = ReturnType<TestGame['engine']['executeCanonicalAction']>
type StockTestGame = TestGame & {
    initialState: EighteenFortySixProjectedState
    actions: GameAction[]
    hydrated: HydratedEighteenFortySixState
    choices(): ReturnType<typeof stockChoices>
    act(type: string, fields?: object): TransactionResult
    launch(companyId?: string, price?: number): TransactionResult
    buy(companyId: string, source?: string): TransactionResult
    finishTurn(): TransactionResult
}
export function stockGame(): StockTestGame {
    const { game, engine, state: initialState } = finish(3, 7)
    let state = initialState
    const actions: GameAction[] = []
    return {
        game,
        engine,
        initialState,
        actions,
        get state() {
            return state
        },
        get hydrated() {
            return new HydratedEighteenFortySixState(state)
        },
        choices() {
            return stockChoices(this.hydrated, state.activePlayerIds[0])
        },
        act(type: string, fields: object = {}) {
            const action: GameAction = {
                id: `stock:${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: state.activePlayerIds[0],
                type,
                ...fields
            }
            const result = engine.executeCanonicalAction({ game, state, action })
            state = result.updatedState
            actions.push(...result.processedActions)
            assert(CanonicalValidator.Check(state), 'Canonical state must remain valid')
            return result
        },
        launch(companyId = 'IC', price = 40) {
            const choice = this.choices().starts.find(
                (choice) => choice.companyId === companyId && choice.expectedPrice === price * 2
            )
            assertExists(choice, 'Launch must be legal')
            return this.act('StartCompany', choice)
        },
        buy(companyId: string, source = 'company') {
            const choice = this.choices().buys.find(
                (choice) => choice.companyId === companyId && choice.source === source
            )
            assertExists(choice, 'Purchase must be legal')
            const { companyId: _companyId, source: _source, ...fields } = choice
            return this.act('BuyShares', fields)
        },
        finishTurn() {
            return this.act('FinishStockTurn')
        }
    }
}
