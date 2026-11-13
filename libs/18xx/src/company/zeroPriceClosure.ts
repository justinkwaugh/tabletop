import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { RoundEnd } from '../ending/roundEnd.js'
import { operatingRoundEnd } from '../operating/operatingRoundSnapshot.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { endOperatingTurn } from '../operating/finishOperatingTurn.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import { CompanyClosure } from './companyClosure.js'
import type { Debt } from '../funding/cashCrisis.js'

const CashCrisisState = 'RaisingCash'

/**
 * A corporation whose price reaches the market's zero closes at once (1846 and 1833NE §8). The
 * title closes it and records what went with it beyond the family's closure.
 */
export interface ZeroPriceClosureRules<Closure extends Type.TObject = typeof CompanyClosure> {
    market: StockMarketChart
    closure: {
        schema: Closure
        close(state: HydratedEighteenXXState, companyId: string): Type.Static<Closure>
        /**
         * What the closure leaves players owing the bank, raised in a cash crisis before play
         * goes on, as 1849's president raises a closing corporation's bond (§14.2).
         */
        debts?(closure: Type.Static<Closure>): readonly Debt[]
    }
}

/**
 * Where play goes after a closure: to raise what it left owing first, the crisis then resuming
 * play where it was going.
 */
function afterClosure(
    state: HydratedEighteenXXState,
    rules: ZeroPriceClosureRules,
    closure: CloseCorporation['metadata'],
    next: string
): string {
    const debts = closure && rules.closure.debts ? rules.closure.debts(closure) : []
    if (!debts.length) return next
    if (state.cashCrisis) state.cashCrisis.debts.push(...debts)
    else state.cashCrisis = { debts: [...debts], continuation: next }
    return CashCrisisState
}

export const ClosingOperatingCorporationState = 'ClosingOperatingCorporation'

export function corporationAwaitingClosure(
    state: Pick<HydratedEighteenXXState, 'companies' | 'stockMarket'>,
    market: StockMarketChart
): string | undefined {
    return state.companies.find(
        (company) =>
            company.kind === 'major' &&
            company.started &&
            !company.closed &&
            market.companySpace(state.stockMarket, company.id).price === 0
    )?.id
}

/** Closes every started corporation whose price has fallen to zero, one at a time. */
export function closeZeroPriceCorporations<Closure>(
    state: Pick<HydratedEighteenXXState, 'companies' | 'stockMarket'>,
    market: StockMarketChart,
    close: (companyId: string) => Closure
): Closure[] {
    const closures: Closure[] = []
    for (
        let closing = corporationAwaitingClosure(state, market);
        closing;
        closing = corporationAwaitingClosure(state, market)
    )
        closures.push(close(closing))
    return closures
}

export type CloseCorporationSchema<Closure extends Type.TProperties = Type.TProperties> =
    Type.TObject<
        Omit<typeof GameAction.properties, 'type' | 'source'> & {
            type: Type.TLiteral<'CloseCorporation'>
            source: Type.TLiteral<ActionSource.System>
            companyId: Type.TString
            metadata: Type.TOptional<
                Type.TObject<Closure & { roundEnd: Type.TOptional<typeof RoundEnd> }>
            >
        }
    >
/** The closure Action, recording the title's closure under the title's own schema. */
export function closeCorporationSchema<Closure extends Type.TProperties>(
    closure: Closure,
    additionalProperties = false
): CloseCorporationSchema<Closure> {
    return Type.Object(
        {
            ...GameAction.properties,
            type: Type.Literal('CloseCorporation'),
            source: Type.Literal(ActionSource.System),
            companyId: Type.String(),
            metadata: Type.Optional(
                Type.Object(
                    { ...closure, roundEnd: Type.Optional(RoundEnd) },
                    { additionalProperties }
                )
            )
        },
        { additionalProperties: false }
    )
}
// Titles add their own closure records beside the family's.
const CloseCorporationBase = closeCorporationSchema(CompanyClosure.properties, true)
export type CloseCorporation = Type.Static<typeof CloseCorporationBase>
const CloseCorporationValidator = Compile(CloseCorporationBase)
export function isCloseCorporation(action: GameAction): action is CloseCorporation {
    return (
        action instanceof HydratedCloseCorporation ||
        (action.type === 'CloseCorporation' && CloseCorporationValidator.Check(action))
    )
}

export class HydratedCloseCorporation extends HydratableAction<typeof CloseCorporationBase> {
    declare companyId: string
    declare metadata?: CloseCorporation['metadata']
    readonly #rules: ZeroPriceClosureRules
    readonly #valuationRules: ValuationRules
    constructor(
        data: CloseCorporation,
        rules: ZeroPriceClosureRules,
        valuationRules: ValuationRules
    ) {
        super(data, CloseCorporationValidator)
        this.#rules = rules
        this.#valuationRules = valuationRules
    }
    awaited(state: HydratedEighteenXXState): boolean {
        return (
            this.source === ActionSource.System &&
            corporationAwaitingClosure(state, this.#rules.market) === this.companyId
        )
    }
    apply(state: HydratedEighteenXXState): void {
        assert(this.awaited(state), 'Only the next zero-price corporation can close')
        const closure = this.#rules.closure.close(state, this.companyId)
        const fundingItsTrain = state.trainFunding?.purchase.companyId === this.companyId
        // A sale raising a company's own debt that closes it ends the debt, its closure settling
        // what it owes, and ends its turn if it is operating.
        const crisis = state.cashCrisis
        const raisingItsDebt = !!crisis?.debts.some((debt) => debt.companyId === this.companyId)
        if (crisis && raisingItsDebt)
            crisis.debts = crisis.debts.filter((debt) => debt.companyId !== this.companyId)
        const raisingInItsTurn =
            raisingItsDebt &&
            !!state.operatingSet &&
            !state.operatingSet.completed &&
            nextOperatingCompany(state) === this.companyId
        if (crisis && raisingInItsTurn) {
            crisis.continuation = 'OperatingSet'
            state.activePlayerIds = formerPresidentIds(closure)
        }
        // Closing on its own turn ends that turn, as does a sale closing the company it funds.
        if (
            state.machineState !== ClosingOperatingCorporationState &&
            !fundingItsTrain &&
            !raisingInItsTurn
        ) {
            this.metadata = closure
            return
        }
        if (fundingItsTrain) {
            delete state.trainFunding
            delete state.trainPurchaseStep
            state.activePlayerIds = formerPresidentIds(closure)
        }
        // A turn the company has just finished, as 1849's last issue may, is already over.
        if (!state.operatingSet?.completedCompanyIds.includes(this.companyId)) {
            if (state.trainPurchaseStep?.companyId === this.companyId)
                delete state.trainPurchaseStep
            endOperatingTurn(state, this.companyId)
        }
        const ended = operatingRoundEnd(state, this.#valuationRules)
        this.metadata = { ...closure, ...(ended ? { roundEnd: ended } : {}) }
    }
}

/** The player who presided over a closed company, as the owner of its ended turn. */
function formerPresidentIds(closure: { president?: CompanyClosure['president'] }): string[] {
    return closure.president?.kind === 'player' ? [closure.president.playerId] : []
}

export function zeroPriceClosureActions(
    rules: ZeroPriceClosureRules,
    valuationRules: ValuationRules
): ActionDefinition[] {
    const schema = closeCorporationSchema(rules.closure.schema.properties)
    const validator = Compile(schema)
    return [
        defineAction(
            schema,
            (action): action is CloseCorporation =>
                action.type === 'CloseCorporation' && validator.Check(action),
            (data) => new HydratedCloseCorporation(data, rules, valuationRules)
        )
    ]
}

type State = HydratedGameState & HydratedEighteenXXState

/**
 * Closes zero-price corporations before a step goes on: their closures come first, then the
 * step resumes where the title says.
 */
export class ZeroPriceClosureHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, S>,
        private readonly rules: ZeroPriceClosureRules,
        /** Where the step goes once no closure is pending: after the closure, or the step's own next. */
        private readonly resume: (state: S, next?: string) => string,
        /** Keeps where the step's action was going while the closures it caused come first. */
        private readonly holds?: (state: S, next: string) => void
    ) {}
    private awaiting(state: S): string | undefined {
        return corporationAwaitingClosure(state, this.rules.market)
    }
    enter(context: MachineContext<S>): void {
        const companyId = this.awaiting(context.gameState)
        if (companyId) context.addSystemAction(CloseCorporationBase, { companyId })
        else this.handler.enter(context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<S>): string[] {
        return this.awaiting(context.gameState)
            ? []
            : this.handler.validActionsForPlayer(playerId, context)
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        if (action instanceof HydratedCloseCorporation) return action.awaited(context.gameState)
        return !this.awaiting(context.gameState) && this.handler.isValidAction(action, context)
    }
    onAction(action: HydratedAction, context: MachineContext<S>): string {
        const state = context.gameState
        if (action instanceof HydratedCloseCorporation)
            return afterClosure(
                state,
                this.rules,
                action.metadata,
                this.awaiting(state) ? state.machineState : this.resume(state)
            )
        const next = this.handler.onAction(action, context)
        if (!this.awaiting(state)) return this.resume(state, next)
        this.holds?.(state, next)
        return state.machineState
    }
}

/** A step whose closures, of other companies, leave it to go on as it was. */
export function closesAtZeroInPlace<S extends State>(
    handler: MachineStateHandler<HydratedAction, S>,
    rules: ZeroPriceClosureRules
): MachineStateHandler<HydratedAction, S> {
    return new ZeroPriceClosureHandler(handler, rules, (state, next) => next ?? state.machineState)
}

/** A corporation that closed in its own turn: its turn ends and the operating set goes on. */
export class ClosingOperatingCorporationHandler<S extends State> implements MachineStateHandler<
    HydratedAction,
    S
> {
    constructor(private readonly rules: ZeroPriceClosureRules) {}
    enter(context: MachineContext<S>): void {
        const companyId = corporationAwaitingClosure(context.gameState, this.rules.market)
        assertExists(companyId, 'Closure requires a zero-price corporation')
        context.addSystemAction(CloseCorporationBase, { companyId })
    }
    validActionsForPlayer(): string[] {
        return []
    }
    isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
        return action instanceof HydratedCloseCorporation && action.awaited(context.gameState)
    }
    onAction(action: HydratedAction, { gameState }: MachineContext<S>): string {
        assert(action instanceof HydratedCloseCorporation, 'Closure requires its system action')
        // Its president stays the turn's owner, as after any ended turn, should no company follow.
        assertExists(action.metadata, 'A closure records what it closed')
        gameState.activePlayerIds = formerPresidentIds(action.metadata)
        return afterClosure(gameState, this.rules, action.metadata, 'OperatingSet')
    }
}
