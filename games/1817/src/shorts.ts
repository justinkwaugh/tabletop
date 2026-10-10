import type {
    HydratedEighteenSeventeenState,
    EighteenSeventeenStateHandler,
    EighteenSeventeenState
} from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    PlayerAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    canStartStockRound,
    cancelShorts,
    companyMarketSpace,
    ordinaryShares,
    getCompany,
    openShort,
    openShorts,
    recordStockAction,
    settleCashPayments,
    sharesOwned,
    type FinancialState,
    type OpenShare,
    SystemActionFirstHandler
} from '@tabletop/18xx'
import { inClosingZone } from './marketZones.js'
import { EighteenSeventeenStockRoundRules, MarketPoolId, treasuryPoolId } from './roundRules.js'
import { eighteenSeventeenOptions } from './state.js'

const NoShortsPhase = '8'
const FiveShorts = 5

export function marketPool(state: Pick<FinancialState, 'certificatePools'>) {
    const market = state.certificatePools.find((pool) => pool.id === MarketPoolId)
    assertExists(market, '1817 has a market pool')
    return market
}

export function shortReason(
    state: EighteenSeventeenState,
    playerId: string,
    companyId: string
): string | undefined {
    const turn = state.stockRound.turn
    if (
        state.machineState !== 'StockRound' ||
        state.companyAuction ||
        !state.activePlayerIds.includes(playerId)
    )
        return 'It is not this player’s stock turn.'
    if (turn.bought || turn.shorted || turn.corporateAction)
        return 'A short must come before any purchase, once a turn.'
    const company = getCompany(state, companyId)
    if (!company.shareCount || company.shareCount <= 2 || !company.floated || !company.operated)
        return 'Only an operated company of more than two shares can be shorted.'
    if (state.phaseId === NoShortsPhase) return 'No shorts can be opened in phase 8.'
    if (inClosingZone(state.stockMarket, companyId))
        return 'Companies in the acquisition or liquidation zone cannot be shorted.'
    if (sharesOwned(state, companyId, { kind: 'player', playerId }) > 0)
        return 'A player holding shares of a company cannot short it.'
    const shorts = openShorts(state, companyId).length
    if (
        shorts >= company.shareCount ||
        (eighteenSeventeenOptions(state).fiveShorts && shorts >= FiveShorts)
    )
        return 'This company has as many shorts as it may.'
    return undefined
}

export function shortOptions(
    state: EighteenSeventeenState,
    playerId: string
): { companyId: string; price: number }[] {
    return state.companies
        .filter(
            (company) =>
                company.kind !== 'private' &&
                company.started &&
                !shortReason(state, playerId, company.id)
        )
        .map((company) => ({
            companyId: company.id,
            price: companyMarketSpace(state.stockMarket, company.id).price
        }))
}

export const ShortShare = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('ShortShare'),
        companyId: Type.String(),
        expectedPrice: Type.Integer({ minimum: 1 }),
        metadata: Type.Optional(
            Type.Object(
                { shareId: Type.String(), shortId: Type.String(), payment: CashPayment },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type ShortShare = Type.Static<typeof ShortShare>
const ShortValidator = Compile(ShortShare)
export function isShortShare(action: GameAction): action is ShortShare {
    return (
        action instanceof HydratedShortShare ||
        (action.type === 'ShortShare' && ShortValidator.Check(action))
    )
}

export class HydratedShortShare extends HydratableAction<typeof ShortShare> implements ShortShare {
    declare type: 'ShortShare'
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    declare metadata?: ShortShare['metadata']
    constructor(data: ShortShare) {
        super(data instanceof HydratedShortShare ? data.dehydrate() : data, ShortValidator)
    }
    isValidFor(state: EighteenSeventeenState): boolean {
        return (
            !shortReason(state, this.playerId, this.companyId) &&
            companyMarketSpace(state.stockMarket, this.companyId).price === this.expectedPrice
        )
    }
    apply(state: HydratedGameState & EighteenSeventeenState): void {
        assert(
            this.source === ActionSource.User && this.isValidFor(state),
            shortReason(state, this.playerId, this.companyId) ?? 'The share price has changed'
        )
        const player = { kind: 'player' as const, playerId: this.playerId }
        const { shareId, shortId } = openShort(state, this.companyId, player, marketPool(state))
        const payment = { from: { kind: 'bank' as const }, to: player, amount: this.expectedPrice }
        settleCashPayments(state, [payment])
        state.stockRound.sales.push({ owner: player, companyId: this.companyId })
        state.stockRound.turn.shorted = true
        recordStockAction(state, this.playerId, EighteenSeventeenStockRoundRules)
        this.metadata = { shareId, shortId, payment }
    }
}

export class ShortSellingHandler implements EighteenSeventeenStateHandler {
    constructor(private readonly handler: EighteenSeventeenStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): boolean {
        return action instanceof HydratedShortShare
            ? action.source === ActionSource.User && action.isValidFor(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return actions.includes('FinishStockTurn') &&
            shortOptions(context.gameState, playerId).length
            ? [...actions, 'ShortShare']
            : actions
    }
    enter(context: MachineContext<HydratedEighteenSeventeenState>): void {
        this.handler.enter(context)
    }
    onAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenSeventeenState>
    ): string {
        return isShortShare(action) ? 'StockRound' : this.handler.onAction(action, context)
    }
}

/** After any sale, the market closes its shorts against its own shares. */
export function closeMarketShortsAgainstPool(state: FinancialState): void {
    const market = marketPool(state)
    for (const company of state.companies) cancelShorts(state, company.id, market.owner)
}

/**
 * The company whose market shorts the bank closes as a stock round begins, by buying its
 * treasury shares for the market, outside the closing zones.
 */
function marketShortToBuyOut(state: EighteenSeventeenState): string | undefined {
    if (!canStartStockRound(state)) return undefined
    const market = marketPool(state)
    return state.companies.find(
        (company) =>
            openShorts(state, company.id, market.owner).length > 0 &&
            !inClosingZone(state.stockMarket, company.id) &&
            treasuryShares(state, company.id).length > 0
    )?.id
}

function treasuryShares(state: EighteenSeventeenState, companyId: string): OpenShare[] {
    return ordinaryShares(state, companyId).filter(
        (share) => share.poolId === treasuryPoolId(companyId)
    )
}

const CloseFields = Type.Object({
    type: Type.Literal('CloseMarketShorts'),
    companyId: Type.String(),
    metadata: Type.Optional(
        Type.Object(
            { closed: Type.Integer({ minimum: 1 }), payments: Type.Array(CashPayment) },
            { additionalProperties: false }
        )
    )
})
export const CloseMarketShorts: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CloseFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CloseFields.properties },
    { additionalProperties: false }
)
export type CloseMarketShorts = Type.Static<typeof CloseMarketShorts>
const CloseValidator = Compile(CloseMarketShorts)
export function isCloseMarketShorts(action: GameAction): action is CloseMarketShorts {
    return (
        action instanceof HydratedCloseMarketShorts ||
        (action.type === 'CloseMarketShorts' && CloseValidator.Check(action))
    )
}

export class HydratedCloseMarketShorts
    extends HydratableAction<typeof CloseMarketShorts>
    implements CloseMarketShorts
{
    declare type: 'CloseMarketShorts'
    declare companyId: string
    declare metadata?: CloseMarketShorts['metadata']
    constructor(data: CloseMarketShorts) {
        super(data instanceof HydratedCloseMarketShorts ? data.dehydrate() : data, CloseValidator)
    }
    apply(state: HydratedGameState & EighteenSeventeenState): void {
        assert(
            this.source === ActionSource.System && marketShortToBuyOut(state) === this.companyId,
            'The bank closes the market’s shorts as a stock round begins'
        )
        const market = marketPool(state)
        const shorts = openShorts(state, this.companyId, market.owner).length
        const price = companyMarketSpace(state.stockMarket, this.companyId).price
        const bought = treasuryShares(state, this.companyId).slice(0, shorts)
        const payments = bought.map(() => ({
            from: { kind: 'bank' as const },
            to: { kind: 'company' as const, companyId: this.companyId },
            amount: price
        }))
        settleCashPayments(state, payments)
        for (const share of bought) {
            share.owner = { ...market.owner }
            share.poolId = market.id
        }
        this.metadata = {
            closed: cancelShorts(state, this.companyId, market.owner),
            payments
        }
    }
}

export function buysOutMarketShorts(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new SystemActionFirstHandler(handler, CloseMarketShorts, (state) => {
        const companyId = marketShortToBuyOut(state)
        return companyId ? { companyId } : undefined
    })
}
