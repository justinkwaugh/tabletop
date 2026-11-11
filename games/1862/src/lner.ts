import {
    SystemActionFirstHandler,
    bankExhaustionAtSetEnd,
    canStartStockRound,
    finiteCashOwnedBy,
    sharesOwned,
    type EighteenXXStateHandler,
    type EndingState,
    type GameEnding
} from '@tabletop/18xx'
import { ActionSource, assert } from '@tabletop/common'
import * as Type from 'typebox'
import { DirectorShares } from './charters.js'
import { IpoPoolId, MarketPoolId } from './pools.js'
import { requireState1862, type HydratedState1862 } from './state.js'
import {
    CharteredParPrices,
    GameEndPrice,
    Market1862,
    NonCharteredStartPrices
} from './stockMarket.js'
import { systemAction } from './titleAction.js'

export const LnerFormed = 'LNER formed'
export const MarketTop = 'Share price reached the top of the market'
export const Stalled = 'No company left, and none can be started'

/**
 * No company is running and no player can pay for the cheapest start, by charter or in a stock
 * round. With no company there is no income, so nothing can change again: the game ends (a
 * ruling; the rules do not foresee it).
 */
export function stalled(state: EndingState): boolean {
    if (state.companies.some((company) => company.started && !company.closed)) return false
    const cheapest = DirectorShares * Math.min(...CharteredParPrices, ...NonCharteredStartPrices)
    return state.players.every(
        ({ playerId }) => finiteCashOwnedBy(state, { kind: 'player', playerId }) < cheapest
    )
}

const FormAction = systemAction('FormLner', {
    metadata: Type.Optional(
        Type.Object(
            {
                certificateLimit: Type.Integer({ minimum: 0 }),
                movedCertificateIds: Type.Array(Type.String()),
                removedCompanyIds: Type.Array(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const FormLner = FormAction.schema
export const isFormLner = FormAction.is

/** The LNER forms at the end of the set in which the first H train was bought (§10.3). */
export function lnerDue(state: HydratedState1862): boolean {
    return !!state.lnerDue && !state.lner && canStartStockRound(state)
}

/**
 * The LNER forms: no more Parliament, track, stations, new companies or mergers; IPO shares go
 * to the Bank Pool; the certificate limit becomes the most shares any player holds (§10.3).
 */
export class HydratedFormLner extends FormAction.Base {
    declare metadata?: Type.Static<typeof FormLner>['metadata']
    apply(state: HydratedState1862): void {
        assert(
            this.source === ActionSource.System && lnerDue(state),
            'The LNER forms once, after its set'
        )
        const certificateLimit = Math.max(
            0,
            ...state.players.map((player) =>
                state.companies.reduce(
                    (sum, company) =>
                        sum +
                        sharesOwned(state, company.id, {
                            kind: 'player',
                            playerId: player.playerId
                        }),
                    0
                )
            )
        )
        const movedCertificateIds: string[] = []
        const removedCompanyIds: string[] = []
        for (const company of state.companies)
            if (!company.started && !company.closed) {
                company.closed = true
                removedCompanyIds.push(company.id)
            }
        for (const certificate of state.certificates)
            if (
                certificate.poolId === IpoPoolId &&
                !removedCompanyIds.includes(certificate.companyId)
            ) {
                certificate.poolId = MarketPoolId
                movedCertificateIds.push(certificate.id)
            }
        state.lner = { certificateLimit }
        delete state.lnerDue
        delete state.resetCompanyIds
        this.metadata = { certificateLimit, movedCertificateIds, removedCompanyIds }
    }
}

export function formsLner(
    handler: EighteenXXStateHandler<HydratedState1862>
): EighteenXXStateHandler<HydratedState1862> {
    return new SystemActionFirstHandler(handler, FormLner, (state) =>
        lnerDue(state) ? {} : undefined
    )
}

/**
 * A price at the top of the market ends the game after the current operating round; the LNER
 * ends it after the set that follows its formation; a broken bank, before the LNER, after the
 * current set (§10).
 */
export function endingTrigger(state: EndingState): GameEnding | undefined {
    const title = requireState1862(state)
    const set = state.operatingSet
    const atTop = state.stockMarket.stacks.some(
        (stack) => Market1862.space(stack.spaceId).price >= GameEndPrice
    )
    if (atTop && set && !set.completed)
        return {
            reason: MarketTop,
            finalOperatingSet: set.number,
            finalOperatingRound: set.roundNumber
        }
    if (title.lner) return { reason: LnerFormed, finalOperatingSet: (set?.number ?? 0) + 1 }
    if (stalled(state)) return { reason: Stalled }
    return bankExhaustionAtSetEnd(state)
}

export const LnerActions = [FormAction.define((action) => new HydratedFormLner(action))]
