import {
    ActionSource,
    GameEngine,
    assert,
    assertExists,
    type Game,
    type GameDefinition,
    type UninitializedGameState
} from '@tabletop/common'
import {
    TrackConstruction,
    nextOperatingCompany,
    privateTrackConstruction,
    type Owner
} from '@tabletop/18xx'
import { ScenarioConfigurator, type ScenarioPosition } from '@tabletop/18xx/scenarios'
import { Initializer } from '../setup.js'
import { Definition, Runtime } from '../definition/gameDefinition.js'
import {
    hydrateEighteenFortySixState,
    type HydratedEighteenFortySixState,
    type EighteenFortySixProjectedState
} from '../state.js'
import { choicesFor, hiddenDistribution } from '../distribution.js'
import { openingPurchaseChoices } from '../publicDistribution.js'
import { draftCompany, isBlank } from '../catalog.js'
import { stockChoices } from '../stock.js'
import { trainBuyingChoices1846 } from '../trains.js'
import { EighteenFortySixTileSet } from '../tiles.js'
import { TrackRules1846 } from '../track.js'

type ScenarioState = ReturnType<HydratedEighteenFortySixState['dehydrate']>

// Positions where the operating railroad has just bought these privates from its president.
const PositionPrivates: Partial<Record<ScenarioPosition, readonly string[]>> = {
    'private-tiles': ['MC', 'O&I'],
    'private-upgrade': ['LSL'],
    'private-marker': ['MPC']
}
/** Gives a private to a player, restoring it first when setup removed it from this game. */
function dealPrivate(state: ScenarioState, privateId: string, owner: Owner) {
    if (!state.companies.some((company) => company.id === privateId)) {
        const company = draftCompany(privateId)
        state.companies.push({
            id: company.id,
            name: company.name,
            kind: 'private',
            privateRevenue: company.revenue
        })
        state.certificates.push({
            id: `${company.id}:charter`,
            companyId: company.id,
            owner: { kind: 'bank' },
            kind: 'private'
        })
        state.removedPrivateIds = state.removedPrivateIds.filter((id) => id !== privateId)
    }
    const certificate = state.certificates.find(
        (certificate) => certificate.companyId === privateId
    )
    assertExists(certificate, `Scenario needs ${privateId}`)
    certificate.owner = owner
}
/** Lays a yellow tile in each city, so an upgrade has something to replace. */
function cityTiles(state: ScenarioState, companyId: string, locationIds: string[]) {
    const construction = privateTrackConstruction(
        hydrateEighteenFortySixState(state),
        {
            companyId,
            locationIds,
            definitionIds: EighteenFortySixTileSet.definitions
                .filter((tile) => tile.face.color === 'yellow')
                .map((tile) => tile.id),
            payer: { kind: 'company', companyId },
            connected: false,
            free: true
        },
        TrackRules1846
    )
    return locationIds.reduce((inventory, locationId) => {
        const lay = construction.choices(locationId)[0]
        assertExists(lay, `Scenario needs a yellow tile in ${locationId}`)
        return EighteenFortySixTileSet.replace(inventory, {
            locationId,
            placement: lay.placement,
            returnPrevious: true
        })
    }, state.tileInventory)
}

export const ScenarioPositions1846: readonly ScenarioPosition[] = [
    'opening',
    'trading',
    'starting',
    'construction',
    'stations',
    'operations',
    'routes',
    'trains',
    'powers',
    'private-tiles',
    'private-upgrade',
    'private-marker',
    'transfers',
    'ending'
]

class ScenarioInitializer1846 extends Initializer {
    override initializeGameState(
        game: Game,
        base: UninitializedGameState
    ): HydratedEighteenFortySixState {
        let state = super.initializeGameState(game, base).dehydrate()
        const requested = game.config?.examplePosition ?? 'opening'
        const position = ScenarioPositions1846.find((item) => item === requested)
        assertExists(position, 'Unsupported 1846 scenario')
        if (position === 'opening') return hydrateEighteenFortySixState(state)
        const engine = new GameEngine(Runtime)
        const act = (type: string, fields: object = {}) => {
            state = engine.executeCanonicalAction({
                game,
                state,
                action: {
                    id: `prepare:${state.actionCount}`,
                    gameId: game.id,
                    type,
                    source: ActionSource.User,
                    playerId: state.activePlayerIds[0],
                    ...fields
                }
            }).updatedState
        }
        for (let i = 0; i < 100 && state.machineState !== 'StockRound'; i++) {
            const hydrated = hydrateEighteenFortySixState(state)
            if (state.draft.kind === 'public') {
                const choice = openingPurchaseChoices(hydrated, state.activePlayerIds[0])[0]
                assertExists(choice, 'Opening scenario requires an affordable company')
                act('BuyOpeningCompany', choice)
            } else {
                const choices = choicesFor(hydrated, state.activePlayerIds[0])
                const cardId = choices.find((id) => !isBlank(id)) ?? choices[0]
                assertExists(cardId, 'Draft scenario requires a card')
                act(hiddenDistribution(state).finalOffer ? 'PassFinalCompany' : 'ChooseDraftCard', {
                    ...(hiddenDistribution(state).finalOffer ? {} : { cardId }),
                    revealsInfo: true
                })
            }
        }
        assert(
            hydrateEighteenFortySixState(state).machineState === 'StockRound',
            'Scenario distribution must finish'
        )
        if (position !== 'starting') {
            const choices = stockChoices(
                hydrateEighteenFortySixState(state),
                state.activePlayerIds[0]
            )
            const start =
                choices.starts.find(
                    (choice) => choice.companyId === 'IC' && choice.expectedPrice === 80
                ) ?? choices.starts[0]
            assertExists(start, 'Scenario needs a corporation to launch')
            act('StartCompany', start)
            if (position === 'trading') act('FinishStockTurn')
            if (position !== 'trading') {
                for (let i = 0; i < 100; i++) {
                    const companyId = nextOperatingCompany(state)
                    if (state.machineState === 'LayingTrack' && companyId === start.companyId) break
                    switch (state.machineState) {
                        case 'StockRound':
                            act('FinishStockTurn')
                            break
                        case 'AssigningSteamboat':
                            act('AssignSteamboat')
                            break
                        case 'LayingTrack':
                            act('FinishTrack', { companyId })
                            break
                        case 'RunningTrains':
                            act('RunTrains', { companyId, routes: [] })
                            break
                        default:
                            throw new Error(`Unexpected scenario step: ${state.machineState}`)
                    }
                }
                assert(
                    state.machineState === 'LayingTrack',
                    "Scenario must reach the launched corporation's construction"
                )
                if (position !== 'operations') {
                    if (position === 'stations' && start.companyId === 'IC') {
                        const request = {
                            companyId: start.companyId,
                            locationId: 'J4',
                            definitionId: '18xx:9',
                            rotation: 0 as const,
                            nodeMapping: {}
                        }
                        const lay = new TrackConstruction(state, TrackRules1846).evaluate(
                            request
                        ).details
                        assertExists(lay, 'Station scenario needs connected track')
                        act('LayTile', { ...request, expectedCost: lay.cost })
                    }
                    if (
                        [
                            'routes',
                            'trains',
                            'powers',
                            'transfers',
                            'ending',
                            ...Object.keys(PositionPrivates)
                        ].includes(position)
                    ) {
                        const treasury = state.cash.find(
                            (balance) =>
                                balance.owner.kind === 'company' &&
                                balance.owner.companyId === start.companyId
                        )
                        assertExists(treasury)
                        if (treasury.amount !== 'unlimited') {
                            const grant = 1000 - treasury.amount
                            treasury.amount += grant
                            const bank = state.cash.find((balance) => balance.owner.kind === 'bank')
                            assertExists(bank)
                            if (bank.amount !== 'unlimited') bank.amount -= grant
                        }
                        act('FinishTrack', { companyId: start.companyId })
                        if (position === 'routes') {
                            const choice = trainBuyingChoices1846(
                                hydrateEighteenFortySixState(state)
                            )?.offers[0]
                            assertExists(choice)
                            const { price, ...request } = choice
                            act('BuyTrain', { ...request, expectedPrice: price })
                            state.tileInventory = EighteenFortySixTileSet.createInventory([
                                { locationId: 'J4', definitionId: '18xx:9', rotation: 0 }
                            ])
                            state.machineState = 'RunningTrains'
                            state.routeStep = { companyId: start.companyId }
                            delete state.earningsDistribution
                            delete state.trainPurchaseStep
                        }
                        if (
                            position === 'powers' ||
                            position === 'transfers' ||
                            position in PositionPrivates
                        ) {
                            state.phaseId = 'II'
                            state.machineState = 'LayingTrack'
                            state.trackStep = {
                                companyId: start.companyId,
                                lays: [],
                                completed: false
                            }
                            state.stationStep = {
                                companyId: start.companyId,
                                placedStationIds: [],
                                completed: false
                            }
                            delete state.earningsDistribution
                            delete state.trainPurchaseStep
                            delete state.routeStep
                        }
                        if (position === 'private-upgrade')
                            state.tileInventory = cityTiles(state, start.companyId, ['D14', 'E17'])
                        for (const privateId of PositionPrivates[position] ?? []) {
                            const seller = {
                                kind: 'player' as const,
                                playerId: state.activePlayerIds[0]
                            }
                            dealPrivate(state, privateId, seller)
                            act('OfferPurchase', {
                                companyId: start.companyId,
                                seller,
                                asset: { kind: 'private', privateCompanyId: privateId },
                                price: draftCompany(privateId).price
                            })
                        }
                        if (position === 'ending') {
                            assertExists(state.operatingSet)
                            state.operatingSet.roundNumber = 2
                            state.gameEnding = {
                                reason: 'Bank broken',
                                finalOperatingSet: state.operatingSet.number
                            }
                            state.bank.broken = true
                            state.operatingSet.companyOrder = [start.companyId]
                            state.operatingSet.completedCompanyIds = []
                        }
                    }
                }
            }
        }
        state.actionCount = 0
        state.actionChecksum = 0
        const actor = state.activePlayerIds[0]
        state.turnManager.series = [{ type: 'turn', playerId: actor, start: 0 }]
        return hydrateEighteenFortySixState(state)
    }
}

export const Scenarios1846: GameDefinition<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    info: { ...Definition.info, configurator: new ScenarioConfigurator() },
    runtime: { ...Runtime, initializer: new ScenarioInitializer1846() }
}
