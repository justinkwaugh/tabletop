import {
    SystemActionFirstHandler,
    createStockRound,
    endOperatingTurn,
    getCompany,
    removeStockMarker,
    sharesOwned,
    systemAction,
    type EighteenXXStateHandler
} from '@tabletop/18xx'
import { ActionSource, assert, assertExists, turnOrderFrom } from '@tabletop/common'
import * as Type from 'typebox'
import { CompanyIds1860 } from './companies.js'
import { IpoPoolId } from './names.js'
import type { HydratedState1860, State1860 } from './state.js'
import { BankruptcyPrice, Market1860 } from './stockMarket.js'

const Id = Type.String({ minLength: 1 })

/** A started company whose price has fallen to zero is bankrupt (Bankrupt Companies). */
export function dueBankruptcy(state: State1860): string | undefined {
    return state.companies.find(
        (company) =>
            CompanyIds1860.includes(company.id) &&
            company.started &&
            !company.closed &&
            state.stockMarket.stacks.some((stack) => stack.companyIds.includes(company.id)) &&
            Market1860.companySpace(state.stockMarket, company.id).price <= BankruptcyPrice
    )?.id
}

/**
 * Priority goes to the player holding the fewest shares, privates aside; between equals, to the
 * nearest clockwise from the player holding it now, that player first (Bankrupt Companies).
 */
export function priorityAfterBankruptcy(state: State1860): string {
    const order = state.turnManager.turnOrder
    const shares = (playerId: string) =>
        CompanyIds1860.reduce(
            (sum, companyId) => sum + sharesOwned(state, companyId, { kind: 'player', playerId }),
            0
        )
    const fewest = Math.min(...order.map(shares))
    const chosen = order.find((playerId) => shares(playerId) === fewest)
    assertExists(chosen, 'A player takes priority')
    return chosen
}

const BankruptAction = systemAction('BankruptCompany', {
    companyId: Id,
    metadata: Type.Optional(
        Type.Object(
            {
                priorityPlayerId: Type.String(),
                returnedCertificateIds: Type.Array(Type.String())
            },
            { additionalProperties: false }
        )
    )
})
export const BankruptCompany = BankruptAction.schema
export const isBankruptCompany = BankruptAction.is

/**
 * A bankrupt company's shares return to the IPO without compensation and its bases turn face
 * down where they stand; its treasury, trains and unused bases wait on its charter for whoever
 * starts it again. A stock round under way ends and a new one begins; in an operating round the
 * company stops operating and the rounds go on (Bankrupt Companies).
 */
export class HydratedBankruptCompany extends BankruptAction.Base {
    declare companyId: Type.Static<typeof BankruptCompany>['companyId']
    declare metadata?: Type.Static<typeof BankruptCompany>['metadata']
    apply(state: HydratedState1860): void {
        assert(
            this.source === ActionSource.System && dueBankruptcy(state) === this.companyId,
            'The company is due to go bankrupt'
        )
        const returnedCertificateIds: string[] = []
        for (const certificate of state.certificates)
            if (certificate.kind === 'share' && certificate.companyId === this.companyId) {
                certificate.owner = { kind: 'bank' }
                certificate.poolId = IpoPoolId
                returnedCertificateIds.push(certificate.id)
            }
        const company = getCompany(state, this.companyId)
        company.started = false
        company.floated = false
        company.funded = false
        delete company.parPrice
        removeStockMarker(state.stockMarket, this.companyId)
        state.bankruptIds = [...state.bankruptIds, this.companyId]
        const priorityPlayerId = priorityAfterBankruptcy(state)
        state.turnManager.turnOrder = turnOrderFrom(state.turnManager.turnOrder, priorityPlayerId)
        if (state.machineState === 'StockRound') this.restartStockRound(state, priorityPlayerId)
        else this.stopOperating(state)
        this.metadata = { priorityPlayerId, returnedCertificateIds }
    }
    private restartStockRound(state: HydratedState1860, priorityPlayerId: string): void {
        state.stockRound = createStockRound(state.stockRound.number + 1)
        if (state.turnManager.currentTurn()) state.turnManager.endTurn(state.actionCount)
        state.turnManager.startTurn(priorityPlayerId, state.actionCount + 1)
        state.activePlayerIds = [priorityPlayerId]
    }
    private stopOperating(state: HydratedState1860): void {
        const operating =
            state.trainPurchaseStep?.companyId ??
            state.routeStep?.companyId ??
            state.stationStep?.companyId ??
            state.trackStep?.companyId
        if (operating === this.companyId) {
            endOperatingTurn(state, this.companyId)
            delete state.trainPurchaseStep
        }
        const set = state.operatingSet
        if (set)
            set.companyOrder = set.companyOrder.filter(
                (id) => id !== this.companyId || set.completedCompanyIds.includes(id)
            )
    }
}

/** Bankrupts a company as soon as its price reaches zero, before anything else happens. */
export function bankruptsCompanies(
    handler: EighteenXXStateHandler<HydratedState1860>,
    next?: string | ((state: HydratedState1860) => string)
): EighteenXXStateHandler<HydratedState1860> {
    return new SystemActionFirstHandler(
        handler,
        BankruptCompany,
        (state) => {
            const companyId = dueBankruptcy(state)
            return companyId ? { companyId } : undefined
        },
        next
    )
}

export const BankruptcyActions = [
    BankruptAction.define((action) => new HydratedBankruptCompany(action))
]
