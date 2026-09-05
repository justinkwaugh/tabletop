import {
    BaseGameInitializer,
    assertExists,
    type GameInitializer,
    Prng,
    MachineContext,
    assert,
    getPrng,
    type ExplorationPopulation,
    type GameAction,
    type RandomFunction,
    type UninitializedGameState
} from '@tabletop/common'
import { Game, Player, HydratedTurnManager, shuffle } from '@tabletop/common'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from '../model/playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'

import { GoodsType } from './goodsType.js'

import { MachineState } from './states.js'
import { StallTile, TileType } from '../components/tiles.js'
import { generateBoard } from '../util/boardGenerator.js'
import { FreshFishColors } from './colors.js'
import { FreshFishGameConfig } from './gameConfig.js'
import { isDrawTile } from '../actions/drawTile.js'
import { isStallTile } from '../components/tiles.js'
import { StartAuction } from '../actions/startAuction.js'
import {
    queueForcedBids,
    queueAuctionEnd,
    queueStallWithoutDisk
} from '../util/automaticActions.js'
import { ActionType } from './actions.js'
import { Pass } from '../actions/pass.js'
import { StartOfTurnStateHandler } from '../stateHandlers/startOfTurn.js'

export class FreshFishGameInitializer
    extends BaseGameInitializer<FreshFishGameState, HydratedFreshFishGameState>
    implements GameInitializer<FreshFishGameState, HydratedFreshFishGameState>
{
    initializeExplorationState(state: FreshFishGameState): FreshFishGameState {
        const hydratedState = new HydratedFreshFishGameState(state)
        hydratedState.tileBag.shuffle()
        return hydratedState.dehydrate()
    }

    populateExplorationState({
        game,
        state,
        actions,
        random
    }: ExplorationPopulation<FreshFishGameState>): FreshFishGameState {
        const configuredSeed = game.config.boardSeed
        const boardSeed =
            state.boardSeed ??
            (typeof configuredSeed === 'number' && configuredSeed ? configuredSeed : game.seed)
        assertExists(boardSeed, 'Exploration requires the public board seed')
        const { numMarketTiles } = generateBoard(game.players.length, getPrng(boardSeed))
        const bag = new HydratedTileBag(this.initializeTileBag(game, numMarketTiles, random))
        for (const action of actions) {
            if (!isDrawTile(action)) continue
            const tile = action.metadata?.chosenTile
            assertExists(tile, 'Exploration requires the revealed draw outcome')
            const index = bag.items.findIndex((candidate) =>
                isStallTile(tile)
                    ? isStallTile(candidate) && candidate.goodsType === tile.goodsType
                    : candidate.type === tile.type
            )
            assert(index >= 0, 'Revealed draws exceed the starting tile population')
            bag.items.splice(index, 1)
        }
        assert(
            bag.items.length === state.tileBag.remaining,
            'Exploration tile count does not match the source'
        )
        bag.remaining = bag.items.length
        bag.shuffle(random)
        const result = new HydratedFreshFishGameState({ ...state, tileBag: bag.dehydrate() })
        const auction = result.currentAuction
        if (auction) {
            for (const participant of auction.participants) {
                if (
                    (participant.submitted ??
                        !result.activePlayerIds.includes(participant.playerId)) &&
                    participant.bid === undefined
                ) {
                    const money = result.getPlayerState(participant.playerId).money
                    auction.placeBid(
                        participant.playerId,
                        Math.floor(random() * (Math.floor(money) + 1))
                    )
                }
            }
        }
        return result.dehydrate()
    }

    getExplorationActions(game: Game, state: FreshFishGameState): GameAction[] {
        const hydrated = new HydratedFreshFishGameState(state)
        const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
        const playerId = hydrated.activePlayerIds[0]
        const auction = hydrated.currentAuction
        if (hydrated.machineState === MachineState.StallTileDrawn) {
            assertExists(playerId, 'Drawn stall has no auctioneer')
            context.addSystemAction(StartAuction, { playerId })
        } else if (hydrated.machineState === MachineState.AuctioningTile && auction) {
            if (auction.winnerId !== undefined) {
                queueAuctionEnd(context)
            } else {
                queueForcedBids(context)
            }
        } else if (
            hydrated.machineState === MachineState.AuctionEnded ||
            hydrated.machineState === MachineState.TileBagEmptied
        ) {
            queueStallWithoutDisk(context)
        } else if (hydrated.machineState === MachineState.StartOfTurn && playerId) {
            const handler = new StartOfTurnStateHandler()
            const available = handler.validActionsForPlayer(playerId, context)
            if (available.length === 1 && available[0] === ActionType.Pass) {
                context.addSystemAction(Pass, { playerId })
            }
        }
        Object.assign(state, hydrated.dehydrate())
        return context.getPendingActions()
    }

    initializeGameState(game: Game, state: UninitializedGameState): HydratedFreshFishGameState {
        const prng = new Prng(state.prng)
        const config = game.config as FreshFishGameConfig

        const boardSeed = config.boardSeed ? config.boardSeed : state.prng.seed
        const boardPrng = new Prng({ seed: boardSeed, invocations: 0 })
        const { board, numMarketTiles } = generateBoard(game.players.length, boardPrng.random)

        const players = this.initializePlayers(game, prng.random)
        const turnManager = HydratedTurnManager.generate(players, prng.random)
        const finalStalls = Object.values(GoodsType).map(
            (goodsType) => <StallTile>{ type: TileType.Stall, goodsType }
        )
        shuffle(finalStalls, prng.random)

        const bagPrngState = (state.systemVersion ?? 1) >= 3 ? state.protectedPrng : state.prng
        assertExists(bagPrngState, 'Protected tile-bag initialization requires protectedPrng')
        const bagPrng = new Prng(bagPrngState)

        const freshFishState: FreshFishGameState = Object.assign(state, {
            players: players,
            turnManager: turnManager,
            machineState: MachineState.StartOfTurn,
            tileBag: this.initializeTileBag(game, numMarketTiles, bagPrng.random),
            board,
            finalStalls: finalStalls,
            boardSeed: boardSeed
        })

        const initialState = new HydratedFreshFishGameState(freshFishState)
        initialState.score()
        return initialState
    }

    private initializePlayers(game: Game, random: RandomFunction): FreshFishPlayerState[] {
        const colors = structuredClone(FreshFishColors)

        shuffle(colors, random)

        const players = game.players.map((player: Player, index: number) => {
            return new HydratedFreshFishPlayerState({
                playerId: player.id,
                color: colors[index],
                money: 15,
                score: 0,
                stalls: Object.values(GoodsType).map((goodsType) => ({ goodsType, placed: false })),
                disks: 6
            })
        })

        return players
    }

    private initializeTileBag(game: Game, numMarketTiles: number, random: RandomFunction): TileBag {
        const numBagStalls = game.players.length - 1
        return HydratedTileBag.generate(
            numMarketTiles,
            numBagStalls,
            numBagStalls,
            numBagStalls,
            numBagStalls,
            random
        )
    }
}
