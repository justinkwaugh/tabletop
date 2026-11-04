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

function gameData(config) {
    return {
        id: '1894-scenario',
        typeId: '1894',
        ownerId: 'p1',
        seed: SEED,
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
}

// The Belge's home is Calais, whose tile runs to London: it may buy a ferry marker, and its
// London shipping private may place a station in A12.
{
    const position = prepared('construction')
    const { state } = position
    state.tileInventory = EighteenNinetyFourTileSet.createInventory([
        { locationId: 'B9', definitionId: '18xx:57', rotation: 0 }
    ])
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
