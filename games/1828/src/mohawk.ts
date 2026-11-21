import { ActionSource, assert, type HydratedAction } from '@tabletop/common'
import {
    CompanyStartDetails,
    applySharePurchase,
    applyShareTransfer,
    closePrivate,
    controllingOwner,
    evaluateCompanyStart,
    getCompany,
    isChooseHomeStation,
    isExchangePrivate,
    isOperatingStep,
    isPlaceHomeStations,
    isRunInstructionAction,
    isStockInstructionAction,
    markTurn,
    nextOperatingCompany,
    privateOwner,
    recordStockAction,
    recordTurnPurchase,
    startCompanyAtPar,
    stateWith,
    stepAction,
    titleAction,
    type CompanyStartResult,
    type StepAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CobourgRailwayId, MhId } from './ids.js'
import { OperatingStartedMark } from './mohawkTiming.js'
import type { HydratedState1828 } from './state.js'
import { CompanyRules1828, StockRules1828 } from './stock.js'
import { Market1828 } from './stockMarket.js'

const Id = Type.String({ minLength: 1 })

function inStockRound(state: HydratedState1828): boolean {
    return state.machineState === 'StockRound'
}

/** The M&H may be exchanged at any time in an operating round (§13.2.2.6). */
export function inOperatingRound(state: HydratedState1828): boolean {
    return isOperatingStep(state.machineState) || state.machineState === 'FundingTrain'
}

/** The state to judge the start in: outside a stock round, the last one's turn is long over. */
function startState(state: HydratedState1828, playerId: string): HydratedState1828 {
    if (inStockRound(state)) return state
    const { turn } = state.stockRound
    return stateWith(state, {
        activePlayerIds: [playerId],
        stockRound: { ...state.stockRound, turn: { ...turn, bought: false } }
    })
}

/**
 * The director's certificate the M&H's owner takes for the M&H and one share's par, setting the
 * par as usual (§13.2.2.6): their stock turn's action, or at any time in an operating round; not
 * counted as a purchase for the 60% limit.
 */
export function mohawkDirectorship(
    state: HydratedState1828,
    playerId: string,
    companyId: string,
    marketSpaceId: string
): CompanyStartResult {
    if (state.merger) return { reason: 'The M&H cannot be exchanged during a merger.' }
    const owner = privateOwner(state, MhId)
    if (getCompany(state, MhId).closed || owner?.kind !== 'player' || owner.playerId !== playerId)
        return { reason: 'Only the M&H’s owner may exchange it.' }
    const onStockTurn =
        inStockRound(state) && state.activePlayerIds[0] === playerId && !state.stockRound.completed
    if (!onStockTurn && !inOperatingRound(state))
        return {
            reason: 'The M&H is exchanged on its owner’s stock turn or in an operating round.'
        }
    return evaluateCompanyStart(
        startState(state, playerId),
        { playerId, buyer: { kind: 'player', playerId }, companyId, marketSpaceId },
        StockRules1828,
        {
            ...CompanyRules1828,
            startTerms(startingState, startCompanyId, buyer, spaceId) {
                const terms = CompanyRules1828.startTerms(
                    startingState,
                    startCompanyId,
                    buyer,
                    spaceId
                )
                return typeof terms === 'string'
                    ? terms
                    : { ...terms, price: Market1828.space(spaceId).price }
            }
        }
    )
}

export function mohawkDirectorships(
    state: HydratedState1828,
    playerId: string
): { companyId: string; marketSpaceIds: string[] }[] {
    return state.companies.flatMap((company) => {
        const marketSpaceIds = CompanyRules1828.startMarketSpaces(state, company.id).filter(
            (spaceId) => !!mohawkDirectorship(state, playerId, company.id, spaceId).details
        )
        return company.kind === 'major' && marketSpaceIds.length
            ? [{ companyId: company.id, marketSpaceIds }]
            : []
    })
}

const DirectorshipFields = {
    companyId: Id,
    marketSpaceId: Id,
    expectedPrice: Type.Integer({ minimum: 0 }),
    metadata: Type.Optional(CompanyStartDetails)
}
type DirectorshipRequest = {
    playerId: string
    companyId: string
    marketSpaceId: string
    expectedPrice: number
}

function takeDirectorship(state: HydratedState1828, request: DirectorshipRequest) {
    const { playerId, companyId, marketSpaceId } = request
    const { details, reason } = mohawkDirectorship(state, playerId, companyId, marketSpaceId)
    assert(details, reason ?? 'The M&H cannot take this directorship')
    assert(details.price === request.expectedPrice, 'The price has changed')
    startCompanyAtPar(state, Market1828, companyId, marketSpaceId)
    if (inStockRound(state)) {
        applySharePurchase(state, details)
        recordStockAction(state, playerId, StockRules1828.round)
        recordTurnPurchase(state, StockRules1828, { kind: 'start', companyId })
    } else applyShareTransfer(state, details)
    closePrivate(state, MhId)
    return details
}

function directorshipOpen(state: HydratedState1828, request: DirectorshipRequest): boolean {
    const { playerId, companyId, marketSpaceId } = request
    return !!mohawkDirectorship(state, playerId, companyId, marketSpaceId).details
}

const ExchangeMohawkForDirectorshipAction = titleAction(
    'ExchangeMohawkForDirectorship',
    DirectorshipFields
)
export const ExchangeMohawkForDirectorship = ExchangeMohawkForDirectorshipAction.schema
export type ExchangeMohawkForDirectorship = Type.Static<typeof ExchangeMohawkForDirectorship>
export const isExchangeMohawkForDirectorship = ExchangeMohawkForDirectorshipAction.is

class HydratedExchangeMohawkForDirectorship
    extends ExchangeMohawkForDirectorshipAction.Base
    implements ExchangeMohawkForDirectorship
{
    declare type: 'ExchangeMohawkForDirectorship'
    declare playerId: string
    declare companyId: string
    declare marketSpaceId: string
    declare expectedPrice: number
    declare metadata?: CompanyStartDetails
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            directorshipOpen(state, this)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'The M&H cannot take this directorship')
        this.metadata = takeDirectorship(state, this)
    }
}

const ExchangeMohawkOutOfTurnAction = titleAction('ExchangeMohawkForDirectorshipOutOfTurn', {
    ...DirectorshipFields,
    outOfTurn: Type.Literal(true),
    sequenced: Type.Literal(true)
})
export const ExchangeMohawkForDirectorshipOutOfTurn = ExchangeMohawkOutOfTurnAction.schema
export type ExchangeMohawkForDirectorshipOutOfTurn = Type.Static<
    typeof ExchangeMohawkForDirectorshipOutOfTurn
>
export const isExchangeMohawkForDirectorshipOutOfTurn = ExchangeMohawkOutOfTurnAction.is

/** The same exchange by an owner the operating round is not waiting on (§13.2.2.6). */
class HydratedExchangeMohawkOutOfTurn
    extends ExchangeMohawkOutOfTurnAction.Base
    implements ExchangeMohawkForDirectorshipOutOfTurn
{
    declare type: 'ExchangeMohawkForDirectorshipOutOfTurn'
    declare playerId: string
    declare companyId: string
    declare marketSpaceId: string
    declare expectedPrice: number
    declare outOfTurn: true
    declare sequenced: true
    declare metadata?: CompanyStartDetails
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            inOperatingRound(state) &&
            !state.activePlayerIds.includes(this.playerId) &&
            directorshipOpen(state, this)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'The M&H cannot take this directorship')
        this.metadata = takeDirectorship(state, this)
    }
}

export const MohawkExchangeSteps: readonly StepAction<HydratedState1828>[] = [
    stepAction(
        'ExchangeMohawkForDirectorship',
        (action: HydratedAction): action is HydratedExchangeMohawkForDirectorship =>
            action instanceof HydratedExchangeMohawkForDirectorship,
        (state, playerId) =>
            state.activePlayerIds.includes(playerId) &&
            mohawkDirectorships(state, playerId).length > 0
    ),
    stepAction(
        'ExchangeMohawkForDirectorshipOutOfTurn',
        (action: HydratedAction): action is HydratedExchangeMohawkOutOfTurn =>
            action instanceof HydratedExchangeMohawkOutOfTurn,
        (state, playerId) =>
            inOperatingRound(state) &&
            !state.activePlayerIds.includes(playerId) &&
            mohawkDirectorships(state, playerId).length > 0
    )
]

export const MohawkActions1828 = [
    ExchangeMohawkForDirectorshipAction.define(
        (action) => new HydratedExchangeMohawkForDirectorship(action)
    ),
    ExchangeMohawkOutOfTurnAction.define((action) => new HydratedExchangeMohawkOutOfTurn(action))
]

function isMohawkExchange(action: HydratedAction): boolean {
    return (
        isExchangePrivate(action) ||
        isExchangeMohawkForDirectorship(action) ||
        isExchangeMohawkForDirectorshipOutOfTurn(action)
    )
}

/**
 * Notes a share company beginning its turn, for the M&H's timing (§13.2.2.6): a home station, or
 * its director's first act. Standing instructions and the M&H exchange itself are no part of it,
 * nor is anything another player does.
 */
export function notesOperatingStart(state: HydratedState1828, action: HydratedAction): void {
    const companyId = nextOperatingCompany(state)
    if (!companyId || companyId === CobourgRailwayId) return
    const directorActs =
        state.machineState === 'LayingTrack' &&
        action.source === ActionSource.User &&
        action.playerId === controllingOwner(state, companyId)?.playerId &&
        !isRunInstructionAction(action) &&
        !isStockInstructionAction(action) &&
        !isMohawkExchange(action)
    if (directorActs || isPlaceHomeStations(action) || isChooseHomeStation(action))
        markTurn(state, OperatingStartedMark)
}
