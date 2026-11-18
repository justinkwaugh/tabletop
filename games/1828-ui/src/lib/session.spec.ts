import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushSync } from 'svelte'
import {
    GameStorage,
    assertExists,
    type Game,
    type GameAction,
    type GameState,
    type HydratedGameState
} from '@tabletop/common'
import {
    BridgedContext,
    DefaultColorizer,
    GameSession,
    createHarnessAppContext,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import type { GameUIRuntime } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Definition, MhId, type HydratedState1828, type State1828 } from '@tabletop/1828'
import { Session1828 } from './session.svelte.js'

const HarnessUser = 'harness-user'
const Scenarios = join(dirname(fileURLToPath(import.meta.url)), '../scenarios')

const gameUI = {
    load: async () => {
        throw Error('The session spec does not render a table')
    },
    mount: () => {
        throw Error('The session spec does not render a table')
    }
}
const colorizer = new DefaultColorizer()
const runtime: GameUIRuntime<State1828, HydratedState1828> = {
    ...Definition.runtime,
    sessionClass: Session1828,
    colorizer,
    gameUI
}

const definition: GameUiDefinition<GameState, HydratedGameState> = {
    info: { ...Definition.info, thumbnailUrl: '' },
    async runtime() {
        return { ...Definition.runtime, sessionClass: GameSession, colorizer, gameUI }
    }
}

// The client build's window is Node's global, which has no events; the session's preferences
// listen for focus.
vi.stubGlobal('addEventListener', () => {})
vi.stubGlobal('removeEventListener', () => {})

const disposals: (() => void)[] = []
afterEach(() => {
    for (const dispose of disposals.splice(0)) dispose()
})

type Scenario = { game: Game; state: State1828; actions: GameAction[] }

function scenario(name: string): Scenario {
    return JSON.parse(readFileSync(join(Scenarios, `${name}.json`), 'utf8'))
}

async function seated({ game, state, actions }: Scenario, playerId: string) {
    const seatedGame: Game = {
        ...game,
        storage: GameStorage.Local,
        players: game.players.map((player) => ({
            ...player,
            userId: player.id === playerId ? HarnessUser : `user-${player.id}`
        }))
    }
    const app = createHarnessAppContext(definition)
    vi.spyOn(app.gameService, 'saveGameLocally').mockResolvedValue(undefined)
    const bridgedContext = new BridgedContext({
        authorizationService: app.authorizationService,
        gameService: app.gameService,
        chatService: app.chatService,
        gameId: seatedGame.id
    })
    const session = new Session1828({
        gameService: app.gameService,
        bridgedContext,
        notificationService: app.notificationService,
        chatService: app.chatService,
        api: app.api,
        runtime,
        game: seatedGame,
        state,
        actions
    })
    disposals.push(() => {
        session.dispose()
        bridgedContext.dispose()
    })
    flushSync()
    await session.waitForVisibleTransitionSettled()
    return session
}

async function settled(session: Session1828, change: Promise<unknown>) {
    await change
    await session.waitForVisibleTransitionSettled()
    await new Promise((resolve) => setTimeout(resolve))
}

function watchingActionUndo(session: Session1828) {
    return vi.spyOn(session, 'undoCommittedAction').mockResolvedValue(undefined)
}

function openOperatingExchange(session: Session1828) {
    const action = session.titlePrivateAction
    assertExists(action, 'The M&H’s owner can open its exchange')
    action.press()
}

function withMohawkOwner(position: Scenario, playerId: string): Scenario {
    const { state } = position
    return {
        ...position,
        state: {
            ...state,
            companies: state.companies.map((company) =>
                company.id === MhId ? { ...company, closed: false } : company
            ),
            certificates: [
                ...state.certificates.filter((certificate) => certificate.companyId !== MhId),
                {
                    id: `${MhId}:charter`,
                    companyId: MhId,
                    kind: 'private',
                    owner: { kind: 'player', playerId }
                }
            ],
            cash: state.cash.map((holding) =>
                holding.owner.kind === 'player' && holding.owner.playerId === playerId
                    ? { ...holding, amount: 500 }
                    : holding
            )
        }
    }
}

describe('the M&H exchange', () => {
    it('takes back the par, the company and the opening one Undo at a time', async () => {
        const session = await seated(scenario('mohawk-on-turn'), 'p1')
        const actionUndo = watchingActionUndo(session)
        openOperatingExchange(session)
        const [offer] = session.mohawkExchange.directorships
        session.chooseMohawkDirectorship(offer.companyId)
        session.chooseMohawkPar(offer.pars[0].marketSpaceId)
        expect(session.mohawkPar).toEqual(offer.pars[0])

        await session.undo()
        expect(session.mohawkPar).toBeUndefined()
        expect(session.mohawkDirectorship?.companyId).toBe(offer.companyId)

        await session.undo()
        expect(session.mohawkDirectorship).toBeUndefined()
        expect(session.mohawkExchangeOpen).toBe(true)

        await session.undo()
        expect(session.mohawkExchangeOpen).toBe(false)
        expect(session.hasLocalSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('forgets the par when another company is chosen', async () => {
        const session = await seated(scenario('mohawk-on-turn'), 'p1')
        openOperatingExchange(session)
        const [first, second] = session.mohawkExchange.directorships
        session.chooseMohawkDirectorship(first.companyId)
        session.chooseMohawkPar(first.pars[0].marketSpaceId)

        session.chooseMohawkDirectorship(second.companyId)
        expect(session.mohawkDirectorship?.companyId).toBe(second.companyId)
        expect(session.mohawkPar).toBeUndefined()
        expect(session.mohawkExchangeOpen).toBe(true)
    })

    it('closes with everything chosen in it when its button is pressed again', async () => {
        const session = await seated(scenario('mohawk-on-turn'), 'p1')
        openOperatingExchange(session)
        const [offer] = session.mohawkExchange.directorships
        session.chooseMohawkDirectorship(offer.companyId)

        openOperatingExchange(session)
        expect(session.mohawkExchangeOpen).toBe(false)
        expect(session.mohawkDirectorship).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })

    it('takes back a stock turn’s choice before closing its panel', async () => {
        const session = await seated(scenario('first-stock-round'), 'p4')
        const actionUndo = watchingActionUndo(session)
        session.stockPanels.choose('exchange')
        const [offer] = session.mohawkExchange.directorships
        session.chooseMohawkDirectorship(offer.companyId)

        await session.undo()
        expect(session.mohawkDirectorship).toBeUndefined()
        expect(session.stockPanels.open).toBe('exchange')

        await session.undo()
        expect(session.stockPanels.open).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()
    })

    it.each([
        ['mohawk-on-turn', 'ExchangePrivate'],
        ['mohawk-off-turn', 'ExchangePrivateOutOfTurn']
    ])('sends a share exchange from %s as %s', async (name, type) => {
        const session = await seated(scenario(name), 'p1')
        const [offer] = session.mohawkExchange.shares
        await settled(session, session.exchangeMohawkForShare(offer))
        expect(session.actions.some((action) => action.type === type)).toBe(true)
    })
})

describe('the certificate limit', () => {
    it('is absent, so tables leave certificate counts out', async () => {
        const session = await seated(scenario('first-stock-round'), 'p4')
        expect(session.noCertificateLimit).toBe(true)
    })
})

describe('choosing a merger', () => {
    it('takes back the pair before closing the panel', async () => {
        const session = await seated(scenario('merger'), 'p3')
        const actionUndo = watchingActionUndo(session)
        session.stockPanels.choose('merge')
        const [first, second] = session.mergerPairs
        session.chooseMergerPair(first.key)
        session.chooseMergerPair(second.key)
        expect(session.mergerPair?.key).toBe(second.key)

        await session.undo()
        expect(session.mergerPair).toBeUndefined()
        expect(session.stockPanels.open).toBe('merge')

        await session.undo()
        expect(session.stockPanels.open).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })
})

describe('leaving a stock panel', () => {
    const mergerWithMohawk = () => withMohawkOwner(scenario('merger'), 'p3')

    function openBuyMenu(session: Session1828) {
        const [{ menu, buyer }] = session.stock.availableMenus
        session.stock.chooseMenu(menu, buyer)
        return menu
    }

    it('drops the pair when the player moves to the Exchange panel', async () => {
        const session = await seated(mergerWithMohawk(), 'p3')
        const actionUndo = watchingActionUndo(session)
        session.stockPanels.choose('merge')
        const [first, second] = session.mergerPairs
        session.chooseMergerPair(first.key)
        session.chooseMergerPair(second.key)

        session.stockPanels.choose('exchange')
        expect(session.stockPanels.open).toBe('exchange')

        session.stockPanels.choose('merge')
        expect(session.mergerPair).toBeUndefined()

        session.stockPanels.choose('exchange')
        await session.undo()
        expect(session.stockPanels.open).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()
    })

    it('drops the M&H choice when the player moves to the Merge panel', async () => {
        const session = await seated(mergerWithMohawk(), 'p3')
        session.stockPanels.choose('exchange')
        const [offer] = session.mohawkExchange.directorships
        session.chooseMohawkDirectorship(offer.companyId)
        session.chooseMohawkPar(offer.pars[0].marketSpaceId)

        session.stockPanels.choose('merge')
        await session.undo()
        expect(session.stockPanels.open).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)

        session.stockPanels.choose('exchange')
        expect(session.mohawkDirectorship).toBeUndefined()
    })

    it('drops the pair when a stock menu opens, so Undo closes the menu', async () => {
        const session = await seated(scenario('merger'), 'p3')
        session.stockPanels.choose('merge')
        session.chooseMergerPair(session.mergerPairs[0].key)

        const menu = openBuyMenu(session)
        expect(session.stock.openMenu).toBe(menu)

        await session.undo()
        expect(session.stock.openMenu).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        session.stockPanels.choose('merge')
        expect(session.mergerPair).toBeUndefined()
    })

    it('drops the M&H choice when a stock menu opens', async () => {
        const session = await seated(scenario('first-stock-round'), 'p4')
        session.stockPanels.choose('exchange')
        session.chooseMohawkDirectorship(session.mohawkExchange.directorships[0].companyId)

        openBuyMenu(session)
        await session.undo()
        expect(session.hasLocalSelection).toBe(false)
        session.stockPanels.choose('exchange')
        expect(session.mohawkDirectorship).toBeUndefined()
    })

    it('keeps the pair when the open panel’s entry is pressed again', async () => {
        const session = await seated(scenario('merger'), 'p3')
        session.stockPanels.choose('merge')
        const [pair] = session.mergerPairs
        session.chooseMergerPair(pair.key)

        session.stockPanels.choose('merge')
        expect(session.mergerPair?.key).toBe(pair.key)
    })
})

describe('choosing the C&P’s run', () => {
    it('shows each run worth choosing on the map in its own colour', async () => {
        const session = await seated(scenario('cobourg-run'), 'p2')
        const choices = session.cobourgRunChoices
        expect(choices.length).toBeGreaterThan(0)
        expect(new Set(choices.map(({ run }) => run.revenue)).size).toBe(choices.length)
        expect(session.titleMapRoutes.map((route) => route.segments)).toEqual(
            choices.map(({ run }) => run.paths)
        )
        expect(new Set(session.titleMapRoutes.map((route) => route.color)).size).toBe(
            choices.length
        )
    })

    it('shows nothing to the other players', async () => {
        const session = await seated(scenario('cobourg-run'), 'p1')
        expect(session.cobourgRunChoices).toEqual([])
        expect(session.titleMapRoutes).toEqual([])
    })
})

describe('a system’s shells', () => {
    const SystemId = 'BO'

    function shellTrainIds(session: Session1828) {
        return session.gameState.systems[SystemId].shellTrainIds
    }

    function arrangementOf(session: Session1828) {
        const arrangement = session.shellArrangement
        assertExists(arrangement, 'The director arranges the shells')
        return arrangement
    }

    function submitted(session: Session1828, type: string) {
        return session.actions.filter((action) => action.type === type)
    }

    function fullShells(): Scenario {
        const position = scenario('system-shells')
        const { state } = position
        const [first, second] = state.systems[SystemId].shellTrainIds
        const spareTrainId = 'three-or-four/2/1'
        return {
            ...position,
            state: {
                ...state,
                phaseId: '3+D',
                trainInventory: {
                    ...state.trainInventory,
                    trains: state.trainInventory.trains.map((train) =>
                        train.id === spareTrainId && train.status === 'owned'
                            ? { ...train, owner: { kind: 'company', companyId: SystemId } }
                            : train
                    )
                },
                systems: {
                    ...state.systems,
                    [SystemId]: {
                        ...state.systems[SystemId],
                        shellTrainIds: [first, [...second, spareTrainId]]
                    }
                }
            }
        }
    }

    it('swaps a train picked in each full shell with one Action', async () => {
        const session = await seated(fullShells(), 'p4')
        const [[first], [second]] = shellTrainIds(session)
        const apply = vi.spyOn(session, 'applyAction')
        expect(arrangementOf(session).swapping).toBe(true)

        await session.moveShellTrain(first)
        expect(arrangementOf(session).swapTrainId).toBe(first)
        expect(apply).not.toHaveBeenCalled()

        await settled(session, session.moveShellTrain(second))
        expect(apply).toHaveBeenCalledOnce()
        const swaps = submitted(session, 'SwapShellTrains')
        expect(swaps).toHaveLength(1)
        expect(swaps[0]).toMatchObject({
            companyId: SystemId,
            trainId: first,
            otherTrainId: second
        })
        const [shellOne, shellTwo] = shellTrainIds(session)
        expect(shellOne).toContain(second)
        expect(shellTwo).toContain(first)
        expect(arrangementOf(session).swapTrainId).toBeUndefined()
    })

    it('replaces the first pick with another train from the same shell', async () => {
        const session = await seated(fullShells(), 'p4')
        const [[first, sameShell]] = shellTrainIds(session)
        const apply = vi.spyOn(session, 'applyAction')

        await session.moveShellTrain(first)
        await session.moveShellTrain(sameShell)
        expect(arrangementOf(session).swapTrainId).toBe(sameShell)
        expect(apply).not.toHaveBeenCalled()
    })

    it('takes back the first pick with Undo before any Action', async () => {
        const session = await seated(fullShells(), 'p4')
        const actionUndo = watchingActionUndo(session)
        const [[first]] = shellTrainIds(session)
        await session.moveShellTrain(first)
        expect(session.hasLocalSelection).toBe(true)

        await session.undo()
        expect(arrangementOf(session).swapTrainId).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('closes an M&H exchange opened over the pick before taking the pick back', async () => {
        const session = await seated(withMohawkOwner(fullShells(), 'p4'), 'p4')
        const [[first]] = shellTrainIds(session)
        await session.moveShellTrain(first)
        openOperatingExchange(session)
        expect(session.mohawkExchangeOpen).toBe(true)

        await session.undo()
        expect(session.mohawkExchangeOpen).toBe(false)
        expect(arrangementOf(session).swapTrainId).toBe(first)

        await session.undo()
        expect(arrangementOf(session).swapTrainId).toBeUndefined()
    })

    it('moves a train at once while a shell has room', async () => {
        const session = await seated(scenario('system-shells'), 'p4')
        const [[train]] = shellTrainIds(session)
        expect(arrangementOf(session).swapping).toBe(false)

        await settled(session, session.moveShellTrain(train))
        expect(submitted(session, 'MoveShellTrain')).toHaveLength(1)
        expect(shellTrainIds(session)[1]).toContain(train)
    })

    it('sends the next train to the shell the director chooses', async () => {
        const session = await seated(scenario('system-shells'), 'p4')
        expect(session.trainShellChoice).toMatchObject({
            companyId: SystemId,
            shellCompanyIds: [SystemId, 'NKP'],
            nextShellCompanyId: 'NKP'
        })

        await settled(session, session.chooseTrainShell(SystemId))
        expect(submitted(session, 'ChooseTrainShell')).toHaveLength(1)
        expect(session.trainShellChoice?.nextShellCompanyId).toBe(SystemId)
    })

    it('offers no shell for the next train while both are full', async () => {
        const session = await seated(fullShells(), 'p4')
        expect(session.trainShellChoice).toBeUndefined()
    })
})

describe('choosing a blocking station', () => {
    const LocationId = 'D14'

    async function mergerWithStationsApart() {
        const position = scenario('merger')
        const session = await seated(position, 'p3')
        const entry = session.map.scene.locations.find(({ location }) => location.id === LocationId)
        assertExists(entry, 'The hex is on the map')
        const nodeIds = entry.face.nodes.map((node) => node.id)
        const place = (stationId: string, nodeId: string) => ({
            status: 'placed' as const,
            position: { locationId: LocationId, nodeId, slot: 0 },
            stationId
        })
        const placed = [place('CPR:station:1', nodeIds[0]), place('GT:station:1', nodeIds[1])]
        const state: State1828 = {
            ...position.state,
            merger: {
                survivorId: 'CPR',
                absorbedId: 'GT',
                stage: 'shares',
                blockedStationIds: [],
                setAsides: [],
                decisions: []
            },
            stations: position.state.stations.map((station) => {
                const spot = placed.find(({ stationId }) => stationId === station.id)
                return spot
                    ? {
                          id: station.id,
                          companyId: station.companyId,
                          status: spot.status,
                          position: spot.position
                      }
                    : station
            })
        }
        return { session: await seated({ ...position, state }, 'p3'), nodeIds }
    }

    it('offers the hex on the map and blocks the station in the city clicked', async () => {
        const { session, nodeIds } = await mergerWithStationsApart()
        const choice = session.mapLocationChoice
        assertExists(choice, 'The stations are offered on the map')
        expect(choice.locationIds).toEqual([LocationId])
        expect(session.choosingMergerStation).toBe(true)

        choice.choose(LocationId, nodeIds[1])
        await session.waitForVisibleTransitionSettled()
        await new Promise((resolve) => setTimeout(resolve))
        expect(session.gameState.merger?.blockedStationIds).toEqual(['GT:station:1'])
    })

    it('ignores a click on the hex that finds neither city', async () => {
        const { session } = await mergerWithStationsApart()
        const apply = vi.spyOn(session, 'applyAction')
        session.mapLocationChoice?.choose(LocationId)
        expect(apply).not.toHaveBeenCalled()
    })
})
