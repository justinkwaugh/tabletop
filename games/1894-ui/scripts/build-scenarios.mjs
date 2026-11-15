// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, PlayerStatus, assert } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { Definition, EighteenNinetyFourMarket, EighteenNinetyFourTileSet } from '@tabletop/1894'
import { EighteenNinetyFourScenarios } from '@tabletop/1894/scenarios'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const SEED = 7
const NordSeed = 12

function gameData(config, seed = SEED) {
    return {
        id: '1894-scenario',
        typeId: '1894',
        ownerId: 'p1',
        seed,
        config,
        players: Array.from({ length: 3 }, (_, index) => ({
            id: `p${index + 1}`,
            userId: `p${index + 1}`,
            name: `Player ${index + 1}`,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    }
}

/** A prepared position from the logic package's examples, as an ordinary game. */
function prepared(examplePosition) {
    const engine = new GameEngine(EighteenNinetyFourScenarios.runtime)
    const game = EighteenNinetyFourScenarios.runtime.initializer.initializeGame(
        gameData({ examplePosition }),
        EighteenNinetyFourScenarios
    )
    const { startedGame, initialState } = engine.startGame(
        game,
        SEED.toString(16).padStart(32, '0')
    )
    const plain = Definition.runtime.initializer.initializeGame(gameData(undefined), Definition)
    return { engine, game: { ...startedGame, config: plain.config }, state: initialState }
}

/** A real game from its deal, on a seed that draws the Nord as the French company. */
function dealtWithNord() {
    const engine = new GameEngine(Definition.runtime)
    const game = Definition.runtime.initializer.initializeGame(
        gameData(undefined, NordSeed),
        Definition
    )
    const { startedGame, initialState } = engine.startGame(
        game,
        NordSeed.toString(16).padStart(32, '0')
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
    return result
}

function write(slug, name, { game, state }) {
    assert(Definition.runtime.canonicalStateValidator.Check(state), `${slug} is canonical`)
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

function owns(state, companyId, privateIds) {
    for (const id of privateIds) {
        if (!state.companies.some((company) => company.id === id)) {
            state.companies.push({ id, kind: 'private' })
            state.certificates.push({
                id: `${id}:charter`,
                companyId: id,
                kind: 'private',
                owner: { kind: 'bank' }
            })
        }
        const certificate = state.certificates.find((item) => item.id === `${id}:charter`)
        certificate.owner = { kind: 'company', companyId }
        delete certificate.poolId
    }
}

const inventory = (...tiles) => EighteenNinetyFourTileSet.createInventory(tiles)
const placed = (locationId, definitionId) => ({ locationId, definitionId, rotation: 0 })

mkdirSync(OUT, { recursive: true })

// The CFOR, floated at F80 with three bank-pool shares and three in its treasury, starts its
// turn in the set's first round: it may redeem two shares, or reissue its three.
{
    const position = prepared('construction')
    const { state } = position
    const cfor = state.companies.find((company) => company.id === 'CFOR')
    Object.assign(cfor, {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        parPrice: 67,
        president: { kind: 'player', playerId: state.players[0].playerId }
    })
    EighteenNinetyFourMarket.placeMarker(state.stockMarket, 'CFOR', '4:3')
    const places = { 1: 'pool', 2: 'pool', 3: 'pool', 4: 'treasury', 5: 'treasury', 6: 'treasury' }
    for (const certificate of state.certificates) {
        if (certificate.companyId !== 'CFOR' || certificate.kind !== 'share') continue
        const place = certificate.president ? 'president' : places[certificate.id.split(':').at(-1)]
        if (place === 'pool') {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'open-market'
        } else if (place === 'treasury') {
            certificate.owner = { kind: 'company', companyId: 'CFOR' }
            delete certificate.poolId
        } else {
            certificate.owner = {
                kind: 'player',
                playerId: state.players[place === 'president' ? 0 : 1].playerId
            }
            delete certificate.poolId
        }
    }
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'CFOR'
    ).amount = 500
    state.stations = state.stations.map((station) =>
        station.id === 'CFOR:home'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'D3', nodeId: 'city', slot: 0 }
              }
            : station.id === 'CFOR:station:1'
              ? {
                    ...station,
                    status: 'placed',
                    position: { locationId: 'H3', nodeId: 'city', slot: 0 }
                }
              : station
    )
    state.stationReservations = state.stationReservations.filter(
        (reservation) => reservation.companyId !== 'CFOR'
    )
    state.operatingSet = {
        ...state.operatingSet,
        companyOrder: ['CFOR', 'Belge', 'PLM'],
        roundNumber: 1
    }
    state.trackStep = { companyId: 'CFOR', lays: [], completed: false }
    state.machineState = 'LayingTrack'
    state.activePlayerIds = [state.players[0].playerId]
    write('share-operations', 'Redeem or reissue shares', position)
    state.trackStep.lays = [
        { locationId: 'E18', definitionId: '18xx:9' },
        { locationId: 'F17', definitionId: '18xx:9' }
    ]
    state.stations = state.stations.map((station) =>
        station.id === 'PLM:station:1'
            ? { id: station.id, companyId: 'PLM', status: 'displaced', locationId: 'E16' }
            : station
    )
    write('share-operations-set-aside', 'Share operations beside a set-aside station', position)
}

// One position for each private company's power (§11.2.2).
function companyOwning(examplePosition, privateId, arrange = () => {}) {
    const position = prepared(examplePosition)
    owns(position.state, 'Belge', [privateId])
    arrange(position.state)
    return position
}
write(
    'private-ligne-de-reims',
    'Ligne de Reims à Charleville',
    companyOwning('construction', 'LRC')
)
{
    const position = companyOwning('construction', 'LRC')
    owns(position.state, 'Belge', ['LS'])
    write('private-two-powers', 'Choosing between two private powers', position)
}
write('private-antwerpen-rotterdam', 'Antwerpen-Rotterdam income', prepared('trading'))
write('private-gare-de-liege', 'Gare de Liège: lay', companyOwning('construction', 'GLG'))
write(
    'private-gare-de-liege-upgrade',
    'Gare de Liège: upgrade',
    companyOwning('construction', 'GLG', (state) => {
        state.tileInventory = inventory(placed('H17', '18xx:57'))
    })
)
write(
    'private-station-antwerpen',
    'Station Antwerpen Centraal',
    companyOwning('construction', 'SAC')
)
{
    const position = prepared('trading')
    position.state.tileInventory = inventory(placed('G10', '18xx:14'))
    write('private-saint-quentin-green', 'Saint-Quentin à Guise: green', position)
}
{
    const position = prepared('trading')
    position.state.phaseId = '5+1'
    position.state.tileInventory = inventory(placed('G10', '1894:X16'))
    write('private-saint-quentin-brown', 'Saint-Quentin à Guise: brown', position)
}
write('private-saint-quentin-closes', 'Saint-Quentin à Guise closes', prepared('diesel'))
{
    const position = prepared('phases')
    position.state.trainInventory.trains = position.state.trainInventory.trains.filter(
        (train) => !(train.status === 'depot' && train.definitionId === '5+1')
    )
    write('privates-close', 'Privates close at phase 6', position)
}
{
    const position = companyOwning('routes', 'LS')
    const { state } = position
    state.tileInventory = inventory(placed('B9', '18xx:57'))
    state.accessRights = [{ rightId: 'ferry', companyId: 'Belge' }]
    state.stations = state.stations.map((station) =>
        station.id === 'Belge:home'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'B9', nodeId: 'city', slot: 0 }
              }
            : station.id === 'Belge:station:1'
              ? {
                    ...station,
                    status: 'placed',
                    position: { locationId: 'A12', nodeId: 'city', slot: 0 }
                }
              : station
    )
    write('private-london-shipping-bonus', 'London shipping bonus', position)
}
{
    const position = dealtWithNord()
    for (const [lotId, expectedPrice] of [
        ['LRC', 20],
        ['AR', 25],
        ['SAC', 50],
        ['SQG', 70],
        ['LS', 90]
    ])
        play(position, 'BuyAuctionLot', { lotId, expectedPrice })
    write('private-nord-minor', 'Nord minor and major shareholdings', position)
    for (const [lotId, expectedPrice] of [
        ['NMinorS', 140],
        ['NMS', 180]
    ])
        play(position, 'BuyAuctionLot', { lotId, expectedPrice })
    play(position, 'ParCompany', { companyId: 'Nord', marketSpaceId: '3:5' })
    play(position, 'BuyAuctionLot', { lotId: 'BMS', expectedPrice: 200 })
    play(position, 'ParCompany', { companyId: 'Belge', marketSpaceId: '3:5' })
    write('private-major-shareholdings', 'Major shareholdings close', position)
}

// The Belge's home is Calais, whose tile runs to London: it may buy a ferry marker, and its
// London shipping private may place a station in A12.
{
    const position = prepared('construction')
    const { state } = position
    state.tileInventory = inventory(placed('B9', '18xx:57'))
    state.stations = state.stations.map((station) =>
        station.id === 'Belge:home'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'B9', nodeId: 'city', slot: 0 }
              }
            : station
    )
    owns(state, 'Belge', ['LS'])
    write('london', 'Ferry marker and London shipping', position)
}

// Mechelen is a green #14 with the Belge's home and a PLM station, in phase 5+1: the Belge
// may split it, return its own station, and the PLM returns its station after the Belge's turn.
{
    const position = prepared('construction')
    const { state } = position
    state.phaseId = '5+1'
    state.tileInventory = EighteenNinetyFourTileSet.createInventory([
        { locationId: 'E16', definitionId: '18xx:14', rotation: 0 },
        { locationId: 'F15', definitionId: '1894:X2', rotation: 3 }
    ])
    state.stations = state.stations.map((station) =>
        station.id === 'PLM:station:1'
            ? {
                  ...station,
                  status: 'placed',
                  position: { locationId: 'E16', nodeId: 'city', slot: 1 }
              }
            : station
    )
    write('city-split', 'Splitting a green city', position)
    play(position, 'LayTile', {
        companyId: 'Belge',
        locationId: 'E16',
        definitionId: '1894:X16',
        rotation: 0,
        nodeMapping: {},
        expectedCost: 0
    })
    write('city-split-return', 'Returning set-aside stations', position)
}

// A stock round in phase 5+1: the late companies may start, choosing their homes.
{
    const position = prepared('trading')
    position.state.phaseId = '5+1'
    write('late-companies', 'Late companies in phase 5+1', position)
}

// The Belge buys trains with a 2-train after the 2s have sold out: it may upgrade its 2 to a
// 3 for F80, even at its train limit, or buy a 3 for F120.
{
    const position = prepared('trains')
    const { state } = position
    assert(state.trainPurchaseStep?.companyId === 'Belge', 'The Belge buys trains')
    let given = false
    state.trainInventory.trains = state.trainInventory.trains.flatMap((train) => {
        if (train.status !== 'depot' || train.definitionId !== '2') return [train]
        if (given) return []
        given = true
        return [{ ...train, status: 'owned', owner: { kind: 'company', companyId: 'Belge' } }]
    })
    write('train-upgrade', 'Upgrading a train', position)
}
