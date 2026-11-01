import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedRoundManager,
    HydratedTurnManager,
    PrngState,
    RoundManager,
    Visibility,
    assertExists,
    type RandomState
} from '@tabletop/common'
import { ContestAward } from '../components/messages.js'
import {
    demandRange,
    marketBoardFor,
    type DemandRange,
    type MarketBoardId
} from '../components/marketBoards.js'
import { MarketId, Quality, marketId, type Variety } from '../components/potatoes.js'
import { MachineState } from '../definition/states.js'
import { HydratedMessageBoard, MessageBoard } from './messageDeck.js'
import { DickeKartoffelnPlayerState, HydratedDickeKartoffelnPlayerState } from './playerState.js'

// Demand is the lower bound of the demand row the marker rests on, in sacks; price is in marks.
export type MarketState = Type.Static<typeof MarketState>
export const MarketState = Type.Object({
    id: Type.Enum(MarketId),
    demand: Type.Number(),
    price: Type.Number()
})

// A ministry contest announced by a message, decided by the sales of the year it names.
export type Contest = Type.Static<typeof Contest>
export const Contest = Type.Object({
    award: Type.Enum(ContestAward),
    year: Type.Number()
})

export type Standing = Type.Static<typeof Standing>
export const Standing = Type.Object({
    playerId: Type.String(),
    economy: Type.Number(),
    ecology: Type.Number(),
    economyPoints: Type.Number(),
    ecologyPoints: Type.Number(),
    points: Type.Number()
})

export type DickeKartoffelnGameState = Type.Static<typeof DickeKartoffelnGameState>
export const DickeKartoffelnGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(DickeKartoffelnPlayerState),
            machineState: Type.Enum(MachineState),
            years: RoundManager,
            markets: Type.Array(MarketState),
            messages: Type.Optional(MessageBoard),
            contests: Type.Array(Contest),
            standings: Type.Optional(Type.Array(Standing))
        })
    ])
)

export const DickeKartoffelnGameStateValidator = Compile(DickeKartoffelnGameState)

export const DickeKartoffelnProjectedState =
    Visibility.createProjectionSchema(DickeKartoffelnGameState)
export type DickeKartoffelnProjectedState = Type.Static<typeof DickeKartoffelnProjectedState>
export const DickeKartoffelnProjectedStateValidator = Compile(DickeKartoffelnProjectedState)

export class HydratedDickeKartoffelnGameState
    extends HydratableGameState<
        typeof DickeKartoffelnProjectedState,
        HydratedDickeKartoffelnPlayerState
    >
    implements DickeKartoffelnProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare protectedPrng?: RandomState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedDickeKartoffelnPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare years: HydratedRoundManager
    declare markets: MarketState[]
    declare messages?: HydratedMessageBoard
    declare contests: Contest[]
    declare standings?: Standing[]

    constructor(data: DickeKartoffelnProjectedState) {
        super(data, DickeKartoffelnProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedDickeKartoffelnPlayerState(player))
        this.years = new HydratedRoundManager(data.years)
        if (data.messages) {
            this.messages = new HydratedMessageBoard(data.messages)
        }
    }

    year(): number {
        const year = this.years.currentRound?.number
        assertExists(year, 'No farming year in progress')
        return year
    }

    marketBoard(): MarketBoardId {
        return marketBoardFor(this.players.length)
    }

    market(id: MarketId): MarketState {
        const market = this.markets.find((candidate) => candidate.id === id)
        assertExists(market, `Unknown market ${id}`)
        return market
    }

    price(id: MarketId): number {
        return this.market(id).price
    }

    demand(id: MarketId): DemandRange {
        return demandRange(this.marketBoard(), this.market(id).demand)
    }

    // Seed is bought at the NORM price of its variety.
    seedPrice(variety: Variety): number {
        return this.price(marketId(variety, Quality.Norm))
    }

    messageBoard(): HydratedMessageBoard {
        assertExists(this.messages, 'This game is played without messages')
        return this.messages
    }
}
