import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState
} from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import {
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    type FinancialState
} from '../finance/finance.js'
import { stepAction, type StepAction } from '../game/stepAction.js'
import { RailwayMapState } from '../map/mapState.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { privateOwningCompany } from '../privates/privateCompany.js'
import type { RevenueCenter } from '../routes/route.js'
import { ConstructionReachability } from './constructionReachability.js'
import type { ConstructionState, TrackRules } from './trackConstruction.js'

type StopRightsState = FinancialState &
    OperatingState &
    ConstructionState & { machineState: string }

/**
 * A printed stop only companies holding one of a few tokens may run to or through, as in 1832's
 * coal fields and 1850's Mesabi Range. Title rules that route or build read ``open``.
 */
export class StopAccess {
    constructor(
        private readonly rules: {
            locationId: string
            tokens: number
            holders(state: object): string[]
        }
    ) {}

    get locationId(): string {
        return this.rules.locationId
    }

    readonly open = (state: object, companyId: string, center: RevenueCenter): boolean =>
        center.locationId !== this.rules.locationId || this.rules.holders(state).includes(companyId)

    remaining(state: object): number {
        return this.rules.tokens - this.rules.holders(state).length
    }

    holds(state: object, companyId: string): boolean {
        return this.rules.holders(state).includes(companyId)
    }

    /** The token a company takes, by buying one or by buying the stop's private. */
    grant(state: object, companyId: string): void {
        const holders = this.rules.holders(state)
        if (!holders.includes(companyId)) holders.push(companyId)
    }
}

export type StopRightsRules = {
    access: StopAccess
    /** The private whose owning company takes half the price of each token sold. */
    privateCompanyId: string
    price: number
    track: Pick<TrackRules, 'map' | 'tileSet' | 'allowance'>
}

/** Buying a token, with a yellow tile lay, once a company owns the stop's private or it has closed. */
export class StopRights {
    constructor(private readonly rules: StopRightsRules) {}

    get access(): StopAccess {
        return this.rules.access
    }

    get price(): number {
        return this.rules.price
    }

    payments(state: FinancialState, companyId: string): CashPayment[] {
        const { privateCompanyId, price } = this.rules
        const from = { kind: 'company', companyId } as const
        const owner = this.privateOpen(state)
            ? privateOwningCompany(state, privateCompanyId)
            : undefined
        return owner
            ? [
                  { from, to: { kind: 'company', companyId: owner }, amount: price / 2 },
                  { from, to: { kind: 'bank' }, amount: price / 2 }
              ]
            : [{ from, to: { kind: 'bank' }, amount: price }]
    }

    canBuy(state: StopRightsState, playerId: string): boolean {
        const { access, price, privateCompanyId, track } = this.rules
        const companyId = state.trackStep?.companyId
        if (
            !companyId ||
            state.machineState !== 'LayingTrack' ||
            state.trackStep?.completed ||
            nextOperatingCompany(state) !== companyId ||
            controllingOwner(state, companyId)?.playerId !== playerId ||
            access.holds(state, companyId) ||
            access.remaining(state) <= 0
        )
            return false
        if (this.privateOpen(state) && !privateOwningCompany(state, privateCompanyId)) return false
        if ('reason' in track.allowance(state, 'yellow', false)) return false
        if (finiteCashOwnedBy(state, { kind: 'company', companyId }) < price) return false
        return new ConstructionReachability(
            new RailwayMapState(track.map, track.tileSet, state.tileInventory),
            state,
            companyId
        ).canReach(access.locationId)
    }

    private privateOpen(state: FinancialState): boolean {
        const { privateCompanyId } = this.rules
        return (
            state.companies.some((company) => company.id === privateCompanyId) &&
            !getCompany(state, privateCompanyId).closed
        )
    }
}

export const BuyStopRights = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        type: Type.Literal('BuyStopRights'),
        companyId: Type.String(),
        metadata: Type.Optional(
            Type.Object({ payments: Type.Array(CashPayment) }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type BuyStopRights = Type.Static<typeof BuyStopRights>
const Validator = Compile(BuyStopRights)
export function isBuyStopRights(action: GameAction): action is BuyStopRights {
    return (
        action instanceof HydratedBuyStopRights ||
        (action.type === 'BuyStopRights' && Validator.Check(action))
    )
}

type AfterPurchase<State> = (state: State) => void

export class HydratedBuyStopRights<State extends HydratedGameState & StopRightsState>
    extends HydratableAction<typeof BuyStopRights>
    implements BuyStopRights
{
    declare type: 'BuyStopRights'
    declare playerId: string
    declare companyId: string
    declare metadata?: BuyStopRights['metadata']
    readonly #rights: StopRights
    readonly #afterPurchase: AfterPurchase<State>
    constructor(data: BuyStopRights, rights: StopRights, afterPurchase: AfterPurchase<State>) {
        super(data instanceof HydratedBuyStopRights ? data.dehydrate() : data, Validator)
        this.#rights = rights
        this.#afterPurchase = afterPurchase
    }
    isValid(state: State): boolean {
        return (
            this.source === ActionSource.User &&
            state.trackStep?.companyId === this.companyId &&
            this.#rights.canBuy(state, this.playerId)
        )
    }
    apply(state: State): void {
        assert(this.isValid(state), 'The company cannot buy that right now')
        const payments = this.#rights.payments(state, this.companyId)
        settleCashPayments(state, payments)
        this.#rights.access.grant(state, this.companyId)
        this.#afterPurchase(state)
        this.metadata = { payments }
    }
}

export function stopRightsPurchase<State extends HydratedGameState & StopRightsState>(
    rights: StopRights,
    afterPurchase: AfterPurchase<State>
): { action: ActionDefinition; step: StepAction<State> } {
    return {
        action: defineAction(
            BuyStopRights,
            isBuyStopRights,
            (action) => new HydratedBuyStopRights<State>(action, rights, afterPurchase)
        ),
        step: stepAction(
            'BuyStopRights',
            (action: HydratedAction): action is HydratedBuyStopRights<State> =>
                action instanceof HydratedBuyStopRights,
            (state: State, playerId) => rights.canBuy(state, playerId)
        )
    }
}
