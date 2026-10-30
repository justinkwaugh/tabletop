import { Prng, assertExists, type Game, type GameAction } from '@tabletop/common'
import { BuyShare } from '../actions/buyShare.js'
import { EndTurn } from '../actions/endTurn.js'
import { HydratedPlaceTrack, PlaceTrack } from '../actions/placeTrack.js'
import { PayRepairs } from '../actions/payRepairs.js'
import { HydratedScrapTrack, ScrapTrack } from '../actions/scrapTrack.js'
import { SellShare } from '../actions/sellShare.js'
import type { SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { normalizePromontoryPointConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import type {
    HydratedPromontoryPointGameState,
    PromontoryPointGameState
} from '../model/gameState.js'
import { openSpaceIds } from '../rules/network.js'
import { saleListRefusal } from '../rules/repairs.js'
import { buyShareRefusal, sellShareRefusal } from '../rules/trading.js'
import { engine } from './startGame.js'
import { action } from './turns.js'

// A seat that takes a random legal action, drawn from its own seeded stream, never the game's.
export class SeededPlayer {
    private readonly prng: Prng

    constructor(seed: number) {
        this.prng = new Prng({ seed, invocations: 0 })
    }

    nextAction(game: Game, state: PromontoryPointGameState): GameAction {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, 'A seat is active while the game goes on')
        const type = this.pick(engine.getValidActionTypesForPlayer(game, state, playerId))
        const hydrated = Definition.runtime.hydrator.hydrateState(structuredClone(state))
        switch (type) {
            case ActionType.BuyShare:
                return action(BuyShare, state, {
                    playerId,
                    railroadId: this.pick(
                        RAILROAD_IDS.filter(
                            (railroadId) =>
                                buyShareRefusal(hydrated, playerId, railroadId) === undefined
                        )
                    )
                })
            case ActionType.SellShare:
                return action(SellShare, state, {
                    playerId,
                    railroadId: this.pick(
                        RAILROAD_IDS.filter(
                            (railroadId) =>
                                sellShareRefusal(hydrated, playerId, railroadId) === undefined
                        )
                    )
                })
            case ActionType.PlaceTrack: {
                const [railroadId, spaceId] = this.pick(this.placements(hydrated, playerId))
                return action(PlaceTrack, state, { playerId, railroadId, spaceId })
            }
            case ActionType.ScrapTrack:
                return action(ScrapTrack, state, {
                    playerId,
                    railroadId: this.pick(
                        (hydrated.turn?.pieces ?? []).filter((railroadId) =>
                            HydratedScrapTrack.canScrapTrack(hydrated, playerId, railroadId)
                        )
                    )
                })
            case ActionType.PayRepairs:
                return action(PayRepairs, state, {
                    playerId,
                    sales: this.saleList(hydrated, playerId)
                })
            case ActionType.EndTurn: {
                const { fourPieceVariant } = normalizePromontoryPointConfig(game.config)
                const hasLeftover = (hydrated.turn?.pieces.length ?? 0) > 0
                return action(EndTurn, state, {
                    playerId,
                    returnKeptPiece:
                        fourPieceVariant && hasLeftover ? this.prng.random() < 0.5 : undefined
                })
            }
            default:
                throw new Error(`No seeded choice for ${type}`)
        }
    }

    private placements(
        state: HydratedPromontoryPointGameState,
        playerId: string
    ): [RailroadId, SpaceId][] {
        return (state.turn?.pieces ?? []).flatMap((railroadId) =>
            openSpaceIds(state.track, railroadId)
                .filter((spaceId) =>
                    HydratedPlaceTrack.canPlaceTrack(state, playerId, railroadId, spaceId)
                )
                .map((spaceId): [RailroadId, SpaceId] => [railroadId, spaceId])
        )
    }

    // R-4.3-H2, R-4.3-H3: shares sold in a random order until the list is legal.
    private saleList(state: HydratedPromontoryPointGameState, playerId: string): RailroadId[] {
        const debtor = state.pendingRepairs?.debtors[0]
        assertExists(debtor, 'A Repairs waits on its first debtor')
        const player = state.getPlayerState(playerId)
        const held = RAILROAD_IDS.flatMap((railroadId) =>
            Array.from({ length: player.shares[railroadId] }, () => railroadId)
        )
        const sales: RailroadId[] = []
        while (saleListRefusal(player, debtor.owed, state.priceIndex, sales) !== undefined) {
            const [sold] = held.splice(this.prng.randInt(held.length), 1)
            assertExists(sold, 'A legal sale list sells no more than every share held')
            sales.push(sold)
        }
        return sales
    }

    private pick<Choice>(choices: readonly Choice[]): Choice {
        const choice = choices[this.prng.randInt(choices.length)]
        assertExists(choice, 'The seat has a legal choice')
        return choice
    }
}
