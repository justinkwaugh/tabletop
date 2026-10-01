import {
    ActionSource,
    type CardinalDirection,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { routesFrom, type FountainId, type ShopId } from '../components/board.js'
import { QueueEnd } from '../components/visitors.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import type { MarracashProjectedState } from '../model/gameState.js'
import type { MarracashGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { MarracashInfo } from '../definition/info.js'
import { MarracashRuntime } from '../definition/runtime.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<MarracashGameConfig> = {}) {
    return MarracashRuntime.initializer.initializeGame(
        {
            id: 'marracash-test',
            typeId: MarracashInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(MarracashInfo.configurator?.options ?? []),
                ...config
            }),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type TestGame = ReturnType<typeof createGame>

export function startTestGame(count: number, config: Partial<MarracashGameConfig> = {}) {
    const game = createGame(count, config)
    const engine = new GameEngine(MarracashRuntime)
    const { initialState } = engine.startGame(game, { masterSeed: TestMasterSeed })
    return createTestSession(game, initialState)
}

export function createTestSession(game: TestGame, initialState: MarracashProjectedState) {
    const engine = new GameEngine(MarracashRuntime)
    let state = initialState
    let actionCount = 0
    const actions: GameAction[] = []

    function act(playerId: string, type: ActionType, payload: Record<string, unknown> = {}) {
        const action: GameAction = {
            id: `test-${actionCount++}`,
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        state = result.updatedState
        actions.push(...result.processedActions)
        return result.processedActions
    }

    return {
        game,
        actions,
        initialState,
        get state() {
            return state
        },
        edit(change: (draft: MarracashProjectedState) => void) {
            const draft = structuredClone(state)
            change(draft)
            state = draft
        },
        hydrated() {
            return MarracashRuntime.hydrator.hydrateState(structuredClone(state))
        },
        currentPlayerId() {
            return state.activePlayerIds[0]
        },
        act,
        startAuction(playerId: string, shopId: ShopId) {
            return act(playerId, ActionType.StartAuction, { shopId })
        },
        bid(playerId: string, amount: number) {
            return act(playerId, ActionType.PlaceBid, { amount })
        },
        move(playerId: string, fountainId: FountainId, direction: CardinalDirection) {
            return act(playerId, ActionType.MoveVisitors, { fountainId, direction })
        },
        bringVisitors(playerId: string, end: QueueEnd, count: number, entranceId: FountainId) {
            return act(playerId, ActionType.BringVisitors, { end, count, entranceId })
        }
    }
}

export type TestSession = ReturnType<typeof createTestSession>

export function playToEnd(session: TestSession): MarracashProjectedState {
    for (
        let step = 0;
        step < 5000 && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        const state = session.hydrated()
        const playerId = session.currentPlayerId()
        switch (state.machineState) {
            case MachineState.ChoosingAction: {
                const start = state.fountains.find((fountain) => fountain.visitors.length > 0)
                if (state.canMoveVisitors() && start) {
                    session.move(
                        playerId,
                        start.fountainId,
                        routesFrom(start.fountainId)[0].direction
                    )
                } else {
                    const shop = state.shops.find((candidate) => candidate.ownerId === undefined)
                    if (!shop) throw Error('Expected an unowned shop to auction')
                    session.startAuction(playerId, shop.shopId)
                }
                break
            }
            case MachineState.Bidding: {
                const auction = state.auction
                if (!auction) throw Error('Expected an auction')
                for (const bidder of [...state.activePlayerIds]) {
                    session.bid(bidder, bidder === auction.auctioneerId ? 100 : 0)
                }
                break
            }
            case MachineState.RefillingEntrances: {
                const count =
                    state.queue.length < 2 ? state.queue.length : Math.min(4, state.queue.length)
                session.bringVisitors(playerId, QueueEnd.Front, count, state.emptyEntranceIds()[0])
                break
            }
        }
    }
    if (session.state.machineState !== MachineState.EndOfGame) {
        throw Error('The game did not finish')
    }
    return session.state
}
