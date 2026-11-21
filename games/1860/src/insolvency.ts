import {
    SystemActionFirstHandler,
    getCompany,
    hasStationRoute,
    inReceivership,
    nextOperatingCompany,
    systemAction,
    trainsOwnedBy,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import { ActionSource, assert } from '@tabletop/common'
import * as Type from 'typebox'
import type { HydratedState1860, State1860 } from './state.js'
import { mapState1860 } from './tiles.js'

const Id = Type.String({ minLength: 1 })

/** Whether the company could run a train, if it had one: a route from one of its bases. */
export function hasRoute(state: State1860, companyId: string): boolean {
    return hasStationRoute(mapState1860(state), state, companyId)
}

function trainless(state: State1860, companyId: string): boolean {
    return trainsOwnedBy(state, { kind: 'company', companyId }).length === 0
}

/**
 * The change of insolvency due: a company ending its turn without a train though it has a route
 * becomes insolvent, and one ending it with a train is solvent again; a company in receivership
 * with no train is insolvent as its turn begins (Insolvency; Companies In Receivership).
 */
export function dueInsolvency(
    state: HydratedState1860
): { companyId: string; insolvent: boolean } | undefined {
    const set = state.operatingSet
    if (!set || set.completed) return undefined
    const insolvent = (companyId: string) => state.insolventIds.includes(companyId)
    const finished = set.completedCompanyIds.at(-1)
    if (finished && !state.bankruptIds.includes(finished) && !getCompany(state, finished).closed) {
        if (!trainless(state, finished) && insolvent(finished))
            return { companyId: finished, insolvent: false }
        if (trainless(state, finished) && !insolvent(finished) && hasRoute(state, finished))
            return { companyId: finished, insolvent: true }
    }
    const next = set.privateIncomePaid ? nextOperatingCompany(state) : undefined
    if (
        next &&
        !set.completedCompanyIds.includes(next) &&
        inReceivership(state, next) &&
        trainless(state, next) &&
        !insolvent(next) &&
        hasRoute(state, next)
    )
        return { companyId: next, insolvent: true }
    return undefined
}

const InsolvencyAction = systemAction('ChangeInsolvency', {
    companyId: Id,
    insolvent: Type.Boolean()
})
export const ChangeInsolvency = InsolvencyAction.schema
export const isChangeInsolvency = InsolvencyAction.is

export class HydratedChangeInsolvency extends InsolvencyAction.Base {
    declare companyId: Type.Static<typeof ChangeInsolvency>['companyId']
    declare insolvent: Type.Static<typeof ChangeInsolvency>['insolvent']
    apply(state: HydratedState1860): void {
        const due = dueInsolvency(state)
        assert(
            this.source === ActionSource.System &&
                due?.companyId === this.companyId &&
                due.insolvent === this.insolvent,
            'The company’s insolvency changes as its turn ends'
        )
        state.insolventIds = this.insolvent
            ? [...state.insolventIds, this.companyId]
            : state.insolventIds.filter((id) => id !== this.companyId)
    }
}

/** Settles insolvency between companies' turns, before anything else happens. */
export function judgesInsolvency(
    handler: EighteenXXStateHandler<HydratedState1860>
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(handler, ChangeInsolvency, (state) => dueInsolvency(state))
}

export const InsolvencyActions = [
    InsolvencyAction.define((action) => new HydratedChangeInsolvency(action))
]
