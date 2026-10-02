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
    cancelShorts,
    companyMarketSpace,
    getCompany,
    openShort,
    openShorts,
    recordStockAction,
    settleCashPayments,
    sharesOwned,
    type EighteenXXState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState,
    type OpenShare
} from '@tabletop/18xx'
import { inClosingZone } from './marketZones.js'
import { EighteenSeventeenStockRoundRules, MarketPoolId, treasuryPoolId } from './roundRules.js'
import { SystemActionFirstHandler } from './systemActionFirstHandler.js'

const NoShortsPhase = '8'
const FiveShorts = 5

export function marketPool(state: EighteenXXState) {
    const market = state.certificatePools.find((pool) => pool.id === MarketPoolId)
    assertExists(market, '1817 has a market pool')
    return market
}

export function shortReason(
    state: EighteenXXState,
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
    if (shorts >= company.shareCount || ('fiveShorts' in state && shorts >= FiveShorts))
        return 'This company has as many shorts as it may.'
    return undefined
}

export function shortableCompanyIds(state: EighteenXXState, playerId: string): string[] {
    return state.companies
        .filter(
            (company) =>
                company.kind !== 'private' &&
                company.started &&
                !shortReason(state, playerId, company.id)
        )
        .map((company) => company.id)
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
    isValidFor(state: EighteenXXState): boolean {
        return (
            !shortReason(state, this.playerId, this.companyId) &&
            companyMarketSpace(state.stockMarket, this.companyId).price === this.expectedPrice
        )
    }
    apply(state: HydratedGameState & EighteenXXState): void {
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

/** Lets a player short a company in their stock turn. */
export class ShortSellingHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        return action instanceof HydratedShortShare
            ? action.source === ActionSource.User && action.isValidFor(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        const actions = this.handler.validActionsForPlayer(playerId, context)
        return actions.includes('FinishStockTurn') &&
            shortableCompanyIds(context.gameState, playerId).length
            ? [...actions, 'ShortShare']
            : actions
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return isShortShare(action) ? 'StockRound' : this.handler.onAction(action, context)
    }
}

/**
 * The company whose market shorts can close: against market shares, and in the stock round
 * against treasury shares the bank buys for the market, outside the closing zones.
 */
function marketShortToClose(state: EighteenXXState): string | undefined {
    const market = marketPool(state)
    return state.companies.find((company) => {
        if (
            !openShorts(state, company.id, market.owner).some((short) => short.poolId === market.id)
        )
            return false
        const shares = state.certificates.some(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.companyId === company.id &&
                (certificate.poolId === market.id ||
                    (certificate.poolId === treasuryPoolId(company.id) &&
                        state.machineState === 'StockRound' &&
                        !inClosingZone(state.stockMarket, company.id)))
        )
        return shares
    })?.id
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
    apply(state: HydratedGameState & EighteenXXState): void {
        assert(
            this.source === ActionSource.System && marketShortToClose(state) === this.companyId,
            'The system closes the market’s shorts when it can'
        )
        const market = marketPool(state)
        let closed = cancelShorts(state, this.companyId, market.owner)
        const payments: CashPayment[] = []
        const treasury = state.certificates.filter(
            (certificate): certificate is OpenShare =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === this.companyId &&
                certificate.poolId === treasuryPoolId(this.companyId)
        )
        const remaining = openShorts(state, this.companyId, market.owner).length
        if (remaining && state.machineState === 'StockRound') {
            const price = companyMarketSpace(state.stockMarket, this.companyId).price
            for (const certificate of treasury.slice(0, remaining)) {
                payments.push({
                    from: { kind: 'bank' },
                    to: { kind: 'company', companyId: this.companyId },
                    amount: price
                })
                certificate.owner = { ...market.owner }
                certificate.poolId = market.id
            }
            settleCashPayments(state, payments)
            closed += cancelShorts(state, this.companyId, market.owner)
        }
        this.metadata = { closed, payments }
    }
}

/** Closes the market's shorts before anything else happens in the stock round. */
export function closesMarketShorts(handler: EighteenXXStateHandler): EighteenXXStateHandler {
    return new SystemActionFirstHandler(handler, CloseMarketShorts, (state) => {
        const companyId = marketShortToClose(state)
        return companyId ? { companyId } : undefined
    })
}
