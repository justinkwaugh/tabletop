import {
    assertExists,
    assert,
    getPrng,
    type ExplorationPopulation,
    type GameExploration
} from '@tabletop/common'
import { createTileBag } from '../util/tileBag.js'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import { HydratedTileBag } from '../components/tileBag.js'
import { generateBoard } from '../util/boardGenerator.js'
import { isDrawTile } from '../actions/drawTile.js'
import { isStallTile } from '../components/tiles.js'

export class FreshFishGameExploration implements GameExploration<FreshFishGameState> {
    createFromCanonicalState(state: FreshFishGameState): FreshFishGameState {
        const hydratedState = new HydratedFreshFishGameState(state)
        hydratedState.tileBag.shuffle()
        return hydratedState.dehydrate()
    }

    createFromProjectedState({
        game,
        state,
        actions,
        random
    }: ExplorationPopulation<FreshFishGameState>): FreshFishGameState {
        const configuredSeed = game.config.boardSeed
        const boardSeed =
            state.boardSeed ?? (typeof configuredSeed === 'number' ? configuredSeed : game.seed)
        assertExists(boardSeed, 'Exploration requires the public board seed')
        const { numMarketTiles } = generateBoard(game.players.length, getPrng(boardSeed))
        const bag = new HydratedTileBag(createTileBag(game, numMarketTiles, random))
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
}
