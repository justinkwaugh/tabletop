import { ActionSource, assert } from '@tabletop/common'
import {
    CashPayment,
    SystemActionFirstHandler,
    isStartOperatingRound,
    isStartOperatingTurn,
    isStartStockRound,
    nextOperatingCompany,
    routeRevenue,
    settleCashPayments,
    systemAction,
    trainsOwnedBy
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { MinorIdsMex } from './companies.js'
import { homeLocationMex } from './map.js'
import { requireStateMex, type HydratedStateMex, type StateHandlerMex } from './state.js'
import { mapStateMex } from './tiles.js'
import { PhasesMex } from './trains.js'

/**
 * The mail contract: the current value of the company's original home city, its tile's and its
 * phase's (4.3.1, ML-2).
 */
export function mailContract(state: HydratedStateMex, companyId: string): number {
    const face = mapStateMex(state).tile(homeLocationMex(companyId)).face
    const city = face.nodes.find((node) => node.kind === 'city')
    assert(city && city.kind === 'city', 'A home is a city')
    return routeRevenue(city.revenue, PhasesMex.phase(state.phaseId).tileColors)
}

/** The major owed its mail contract as its turn begins: it owns a train and is not yet paid. */
function mailDue(state: HydratedStateMex): { companyId: string } | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || state.mailPaid || MinorIdsMex.includes(companyId)) return undefined
    if (!trainsOwnedBy(state, { kind: 'company', companyId }).length) return undefined
    return { companyId }
}

const CollectMailAction = systemAction('CollectMail', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object({ payment: Type.Optional(CashPayment) }, { additionalProperties: false })
    )
})
export const CollectMail = CollectMailAction.schema
export type CollectMail = Type.Static<typeof CollectMail>
export const isCollectMail = CollectMailAction.is

/**
 * A major owning a train collects its mail contract from the bank before laying track; it is not
 * revenue, paid out or withheld, and does not move the price (4.3.1).
 */
export class HydratedCollectMail extends CollectMailAction.Base {
    declare companyId: string
    declare metadata?: CollectMail['metadata']
    apply(state: HydratedStateMex): void {
        assert(
            this.source === ActionSource.System && mailDue(state)?.companyId === this.companyId,
            'The mail contract is paid once, to the major starting its turn with a train'
        )
        state.mailPaid = true
        const amount = mailContract(state, this.companyId)
        const payment: CashPayment | undefined = amount
            ? {
                  from: { kind: 'bank' },
                  to: { kind: 'company', companyId: this.companyId },
                  amount
              }
            : undefined
        if (payment) settleCashPayments(state, [payment])
        this.metadata = payment ? { payment } : {}
    }
}

export const MailActions = [CollectMailAction.define((action) => new HydratedCollectMail(action))]

/**
 * The track step waits for the mail contract (4.3(b)); the step opens first, so the state the
 * mail is paid from is a track step's.
 */
export function collectsMailFirst(handler: StateHandlerMex): StateHandlerMex {
    const due = (state: HydratedStateMex) => mailDue(requireStateMex(state))
    const first = new SystemActionFirstHandler(handler, CollectMail, due)
    return {
        isValidAction: (action, context) => first.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            first.validActionsForPlayer(playerId, context),
        enter(context) {
            handler.enter(context)
            const fields = due(context.gameState)
            if (fields) context.addSystemAction(CollectMail, fields)
        },
        onAction: (action, context) => first.onAction(action, context)
    }
}

/** Forgets the mail contract once its turn is over, as the next turn or round starts. */
export function clearsMailPaid(handler: StateHandlerMex): StateHandlerMex {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            if (
                isStartOperatingTurn(action) ||
                isStartOperatingRound(action) ||
                isStartStockRound(action)
            )
                delete requireStateMex(context.gameState).mailPaid
            return handler.onAction(action, context)
        }
    }
}
