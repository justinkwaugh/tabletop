// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, PlayerStatus, assertExists } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { StationPlacement, TrackConstruction, TrainPurchase } from '@tabletop/18xx'
import {
    Definition,
    Market1833NE,
    Privates1833NE,
    StationRules1833NE,
    TileSet1833NE,
    TrackRules1833NE,
    TrainRules1833NE
} from '@tabletop/1833ne'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const SEED = 7
const runtime = Definition.runtime

function start() {
    const engine = new GameEngine(runtime)
    const prepared = runtime.initializer.initializeGame(
        {
            id: '1833ne-scenario',
            typeId: '1833ne',
            ownerId: 'p1',
            seed: SEED,
            players: Array.from({ length: 4 }, (_, index) => ({
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
        prepared,
        SEED.toString(16).padStart(32, '0')
    )
    return { engine, game: startedGame, state: initialState }
}

function play(position, type, fields = {}) {
    const result = position.engine.executeCanonicalAction({
        game: position.game,
        state: position.state,
        action: {
            id: `prepare:${position.state.actionCount}`,
            gameId: position.game.id,
            type,
            source: ActionSource.User,
            playerId: position.state.activePlayerIds[0],
            ...fields
        }
    })
    position.state = result.updatedState
}

const hydrated = (position) => runtime.hydrator.hydrateState(position.state)

function exits(definitionId, rotation) {
    const definition = TileSet1833NE.definitions.find((entry) => entry.id === definitionId)
    return [
        ...new Set(
            definition.face.paths.flatMap((path) =>
                path.endpoints.flatMap((end) =>
                    end.kind === 'edge' ? [(end.edge + rotation) % 6] : []
                )
            )
        )
    ]
        .sort()
        .join()
}

function lay(position, locationId, definitionId, edges) {
    const choice = new TrackConstruction(hydrated(position), TrackRules1833NE)
        .choices(locationId)
        .find(
            (entry) =>
                entry.definitionId === definitionId &&
                exits(definitionId, entry.rotation) === [...edges].sort().join()
        )
    assertExists(choice, `${definitionId} fits ${locationId}`)
    play(position, 'LayTile', {
        companyId: choice.companyId,
        locationId,
        definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
}

function station(position, locationId) {
    const companyId = position.state.stationStep?.companyId
    const piece = position.state.stations.find(
        (entry) => entry.companyId === companyId && entry.status === 'available'
    )
    const choice = new StationPlacement(hydrated(position), StationRules1833NE)
        .choices(piece.id)
        .find((entry) => entry.position.locationId === locationId)
    assertExists(choice, `A station fits ${locationId}`)
    const { cost, ...request } = choice
    play(position, 'PlaceStation', { ...request, expectedCost: cost })
}

function buyTrain(position, definitionId) {
    const offer = new TrainPurchase(hydrated(position), TrainRules1833NE)
        .offers()
        .map((entry) => entry.evaluation.details)
        .find((details) => details?.definitionId === definitionId)
    assertExists(offer, `A ${definitionId} is offered`)
    play(position, 'BuyTrain', {
        companyId: offer.companyId,
        trainId: offer.trainId,
        definitionId,
        expectedPrice: offer.price
    })
}

function finishTurn(position, companyId) {
    if (position.state.machineState === 'BuyingTrains')
        play(position, 'FinishOperatingTurn', { companyId })
}

function launch(position, companyId, price) {
    const space = Market1833NE.spaces.find((entry) => entry.price === price)
    play(position, 'StartCompany', {
        buyer: { kind: 'player', playerId: position.state.activePlayerIds[0] },
        companyId,
        marketSpaceId: space.id,
        expectedPrice: price * 2
    })
}

/** The privates sold at face, B&W and B&P launched at $150, the stock round passed. */
function firstOperatingRound() {
    const position = start()
    for (const company of Privates1833NE)
        play(position, 'BuyAuctionLot', { lotId: company.id, expectedPrice: company.faceValue })
    launch(position, 'B&W', 150)
    launch(position, 'B&P', 150)
    while (position.state.machineState === 'StockRound') play(position, 'FinishStockTurn')
    return position
}

/** Rulebook p. 8's OR1: the B&W reaches Worcester, the B&P buys the Stonington ferry. */
function secondOperatingRound() {
    const position = firstOperatingRound()
    lay(position, 'F23', '18xx:58', [2, 4])
    lay(position, 'E22', '18xx:5', [5, 0])
    station(position, 'E22')
    play(position, 'FinishTrack', { companyId: 'B&W' })
    buyTrain(position, '2')
    buyTrain(position, '2+1')
    finishTurn(position, 'B&W')
    lay(position, 'G24', '18xx:58', [1, 3])
    lay(position, 'F27', '18xx:3', [2, 3])
    play(position, 'BuyFerry', { companyId: 'B&P', locationId: 'F27' })
    play(position, 'FinishTrack', { companyId: 'B&P' })
    buyTrain(position, '2')
    buyTrain(position, '2+1')
    finishTurn(position, 'B&P')
    return position
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

mkdirSync(OUT, { recursive: true })
write('first-operating-round', 'First operating round', firstOperatingRound())
write('ferries-in-the-second-round', 'Ferries in the second round', secondOperatingRound())
