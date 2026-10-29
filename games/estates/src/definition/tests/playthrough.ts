import {
    ActionSource,
    assert,
    defaultGameConfig,
    normalizeGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { AuctionRecipient } from '../../actions/chooseRecipient.js'
import { isCube, isRoof } from '../../components/pieces.js'
import type { EstatesProjectedState } from '../../model/gameState.js'
import { ActionType } from '../actions.js'
import type { EstatesGameConfig } from '../gameConfig.js'
import { Definition } from '../gameDefinition.js'
import { EstatesInfo } from '../info.js'
import { EstatesRuntime } from '../runtime.js'
import { MachineState } from '../states.js'

const engine = new GameEngine(EstatesRuntime)

export function createGame(count: number, config: Partial<EstatesGameConfig> = {}) {
    return EstatesRuntime.initializer.initializeGame(
        {
            id: 'estates-competition',
            typeId: EstatesInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(EstatesInfo.configurator?.options ?? []),
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

export function play(
    game: ReturnType<typeof createGame>,
    initialState: EstatesProjectedState,
    onState?: (state: EstatesProjectedState) => void
) {
    let state = initialState
    let actionCount = 0
    function act(type: ActionType, payload: Record<string, unknown> = {}) {
        const action: GameAction = {
            id: `competition-${actionCount++}`,
            gameId: game.id,
            playerId: state.activePlayerIds[0],
            source: ActionSource.User,
            type,
            ...payload
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        onState?.(state)
    }
    function offerCube() {
        const coords = EstatesRuntime.hydrator.hydrateState(state).placeableCubes()[0]
        act(ActionType.StartAuction, { piece: state.cubes[coords.row][coords.col] })
    }
    function placeCube() {
        const cube = state.chosenPiece
        assert(isCube(cube), 'Expected an auctioned cube')
        const coords = EstatesRuntime.hydrator.hydrateState(state).board.validCubeLocations(cube)[0]
        act(ActionType.PlaceCube, { cube, coords })
    }
    return {
        get state() {
            return state
        },
        act,
        offerCube,
        placeCube
    }
}

export function playToEnd(
    game: ReturnType<typeof createGame>,
    initialState: EstatesProjectedState,
    onState?: (state: EstatesProjectedState) => void
) {
    const session = play(game, initialState, onState)
    for (
        let step = 0;
        step < 1000 && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        const state = EstatesRuntime.hydrator.hydrateState(session.state)
        const playerId = state.activePlayerIds[0]
        switch (state.machineState) {
            case MachineState.StartOfTurn:
                if (state.board.validRoofLocations().length > 0) {
                    session.act(ActionType.DrawRoof, {
                        visibleIndex: state.visibleRoofs.indexOf(true),
                        revealsInfo: true
                    })
                } else session.offerCube()
                break
            case MachineState.Auctioning:
                session.act(ActionType.PlaceBid, {
                    amount:
                        state.auction?.highBid || state.getPlayerState(playerId).getMoney() === 0
                            ? 0
                            : 1
                })
                break
            case MachineState.AuctionEnded:
                session.act(ActionType.ChooseRecipient, {
                    recipient: AuctionRecipient.HighestBidder
                })
                break
            case MachineState.PlacingPiece:
                if (isRoof(state.chosenPiece)) {
                    session.act(ActionType.PlaceRoof, {
                        roof: state.chosenPiece,
                        coords: state.board.validRoofLocations()[0]
                    })
                } else session.placeCube()
                break
        }
    }
    assert(session.state.machineState === MachineState.EndOfGame, 'The playthrough did not finish')
    return session.state
}
