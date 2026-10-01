import {
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { MarketColor } from '../definition/marketColor.js'
import { AntiqueDeck, HydratedAntiqueDeck } from '../components/antiques.js'
import { FountainIds, ShopIds, type FountainId, type ShopId } from '../components/board.js'
import { HydratedMarracashPlayerState, MarracashPlayerState } from './playerState.js'

export type ShopState = Type.Static<typeof ShopState>
export const ShopState = Type.Object({
    shopId: Type.Enum(ShopIds),
    ownerId: Type.Optional(Type.String()),
    customers: Type.Number()
})

export type FountainState = Type.Static<typeof FountainState>
export const FountainState = Type.Object({
    fountainId: Type.Enum(FountainIds),
    visitors: Type.Array(Type.Enum(MarketColor))
})

export type MarracashGameState = Type.Static<typeof MarracashGameState>
export const MarracashGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(MarracashPlayerState),
            machineState: Type.Enum(MachineState),
            shops: Type.Array(ShopState),
            fountains: Type.Array(FountainState),
            queue: Type.Array(Type.Enum(MarketColor)),
            antiqueDeck: AntiqueDeck
        })
    ])
)

export const MarracashGameStateValidator = Compile(MarracashGameState)

export const MarracashProjectedState = Visibility.createProjectionSchema(MarracashGameState)
export type MarracashProjectedState = Type.Static<typeof MarracashProjectedState>
const MarracashProjectedStateValidator = Compile(MarracashProjectedState)

export class HydratedMarracashGameState extends HydratableGameState<
    typeof MarracashProjectedState,
    HydratedMarracashPlayerState
> {
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMarracashPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare shops: ShopState[]
    declare fountains: FountainState[]
    declare queue: MarketColor[]
    declare antiqueDeck: HydratedAntiqueDeck

    constructor(data: MarracashProjectedState) {
        super(data, MarracashProjectedStateValidator)

        this.players = data.players.map((player) => new HydratedMarracashPlayerState(player))
        this.antiqueDeck = new HydratedAntiqueDeck(data.antiqueDeck)
    }

    getShopState(shopId: ShopId): ShopState {
        const shop = this.shops.find((candidate) => candidate.shopId === shopId)
        assertExists(shop, `No state for shop ${shopId}`)
        return shop
    }

    getFountainState(fountainId: FountainId): FountainState {
        const fountain = this.fountains.find((candidate) => candidate.fountainId === fountainId)
        assertExists(fountain, `No state for fountain ${fountainId}`)
        return fountain
    }
}
