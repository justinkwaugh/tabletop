import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    PlayerAction,
    assert,
    assertExists,
    type GameAction,
    type HydratedAction
} from '@tabletop/common'
import {
    CashPayment,
    ConstructionReachability,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    privateOwningCompany,
    settleCashPayments,
    type FinancialState,
    stepAction
} from '@tabletop/18xx'
import type { TitleStepAction } from './titleActions.js'
import { CoalFieldsLocationId } from './coalAccess.js'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from './state.js'
import { eighteenThirtyTwoMapState } from './tileState.js'
import { inGame, type EighteenThirtyTwoTitleState } from './titleState.js'
import { EighteenThirtyTwoTrackRules } from './trackRules.js'

export const CoalFieldsPrivateId = 'P5'
export const CoalTokens = 5
const CoalTokenPrice = 80

/**
 * A company buying the coal fields private takes a free WVCF token, which it keeps when the
 * private closes (§16.2 P5).
 */
export function grantCoalRightsToBuyer(
    state: FinancialState & EighteenThirtyTwoTitleState,
    companyId: string
): void {
    if (!state.coalRights.includes(companyId)) state.coalRights.push(companyId)
}

/** Who receives a WVCF token's price: half to the company owning the open private (§6.5.2). */
export function coalTokenPayments(state: FinancialState, companyId: string): CashPayment[] {
    const from = { kind: 'company', companyId } as const
    const owner = inGame(state, CoalFieldsPrivateId)
        ? privateOwningCompany(state, CoalFieldsPrivateId)
        : undefined
    return owner
        ? [
              { from, to: { kind: 'company', companyId: owner }, amount: CoalTokenPrice / 2 },
              { from, to: { kind: 'bank' }, amount: CoalTokenPrice / 2 }
          ]
        : [{ from, to: { kind: 'bank' }, amount: CoalTokenPrice }]
}

/**
 * Whether the operating company may buy a WVCF token now: the private is company-owned or
 * closed, a token remains, its track reaches the coal fields, it can pay, and buying uses one of
 * its yellow tile lays (§6.5.2, §16.2 P5).
 */
export function canBuyCoalRights(state: EighteenThirtyTwoState, playerId: string): boolean {
    const companyId = state.trackStep?.companyId
    if (
        !companyId ||
        state.machineState !== 'LayingTrack' ||
        state.trackStep?.completed ||
        nextOperatingCompany(state) !== companyId ||
        controllingOwner(state, companyId)?.playerId !== playerId ||
        state.coalRights.includes(companyId) ||
        state.coalRights.length >= CoalTokens
    )
        return false
    if (
        inGame(state, CoalFieldsPrivateId) &&
        !getCompany(state, CoalFieldsPrivateId).closed &&
        !privateOwningCompany(state, CoalFieldsPrivateId)
    )
        return false
    if ('reason' in EighteenThirtyTwoTrackRules.allowance(state, 'yellow', false)) return false
    if (finiteCashOwnedBy(state, { kind: 'company', companyId }) < CoalTokenPrice) return false
    return new ConstructionReachability(
        eighteenThirtyTwoMapState(state),
        state,
        companyId
    ).canReach(CoalFieldsLocationId)
}

export const BuyCoalRights = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyCoalRights'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type BuyCoalRights = Type.Static<typeof BuyCoalRights>
const Validator = Compile(BuyCoalRights)
export function isBuyCoalRights(action: GameAction): action is BuyCoalRights {
    return (
        action instanceof HydratedBuyCoalRights ||
        (action.type === 'BuyCoalRights' && Validator.Check(action))
    )
}

export class HydratedBuyCoalRights
    extends HydratableAction<typeof BuyCoalRights>
    implements BuyCoalRights
{
    declare type: 'BuyCoalRights'
    declare playerId: string
    declare companyId: string
    declare metadata?: BuyCoalRights['metadata']
    constructor(data: BuyCoalRights) {
        super(data instanceof HydratedBuyCoalRights ? data.dehydrate() : data, Validator)
    }
    isValid(state: HydratedEighteenThirtyTwoState): boolean {
        return (
            this.source === ActionSource.User &&
            state.trackStep?.companyId === this.companyId &&
            canBuyCoalRights(state, this.playerId)
        )
    }
    apply(state: HydratedEighteenThirtyTwoState): void {
        assert(this.isValid(state), 'The company cannot buy a WVCF token now')
        const set = state.operatingSet
        assertExists(set, 'WVCF tokens are bought during an operating round')
        const payments = coalTokenPayments(state, this.companyId)
        settleCashPayments(state, payments)
        state.coalRights.push(this.companyId)
        state.coalPurchase = {
            companyId: this.companyId,
            turn: { set: set.number, round: set.roundNumber }
        }
        this.metadata = { payments }
    }
}

export const BuyCoalRightsStep: TitleStepAction = stepAction(
    'BuyCoalRights',
    (action: HydratedAction) => action instanceof HydratedBuyCoalRights,
    canBuyCoalRights
)
