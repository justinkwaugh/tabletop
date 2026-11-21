import {
    SystemActionFirstHandler,
    getCompany,
    inReceivership,
    isDistributeEarnings,
    nextOperatingCompany,
    presidentOf,
    systemAction,
    trainsOwnedBy,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import { ActionSource, assert } from '@tabletop/common'
import * as Type from 'typebox'
import { CompanyIds1860 } from './companies.js'
import { operatingCompanies } from './operating.js'
import type { HydratedState1860, State1860 } from './state.js'
import { Phases1860, SouthernTrainId } from './trains.js'

/** The first 9+5 forms the Southern Railway (Formation of the Southern Railway). */
export function southernFormed(state: Pick<State1860, 'phaseId'>): boolean {
    return Phases1860.isAtLeast(state.phaseId, Phases1860.phaseAfterPurchase('2', SouthernTrainId))
}

const SouthernAction = systemAction('BeginSouthernStockRound', {})
export const BeginSouthernStockRound = SouthernAction.schema
export const isBeginSouthernStockRound = SouthernAction.is

/**
 * From the first stock round after the Southern forms, no track is laid or upgraded, no bases
 * are placed, and halts no longer count (Formation of the Southern Railway).
 */
export class HydratedBeginSouthernStockRound extends SouthernAction.Base {
    apply(state: HydratedState1860): void {
        assert(
            this.source === ActionSource.System &&
                southernFormed(state) &&
                !state.southernStockRound,
            'The Southern’s restrictions begin once, with a stock round'
        )
        state.southernStockRound = true
    }
}

/** Begins the Southern's restrictions as the first stock round after its formation begins. */
export function beginsSouthernStockRound(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(handler, BeginSouthernStockRound, (state) =>
        southernFormed(state) && !state.southernStockRound ? {} : undefined
    )
}

/** Whether every company with a director has a train (Railway Nationalisation). */
export function everyDirectedCompanyHasTrain(state: State1860): boolean {
    return CompanyIds1860.every((companyId) => {
        const company = getCompany(state, companyId)
        if (!company.started || company.closed || !presidentOf(state, companyId)) return true
        if (inReceivership(state, companyId)) return true
        return trainsOwnedBy(state, { kind: 'company', companyId }).length > 0
    })
}

/** The operating round under way has seen every company operate. */
function roundFinished(state: State1860): boolean {
    const set = state.operatingSet
    return !!set && !set.completed && set.privateIncomePaid && !nextOperatingCompany(state)
}

/**
 * British Rail forms at the end of a stock or operating round once the Southern has formed and
 * every company with a director has a train (Railway Nationalisation).
 */
export function britishRailDue(state: State1860, atRoundEnd: boolean): boolean {
    return (
        atRoundEnd &&
        southernFormed(state) &&
        !state.nationalisation &&
        everyDirectedCompanyHasTrain(state)
    )
}

const FormAction = systemAction('FormBritishRail', {})
export const FormBritishRail = FormAction.schema
export const isFormBritishRail = FormAction.is

/**
 * British Rail forms: no more stock rounds, the bank without limit, and operating rounds until
 * every company has closed. Formed at the end of an operating round, that round's set runs on.
 */
export class HydratedFormBritishRail extends FormAction.Base {
    apply(state: HydratedState1860): void {
        const set = state.operatingSet
        const atOperatingRoundEnd = state.machineState === 'OperatingSet' && roundFinished(state)
        assert(
            this.source === ActionSource.System &&
                britishRailDue(
                    state,
                    atOperatingRoundEnd || state.machineState === 'StartingOperatingSet'
                ),
            'British Rail forms once, at a round’s end'
        )
        state.nationalisation = { closedCompanyIds: [], dividends: {} }
        if (atOperatingRoundEnd && set) {
            delete set.roundCount
            set.endless = true
            state.nationalisation.settledRound = { set: set.number, round: set.roundNumber }
        }
    }
}

/** The companies nationalisation closes after the round, by what they paid (Nationalisation). */
export function companiesToClose(state: State1860): string[] {
    const nationalisation = state.nationalisation
    if (!nationalisation) return []
    const operating = operatingCompanies(state)
    if (operating.length <= 2) return operating
    const paid = (companyId: string) => nationalisation.dividends[companyId] ?? 0
    const values = [...new Set(operating.map(paid))].sort((a, b) => a - b)
    const lowest = operating.filter((companyId) => paid(companyId) === values[0])
    // With one company alone at the lowest, those paying the next lowest close with it.
    if (lowest.length > 1 || values.length < 2) return lowest
    return [...lowest, ...operating.filter((companyId) => paid(companyId) === values[1])]
}

function closureDue(state: State1860): boolean {
    const set = state.operatingSet
    const settled = state.nationalisation?.settledRound
    return (
        !!set &&
        !!state.nationalisation &&
        roundFinished(state) &&
        !(settled?.set === set.number && settled.round === set.roundNumber)
    )
}

const CloseAction = systemAction('NationaliseCompanies', {
    metadata: Type.Optional(
        Type.Object(
            { closedCompanyIds: Type.Array(Type.String()) },
            { additionalProperties: false }
        )
    )
})
export const NationaliseCompanies = CloseAction.schema
export const isNationaliseCompanies = CloseAction.is

/**
 * After each operating round, the companies that paid the least cease to operate, their prices
 * standing for the rest of the game; the last one or two close after a final round.
 */
export class HydratedNationaliseCompanies extends CloseAction.Base {
    declare metadata?: Type.Static<typeof NationaliseCompanies>['metadata']
    apply(state: HydratedState1860): void {
        assert(this.source === ActionSource.System && closureDue(state), 'A round has ended')
        const nationalisation = state.nationalisation
        const set = state.operatingSet
        assert(nationalisation && set, 'British Rail closes companies after a round')
        const closedCompanyIds = companiesToClose(state)
        nationalisation.closedCompanyIds = [
            ...nationalisation.closedCompanyIds,
            ...closedCompanyIds
        ]
        nationalisation.dividends = {}
        nationalisation.settledRound = { set: set.number, round: set.roundNumber }
        this.metadata = { closedCompanyIds }
    }
}

/**
 * At the end of each operating round: British Rail's closures, then its formation where due;
 * before an operating set: its formation, the stock round having ended.
 */
export function runsEndgameAfterRounds(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(
        new SystemActionFirstHandler(handler, FormBritishRail, (state) =>
            britishRailDue(state, roundFinished(state)) ? {} : undefined
        ),
        NationaliseCompanies,
        (state) => (closureDue(state) ? {} : undefined)
    )
}

/** British Rail forms as the operating set begins, when the stock round's end makes it due. */
export function formsBritishRailAfterStockRound(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(handler, FormBritishRail, (state) =>
        britishRailDue(state, true) ? {} : undefined
    )
}

/** Records each company's dividend in a nationalisation round, for the closures that follow. */
export function recordsNationalDividends(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return {
        enter: (context) => handler.enter(context),
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        onAction(action, context) {
            const state = context.gameState
            const next = handler.onAction(action, context)
            if (state.nationalisation && isDistributeEarnings(action))
                state.nationalisation.dividends[action.companyId] =
                    action.choice === 'pay'
                        ? (getCompany(state, action.companyId).lastRunRevenue ?? 0)
                        : 0
            return next
        }
    }
}

export const EndgameActions = [
    SouthernAction.define((action) => new HydratedBeginSouthernStockRound(action)),
    FormAction.define((action) => new HydratedFormBritishRail(action)),
    CloseAction.define((action) => new HydratedNationaliseCompanies(action))
]
