import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assert,
    assertExists,
    type Game,
    type GameAction,
    type GameDefinition
} from '@tabletop/common'
import {
    RailwayMapState,
    RouteNetwork,
    StationPlacement,
    TrackConstruction,
    TrainPurchase,
    getCompany,
    homeStationId,
    placeStockMarker,
    rotateTileFace,
    type EighteenXXState,
    type HydratedEighteenXXState,
    type RailwayMap,
    type RoutePath,
    type StationRules,
    type StockMarketChart,
    type TileEdge,
    type TileRotation,
    type TileSet,
    type TrackRules,
    type TrainDepot,
    type TrainRoute,
    type TrainRules
} from '@tabletop/18xx'

const Rotations = [0, 1, 2, 3, 4, 5] as const

export type Placement = { locationId: string; definitionId: string; rotation: TileRotation }

/**
 * What a title's specs use to play and prepare positions, from the title's own rules: a table of
 * players, the turns of a stock round and an operating turn, and positions set up directly.
 */
export function titleTestKit<
    State extends EighteenXXState,
    Hydrated extends HydratedEighteenXXState
>(title: {
    definition: GameDefinition<State, Hydrated>
    map: RailwayMap
    tileSet: TileSet
    market: StockMarketChart
    trackRules: TrackRules
    stationRules: StationRules
    trainRules: TrainRules
    depot: TrainDepot
    privates: readonly { id: string; faceValue: number }[]
    home(companyId: string): string | undefined
    /** What a title decides straight after a private sells, such as its railway's par. */
    afterPrivateBought?(game: Table<State, Hydrated>): void
}) {
    const { definition, map, tileSet, market, trackRules, stationRules, trainRules, depot } = title

    function table(
        count = 4,
        seed = 7,
        config?: Record<string, boolean>,
        seatOrder?: (playerIds: string[]) => string[]
    ): Table<State, Hydrated> {
        const runtime = definition.runtime
        const engine = new GameEngine<State, Hydrated>(runtime)
        const game: Game = runtime.initializer.initializeGame(
            {
                id: `${definition.info.id}-test`,
                typeId: definition.info.id,
                ownerId: 'p1',
                seed,
                ...(config ? { config } : {}),
                players: Array.from({ length: count }, (_, index) => ({
                    id: `p${index + 1}`,
                    userId: `p${index + 1}`,
                    name: `Player ${index + 1}`,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            definition
        )
        const masterSeed = seed.toString(16).padStart(32, '0')
        const started = engine.startGame(
            game,
            seatOrder
                ? {
                      masterSeed,
                      startingPositions: {
                          playerIds: seatOrder(game.players.map((player) => player.id))
                      }
                  }
                : masterSeed
        )
        let state = started.initialState
        const actions: GameAction[] = []
        return {
            game: started.startedGame,
            engine,
            initialState: started.initialState,
            actions,
            get state() {
                return state
            },
            set state(next: State) {
                state = next
            },
            get hydrated(): Hydrated {
                return runtime.hydrator.hydrateState(state)
            },
            get player(): string {
                return state.activePlayerIds[0]
            },
            valid(playerId = state.activePlayerIds[0]): string[] {
                return engine.getValidActionTypesForPlayer(started.startedGame, state, playerId)
            },
            act(type: string, fields: object = {}, playerId = state.activePlayerIds[0]) {
                const action: GameAction = {
                    id: `action:${state.actionCount}`,
                    gameId: state.gameId,
                    source: ActionSource.User,
                    playerId,
                    type,
                    ...fields
                }
                const result = engine.executeCanonicalAction({
                    game: started.startedGame,
                    state,
                    action
                })
                state = result.updatedState
                actions.push(...result.processedActions)
                assert(runtime.canonicalStateValidator?.Check(state), 'Canonical state stays valid')
                return result
            }
        }
    }

    type Game = Table<State, Hydrated>

    function buyAllPrivates(game: Game): void {
        for (const company of title.privates) {
            game.act('BuyAuctionLot', { lotId: company.id, expectedPrice: company.faceValue })
            title.afterPrivateBought?.(game)
        }
    }

    function spaceAt(price: number): string {
        const space = market.spaces.find((entry) => entry.price === price && entry.color === 'pink')
        if (!space) throw new Error(`No ${price} par space`)
        return space.id
    }

    function launch(game: Game, companyId: string, price: number): void {
        game.act('StartCompany', {
            buyer: { kind: 'player', playerId: game.player },
            companyId,
            marketSpaceId: spaceAt(price),
            expectedPrice: price * 2
        })
    }

    function buyIpo(game: Game, companyId: string, price: number): void {
        const certificate = game.state.certificates.find(
            (entry) =>
                entry.companyId === companyId &&
                entry.kind === 'share' &&
                entry.poolId === 'initial-offering'
        )
        if (!certificate) throw new Error(`No ${companyId} share on offer`)
        game.act('BuyShares', {
            buyer: { kind: 'player', playerId: game.player },
            certificateId: certificate.id,
            expectedPrice: price
        })
    }

    function passStockRound(game: Game): void {
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
    }

    function exits(definitionId: string, rotation: number): number[] {
        const definition = tileSet.definitions.find((entry) => entry.id === definitionId)
        if (!definition) throw new Error(`Unknown tile ${definitionId}`)
        return [
            ...new Set(
                definition.face.paths.flatMap((path) =>
                    path.endpoints.flatMap((end) =>
                        end.kind === 'edge' ? [(end.edge + rotation) % 6] : []
                    )
                )
            )
        ].sort()
    }

    function lay(
        game: Game,
        locationId: string,
        definitionId: string,
        edges: readonly number[],
        rules: TrackRules = trackRules
    ): void {
        const wanted = [...edges].sort().join()
        const choices = new TrackConstruction(game.hydrated, rules).choices(locationId)
        const choice = choices.find(
            (entry) =>
                entry.definitionId === definitionId &&
                exits(entry.definitionId, entry.rotation).join() === wanted
        )
        if (!choice)
            throw new Error(
                `No ${definitionId} [${wanted}] in ${locationId}: ${JSON.stringify(
                    choices.map(
                        (entry) =>
                            `${entry.definitionId} [${exits(entry.definitionId, entry.rotation)}]`
                    )
                )}`
            )
        game.act('LayTile', {
            companyId: choice.companyId,
            locationId,
            definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
    }

    function placeStation(game: Game, locationId: string, nodeId = 'city'): void {
        const companyId = game.state.stationStep?.companyId
        const station = game.state.stations.find(
            (entry) => entry.companyId === companyId && entry.status === 'available'
        )
        const choice = station
            ? new StationPlacement(game.hydrated, stationRules)
                  .choices(station.id)
                  .find(
                      (entry) =>
                          entry.position.locationId === locationId &&
                          entry.position.nodeId === nodeId
                  )
            : undefined
        if (!choice) throw new Error(`No station in ${locationId}`)
        const { cost, ...request } = choice
        game.act('PlaceStation', { ...request, expectedCost: cost })
    }

    function buyTrain(game: Game, definitionId: string): void {
        const offer = new TrainPurchase(game.hydrated, trainRules)
            .offers()
            .map((entry) => entry.evaluation.details)
            .find((details) => details?.definitionId === definitionId)
        if (!offer) throw new Error(`No ${definitionId} offered`)
        game.act('BuyTrain', {
            companyId: offer.companyId,
            trainId: offer.trainId,
            definitionId,
            expectedPrice: offer.price
        })
    }

    function route(
        state: Pick<State, 'tileInventory'>,
        trainId: string,
        start: { locationId: string; nodeId: string },
        hexes: readonly string[],
        extensionHexes: readonly string[] = []
    ): TrainRoute {
        const network = new RouteNetwork(new RailwayMapState(map, tileSet, state.tileInventory))
        const walk = (
            paths: RoutePath[],
            targets: readonly string[],
            from: readonly RoutePath[]
        ): RoutePath[] | undefined => {
            const trace = network.trace(start, [...from, ...paths]).trace
            if (!trace) return undefined
            const end = trace.end
            if (
                end.locationId === targets.at(-1) &&
                end.endpoint.kind === 'node' &&
                paths.length > 0
            )
                return paths
            for (const next of network.extensions(start, [...from, ...paths])) {
                if (!targets.includes(next.locationId)) continue
                if (
                    paths.some(
                        (path) => path.locationId === next.locationId && path.pathId === next.pathId
                    )
                )
                    continue
                const found = walk([...paths, next], targets, from)
                if (found) return found
            }
            return undefined
        }
        const paths = walk([], [start.locationId, ...hexes], [])
        if (!paths) throw new Error(`No route through ${hexes.join(' ')}`)
        if (!extensionHexes.length) return { trainId, start, paths }
        const extension = walk([], [...hexes.slice(-1), ...extensionHexes], paths)
        if (!extension) throw new Error(`No extension through ${extensionHexes.join(' ')}`)
        return { trainId, start, paths, extension }
    }

    function ownedTrainId(game: Game, companyId: string, definitionId: string): string {
        const train = game.state.trainInventory.trains.find(
            (entry) =>
                entry.status === 'owned' &&
                entry.owner.kind === 'company' &&
                entry.owner.companyId === companyId &&
                entry.definitionId === definitionId
        )
        if (!train) throw new Error(`${companyId} owns no ${definitionId}`)
        return train.id
    }

    function rotationFor(definitionId: string, edges: readonly number[]): TileRotation {
        const wanted = [...edges].sort().join()
        const rotation = Rotations.find(
            (candidate) => exits(definitionId, candidate).join() === wanted
        )
        if (rotation === undefined) throw new Error(`${definitionId} cannot leave by ${wanted}`)
        return rotation
    }

    function tileJoining(locationId: string, edges: readonly TileEdge[]): Placement {
        const nodes = map.location(locationId).preprintedTile.nodes
        const tiles = nodes.some((node) => node.kind === 'city')
            ? ['57', '6', '5']
            : nodes.some((node) => node.kind === 'town')
              ? ['4', '58', '3']
              : ['9', '8', '7']
        for (const number of tiles)
            for (const rotation of Rotations) {
                const definitionId = `18xx:${number}`
                const definition = tileSet.definitions.find((tile) => tile.id === definitionId)
                assertExists(definition, `Unknown tile ${number}`)
                const tileExits = rotateTileFace(definition.face, rotation).paths.flatMap((path) =>
                    path.endpoints.flatMap((end) => (end.kind === 'edge' ? [end.edge] : []))
                )
                if (edges.every((edge) => tileExits.includes(edge)))
                    return { locationId, definitionId, rotation }
            }
        throw new Error(`No tile joins ${edges.join()} in ${locationId}`)
    }

    function trackAlong(hexes: readonly string[]): Placement[] {
        return hexes.flatMap((locationId, index) => {
            if (!map.location(locationId).buildable) return []
            const edgeToward = (other: string | undefined): TileEdge[] => {
                if (!other) return []
                const edge = Rotations.find(
                    (candidate) => map.neighbor(locationId, candidate)?.id === other
                )
                assertExists(edge, `${other} does not border ${locationId}`)
                return [edge]
            }
            return [
                tileJoining(locationId, [
                    ...edgeToward(hexes[index - 1]),
                    ...edgeToward(hexes[index + 1])
                ])
            ]
        })
    }

    function giveTrain(state: State, companyId: string, definitionId: string): string {
        const train = depot.nextTrain(state.trainInventory, definitionId)
        assertExists(train, `No ${definitionId} left`)
        depot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId
        })
        return train.id
    }

    function operated(
        state: State,
        companyId: string,
        playerId: string,
        {
            price = 100,
            shares = 6,
            cash = 500
        }: { price?: number; shares?: number; cash?: number } = {}
    ): void {
        const company = getCompany(state, companyId)
        Object.assign(company, {
            started: true,
            floated: true,
            funded: true,
            operated: true,
            parPrice: price,
            president: { kind: 'player', playerId }
        })
        const space = market.spaces.find((entry) => entry.price === price && entry.color === 'pink')
        assertExists(space, `No ${price} par space`)
        placeStockMarker(state.stockMarket, companyId, space.id)
        const owned = state.certificates.filter(
            (certificate) => certificate.companyId === companyId && certificate.kind === 'share'
        )
        let left = shares
        for (const certificate of owned) {
            if (left <= 0 || certificate.kind !== 'share') break
            certificate.owner = { kind: 'player', playerId }
            delete certificate.poolId
            left -= certificate.shares
        }
        const account = state.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
        )
        assertExists(account, 'The company has an account')
        account.amount = cash
        const home = title.home(companyId)
        assertExists(home, 'The company has a home')
        const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
        if (reservation) {
            state.stationReservations = state.stationReservations.filter(
                (entry) => entry !== reservation
            )
            state.stations = state.stations.map((station) =>
                station.id === homeStationId(companyId)
                    ? {
                          id: station.id,
                          companyId,
                          status: 'placed',
                          position: { locationId: home, nodeId: reservation.nodeId, slot: 0 }
                      }
                    : station
            )
        }
    }

    function turnFor(state: State, playerId: string): void {
        state.activePlayerIds = [playerId]
        state.turnManager.series = [{ type: 'turn', playerId, start: 0 }]
    }

    function prepared(
        prepare: (state: State, game: Game) => void,
        count = 4,
        config?: Record<string, boolean>
    ): Game {
        const game = table(count, 7, config)
        buyAllPrivates(game)
        const state = structuredClone(game.state)
        prepare(state, game)
        game.state = state
        return game
    }

    return {
        table,
        buyAllPrivates,
        spaceAt,
        launch,
        buyIpo,
        passStockRound,
        exits,
        lay,
        placeStation,
        buyTrain,
        route,
        ownedTrainId,
        rotationFor,
        trackAlong,
        giveTrain,
        operated,
        turnFor,
        prepared
    }
}

export type Table<State extends EighteenXXState, Hydrated extends HydratedEighteenXXState> = {
    game: Game
    engine: GameEngine<State, Hydrated>
    initialState: State
    actions: GameAction[]
    state: State
    readonly hydrated: Hydrated
    readonly player: string
    valid(playerId?: string): string[]
    act(
        type: string,
        fields?: object,
        playerId?: string
    ): ReturnType<GameEngine<State, Hydrated>['executeCanonicalAction']>
}
