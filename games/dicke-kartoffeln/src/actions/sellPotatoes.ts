import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { CONTEST_PRIZE, ContestAward } from '../components/messages.js'
import { MARKET_IDS, MarketId, Quality, marketDefinition } from '../components/potatoes.js'
import { ActionType } from '../definition/actions.js'
import type { Contest, HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { sacksOffered } from '../model/market.js'
import type { HydratedDickeKartoffelnPlayerState } from '../model/playerState.js'

export type MarketSale = Type.Static<typeof MarketSale>
export const MarketSale = Type.Object({
    marketId: Type.Enum(MarketId),
    sacks: Type.Number(),
    price: Type.Number()
})

export type FarmSale = Type.Static<typeof FarmSale>
export const FarmSale = Type.Object({
    playerId: Type.String(),
    sales: Type.Array(MarketSale),
    income: Type.Number()
})

export type ContestResult = Type.Static<typeof ContestResult>
export const ContestResult = Type.Object({
    award: Type.Enum(ContestAward),
    winnerIds: Type.Array(Type.String()),
    prize: Type.Number()
})

export type SellPotatoesMetadata = Type.Static<typeof SellPotatoesMetadata>
export const SellPotatoesMetadata = Type.Object({
    farms: Type.Array(FarmSale),
    contests: Type.Array(ContestResult)
})

export type SellPotatoes = Type.Static<typeof SellPotatoes>
export const SellPotatoes = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.SellPotatoes),
            metadata: Type.Optional(SellPotatoesMetadata)
        })
    ])
)

export const SellPotatoesValidator = Compile(SellPotatoes)

export function isSellPotatoes(action?: GameAction): action is SellPotatoes {
    return action?.type === ActionType.SellPotatoes
}

export class HydratedSellPotatoes
    extends HydratableAction<typeof SellPotatoes>
    implements SellPotatoes
{
    declare type: ActionType.SellPotatoes
    declare metadata?: SellPotatoesMetadata

    constructor(data: SellPotatoes) {
        super(data, SellPotatoesValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        const farms = state.players.map((player) => sell(state, player))
        const year = state.year()
        const decided = state.contests.filter((contest) => contest.year === year)
        state.contests = state.contests.filter((contest) => contest.year !== year)
        this.metadata = {
            farms,
            contests: decided.map((contest) => awardContest(state, contest, farms))
        }
    }
}

function sell(
    state: HydratedDickeKartoffelnGameState,
    player: HydratedDickeKartoffelnPlayerState
): FarmSale {
    const sales = MARKET_IDS.map((marketId) => ({
        marketId,
        sacks: player.fields.reduce((sum, field) => sum + sacksOffered(field, marketId), 0),
        price: state.price(marketId)
    })).filter((sale) => sale.sacks > 0)
    const income = sales.reduce((sum, sale) => sum + sale.sacks * sale.price, 0)
    player.cash += income
    return { playerId: player.playerId, sales, income }
}

// The farmer who sold the most sacks wins the prize; tied farmers share it.
function awardContest(
    state: HydratedDickeKartoffelnGameState,
    contest: Contest,
    farms: FarmSale[]
): ContestResult {
    const counts = farms.map((farm) => ({
        playerId: farm.playerId,
        sacks: farm.sales
            .filter(
                (sale) =>
                    contest.award === ContestAward.MostSacks ||
                    marketDefinition(sale.marketId).quality === Quality.Bio
            )
            .reduce((sum, sale) => sum + sale.sacks, 0)
    }))
    const most = Math.max(...counts.map((count) => count.sacks))
    const winnerIds =
        most > 0
            ? counts.filter((count) => count.sacks === most).map((count) => count.playerId)
            : []
    const prize = winnerIds.length > 0 ? Math.floor(CONTEST_PRIZE / winnerIds.length) : 0
    for (const playerId of winnerIds) {
        state.getPlayerState(playerId).cash += prize
    }
    return { award: contest.award, winnerIds, prize }
}
