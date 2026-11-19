import { ActionSource, assert } from '@tabletop/common'
import {
    actsFor,
    closePrivate,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    settleCashPayments,
    stepAction,
    titleAction,
    type Owner,
    type PhaseChangeState
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { DocHollidayId, RgId, SfId } from './ids.js'
import { GorgeEastId, GorgeLocationIds, GorgeWestId } from './map.js'
import { operatedBy } from './operator.js'
import { privatePlayerHolder } from './privateHoldings.js'
import { requireStateRoyalGorge, type HydratedStateRoyalGorge } from './state.js'
import { MarketRoyalGorge, movedSpaceId } from './stockMarket.js'
import { GreenGorgeTileIds, withGorgeTiles } from './tiles.js'
import { PhasesRoyalGorge, TreatyPhaseId } from './trains.js'

/** The debt tokens each railroad owes at the Treaty of Boston (DB-3). */
export const TreatyDebts: Readonly<Record<string, number>> = { [RgId]: 4, [SfId]: 2 }

/**
 * How many spaces left each railroad's price falls at the game's end, by debts still owed: the
 * highest uncovered white number on its charter (DB-6).
 */
export const DebtPenalties: Readonly<Record<string, readonly number[]>> = {
    [RgId]: [0, 2, 3, 5, 8],
    [SfId]: [0, 1, 3]
}

/** The ids of Rio Grande's two stations placed in the gorge by the Treaty (DB-1). */
export const GorgeStationIds: readonly string[] = [`${RgId}:gorge:1`, `${RgId}:gorge:2`]

export function treatySigned(phaseId: string): boolean {
    return PhasesRoyalGorge.isAtLeast(phaseId, TreatyPhaseId)
}

/**
 * The Treaty of Boston: the green gorge is laid, Rio Grande places two more stations in it, and
 * Rio Grande owes Santa Fe four debts, Santa Fe Doc Holliday two (DB-1 to DB-3).
 */
export function signTreaty(state: PhaseChangeState): void {
    const title = requireStateRoyalGorge(state)
    title.tileInventory = withGorgeTiles(title.tileInventory, GreenGorgeTileIds)
    for (const [index, locationId] of [GorgeWestId, GorgeEastId].entries())
        title.stations.push({
            id: GorgeStationIds[index],
            companyId: RgId,
            status: 'placed',
            position: { locationId, nodeId: 'city', slot: 0 }
        })
    title.stationReservations = title.stationReservations.filter(
        (reservation) =>
            reservation.companyId !== RgId || !GorgeLocationIds.includes(reservation.locationId)
    )
    title.debts = { ...TreatyDebts }
}

/** Who a railroad's debt payments go to: Santa Fe, or Doc Holliday's owner or the bank (DB-3). */
export function debtCreditor(state: object, companyId: string): Owner {
    if (companyId === RgId) return { kind: 'company', companyId: SfId }
    const playerId = privatePlayerHolder(requireStateRoyalGorge(state), DocHollidayId)
    return playerId ? { kind: 'player', playerId } : { kind: 'bank' }
}

export function debtPrice(state: object): number {
    return MarketRoyalGorge.space(requireStateRoyalGorge(state).debtSpaceId).price
}

/** Whether the operating railroad may pay a debt now: one an operating round (DB-5). */
export function canPayDebt(state: object, companyId: string): boolean {
    const title = requireStateRoyalGorge(state)
    return (
        nextOperatingCompany(title) === companyId &&
        !!title.trainPurchaseStep &&
        title.trainPurchaseStep.companyId === companyId &&
        (title.debts[companyId] ?? 0) > 0 &&
        !title.debtPaidIds.includes(companyId) &&
        finiteCashOwnedBy(title, { kind: 'company', companyId }) >= debtPrice(title)
    )
}

const PayDebtAction = titleAction('PayDebt', {
    companyId: Type.String({ minLength: 1 }),
    expectedPrice: Type.Integer({ minimum: 0 })
})
export const PayDebt = PayDebtAction.schema
export type PayDebt = Type.Static<typeof PayDebt>
export const isPayDebt = PayDebtAction.is

/**
 * The indebted railroad buys one debt token at the debt marker's price from its treasury;
 * Doc Holliday closes once Santa Fe has bought both of his (DB-5, DB-7).
 */
export class HydratedPayDebt extends PayDebtAction.Base {
    declare playerId: string
    declare companyId: string
    declare expectedPrice: number
    isValid(state: HydratedStateRoyalGorge): boolean {
        return (
            this.source === ActionSource.User &&
            actsFor(state, this.playerId, this.companyId) &&
            canPayDebt(state, this.companyId) &&
            debtPrice(state) === this.expectedPrice
        )
    }
    apply(state: HydratedStateRoyalGorge): void {
        assert(this.isValid(state), 'This railroad cannot pay a debt now')
        settleCashPayments(state, [
            {
                from: { kind: 'company', companyId: this.companyId },
                to: debtCreditor(state, this.companyId),
                amount: this.expectedPrice
            }
        ])
        const left = (state.debts[this.companyId] ?? 0) - 1
        const { [this.companyId]: _paid, ...others } = state.debts
        state.debts = left > 0 ? { ...others, [this.companyId]: left } : others
        state.debtPaidIds = [...state.debtPaidIds, this.companyId]
        if (this.companyId === SfId && !left) {
            const doc = state.companies.find((company) => company.id === DocHollidayId)
            if (doc && !doc.closed) closePrivate(state, DocHollidayId)
        }
    }
}

export const PayDebtStep = stepAction<HydratedStateRoyalGorge, HydratedPayDebt>(
    PayDebtAction.type,
    (action): action is HydratedPayDebt => action instanceof HydratedPayDebt,
    (state, playerId) => {
        const companyId = operatedBy(state, playerId)
        return !!companyId && canPayDebt(state, companyId)
    }
)

export const DebtActions = [PayDebtAction.define((action) => new HydratedPayDebt(action))]

/** The debt marker's move as an operating round ends, once the Treaty is signed (DB-4). */
export function advanceDebtMarker(state: HydratedStateRoyalGorge): string | undefined {
    if (!treatySigned(state.phaseId)) return undefined
    const to = movedSpaceId(state.debtSpaceId, 'right', 1)
    if (to) state.debtSpaceId = to
    return to
}

/** How many spaces left a floated railroad's price falls at the end for its unpaid debt. */
export function debtPenaltySteps(state: object, companyId: string): number {
    const title = requireStateRoyalGorge(state)
    const owed = title.debts[companyId] ?? 0
    if (!owed || !getCompany(title, companyId).floated) return 0
    return DebtPenalties[companyId]?.[owed] ?? 0
}
