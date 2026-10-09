import {
    placeStockMarker,
    discardableTrains,
    getCompany,
    type TileRotation,
    type TrackLayDetails
} from '@tabletop/18xx'
import { TrainRules1846, trainBuyingChoices1846 } from './trains.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { stockChoices, Market1846 } from './stock.js'
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
    hydrateEighteenFortySixState,
    type HydratedEighteenFortySixState,
    type EighteenFortySixProjectedState
} from './state.js'
import { choicesFor, hiddenDistribution } from './distribution.js'
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
        const hydrated = hydrateEighteenFortySixState(state)
        const choices = choicesFor(hydrated, state.activePlayerIds[0])
        const cardId = blanksFirst
            ? (choices.find(isBlank) ?? choices[0])
            : (choices.find((id) => !isBlank(id)) ?? choices[0])
        assertExists(cardId, 'Draft must have a choice')
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, hiddenDistribution(state).finalOffer ? undefined : cardId)
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
    finishStockRound(): void
}
export function stockGame(): StockTestGame {
    return testTable(finish(3, 7))
}

export function openingGame(count = 2, seed = 7): StockTestGame {
    return testTable(start(count, seed))
}

function testTable({ game, engine, state: initialState }: TestGame): StockTestGame {
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
            return hydrateEighteenFortySixState(state)
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
        finishStockRound() {
            while (state.machineState === 'StockRound') this.finishTurn()
        },
        finishTurn() {
            const result = this.act('FinishStockTurn')
            if (state.machineState !== 'AssigningSteamboat') return result
            const assignment = this.act('AssignSteamboat')
            return {
                ...assignment,
                processedActions: [...result.processedActions, ...assignment.processedActions]
            }
        }
    }
}

export function layTrack(table: StockTestGame, choice: TrackLayDetails): TransactionResult {
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = choice
    return table.act('LayTile', {
        companyId,
        locationId,
        definitionId,
        rotation,
        nodeMapping,
        expectedCost: cost
    })
}

export function setCompanyInReceivership(table: StockTestGame, companyId: string): void {
    const president = table.state.certificates.find(
        (certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.president
    )
    assert(president, 'Receiver must have an active president certificate')
    president.owner = { kind: 'bank' }
    president.poolId = 'open-market'
    delete getCompany(table.state, companyId).president
}

export function emergencyBuyingGame(cash = 10, price = 100) {
    const table = stockGame()
    table.launch('IC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('FinishTrack', { companyId: 'IC' })
    const balance = table.state.cash.find(
        (c) => c.owner.kind === 'company' && c.owner.companyId === 'IC'
    )
    assertExists(balance)
    balance.amount = cash
    const presidentCash = table.state.cash.find(
        (c) => c.owner.kind === 'player' && c.owner.playerId === table.state.activePlayerIds[0]
    )
    assertExists(presidentCash)
    presidentCash.amount = 500
    const space = Market1846.spaces.find((s) => s.price === price)
    assertExists(space)
    placeStockMarker(table.state.stockMarket, 'IC', space.id)
    return table
}

export function phaseIIIReadyGame() {
    const table = stockGame()
    table.launch('IC', 100)
    table.launch('NYC', 100)
    table.finishStockRound()
    table.act('FinishTrack', { companyId: 'MS' })
    table.act('FinishTrack', { companyId: 'BIG4' })
    table.act('FinishTrack', { companyId: 'IC' })
    table.state.phaseId = 'II'
    let twos = 0
    table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) => {
        if (train.status !== 'depot') return train
        if (train.definitionId === '4')
            return { ...train, status: 'owned', owner: { kind: 'company', companyId: 'NYC' } }
        if (train.definitionId === '2')
            return ++twos <= 3
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId: 'IC' } }
                : { ...train, status: 'market' }
        return train
    })
    const cash = table.state.cash.find(
        (balance) => balance.owner.kind === 'company' && balance.owner.companyId === 'IC'
    )
    assertExists(cash)
    cash.amount = 2000
    return table
}
export function buyTrain(
    table: ReturnType<typeof stockGame>,
    definitionId: string,
    trainId?: string
) {
    const choice = trainBuyingChoices1846(table.hydrated)?.offers.find(
        (offer) => offer.definitionId === definitionId && (!trainId || offer.trainId === trainId)
    )
    assertExists(choice)
    const { price, ...request } = choice
    return table.act('BuyTrain', { ...request, expectedPrice: price })
}
export function discardTrain(table: ReturnType<typeof stockGame>) {
    const companyId = table.state.phaseChange?.discardCompanyIds[0]
    assertExists(companyId)
    const train = discardableTrains(table.hydrated, companyId, TrainRules1846)[0]
    assertExists(train)
    const result = table.act('DiscardTrain', { companyId, trainId: train.id })
    return { train, result }
}

export function constructionGame(phaseId: 'III' | 'IV' = 'III') {
    const table = emergencyBuyingGame(2000)
    table.state.phaseId = 'II'
    table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
        train.status === 'depot' && ['2', '4'].includes(train.definitionId)
            ? { ...train, status: 'removed' }
            : train
    )
    buyTrain(table, '5')
    if (phaseId === 'IV') {
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.status === 'depot' && train.definitionId === '5'
                ? { ...train, status: 'removed' }
                : train
        )
        buyTrain(table, '6')
    }
    table.act('FinishOperatingTurn', { companyId: 'IC' })
    assert(table.state.machineState === 'LayingTrack' && table.state.phaseId === phaseId)
    return table
}
export function installTile(
    table: StockTestGame,
    locationId: string,
    definitionId: string,
    rotation: TileRotation = 0
) {
    const piece = EighteenFortySixTileSet.availablePieces(
        table.state.tileInventory,
        definitionId
    )[0]
    assertExists(piece)
    table.state.tileInventory = EighteenFortySixTileSet.replace(table.state.tileInventory, {
        locationId,
        placement: { pieceId: piece.id, definitionId, rotation },
        returnPrevious: true
    })
    return piece.id
}
export function relocateStation(
    table: StockTestGame,
    companyId: string,
    locationId: string,
    nodeId = 'city'
) {
    const station = table.state.stations.find(
        (station) => station.companyId === companyId && station.status === 'placed'
    )
    assert(station?.status === 'placed')
    station.position = { locationId, nodeId, slot: 0 }
}
