import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    FloatCompany,
    SystemActionFirstHandler,
    closePrivate,
    getCompany,
    nextOperatingCompany,
    privatePowerUsed,
    systemAction
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { meetsOperatingThreshold } from './capitalization.js'
import { CgrId, WaterlooId } from './companies.js'
import type { HydratedState1856, StateHandler1856 } from './state.js'

/** The next company to operate, not yet floated: it floats if it meets its threshold now. */
function unfloatedNext(
    state: HydratedState1856
): { companyId: string; floats: boolean } | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || companyId === CgrId || !state.operatingSet?.privateIncomePaid)
        return undefined
    const company = getCompany(state, companyId)
    if (company.floated) return undefined
    return { companyId, floats: meetsOperatingThreshold(state, companyId) }
}

const PassOverCompanyAction = systemAction('PassOverCompany', {
    companyId: Type.String({ minLength: 1 })
})
export const PassOverCompany = PassOverCompanyAction.schema
export type PassOverCompany = Type.Static<typeof PassOverCompany>
export const isPassOverCompany = PassOverCompanyAction.is

/**
 * A company that has never operated and no longer meets its threshold as its turn comes, a
 * larger train having come on sale, does not operate this round (Initial Shares Needed to
 * Operate).
 */
class HydratedPassOverCompany extends PassOverCompanyAction.Base implements PassOverCompany {
    declare type: 'PassOverCompany'
    declare companyId: string
    apply(state: HydratedState1856): void {
        const next = unfloatedNext(state)
        assert(
            this.source === ActionSource.System &&
                next?.companyId === this.companyId &&
                !next.floats,
            'Only a company short of its threshold is passed over'
        )
        assertExists(state.operatingSet, 'Companies are passed over in an operating round')
        state.operatingSet.completedCompanyIds.push(this.companyId)
    }
}

/**
 * The Waterloo & Saugeen, its tile laid or its station placed, closes once every company has
 * operated in that round.
 */
function waterlooCloses(state: HydratedState1856): boolean {
    if (getCompany(state, WaterlooId).closed) return false
    if (!state.waterlooLaid && !privatePowerUsed(state, WaterlooId)) return false
    return !nextOperatingCompany(state)
}

const ClosePrivateAction = systemAction('CloseWaterloo', {})
export const CloseWaterloo = ClosePrivateAction.schema
export type CloseWaterloo = Type.Static<typeof CloseWaterloo>

class HydratedCloseWaterloo extends ClosePrivateAction.Base implements CloseWaterloo {
    declare type: 'CloseWaterloo'
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && waterlooCloses(state),
            'The Waterloo & Saugeen closes at the end of the round it was used in'
        )
        closePrivate(state, WaterlooId)
        delete state.waterlooLaid
    }
}

export const OperatingTurnActions1856 = [
    PassOverCompanyAction.define((action) => new HydratedPassOverCompany(action)),
    ClosePrivateAction.define((action) => new HydratedCloseWaterloo(action))
]

/**
 * Between companies: the Waterloo & Saugeen closes at its round's end; the next company floats
 * as its first turn comes, or is passed over.
 */
export function floatsAtFirstTurn(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(
        new SystemActionFirstHandler(
            new SystemActionFirstHandler(handler, PassOverCompany, (state) => {
                const next = unfloatedNext(state)
                return next && !next.floats ? { companyId: next.companyId } : undefined
            }),
            FloatCompany,
            (state) => {
                const next = unfloatedNext(state)
                return next?.floats ? { companyId: next.companyId } : undefined
            }
        ),
        CloseWaterloo,
        (state) => (waterlooCloses(state) ? {} : undefined)
    )
}
