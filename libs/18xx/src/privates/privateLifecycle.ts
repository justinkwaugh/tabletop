import type { MapStateData } from '../map/mapState.js'
import { assert } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import type { StockState } from '../stock/stockState.js'
import type { StockRules } from '../stock/stockRules.js'
import { closePrivate } from './privateCompany.js'
import { applyPrivateShareExchange } from './privateExchange.js'
import type { PrivateEffect } from './privateRules.js'

export function applyPrivateEffects(
    state: StockState & MapStateData,
    effects: readonly PrivateEffect[],
    rules: StockRules
): void {
    for (const effect of effects) {
        const company = getCompany(state, effect.privateCompanyId)
        assert(
            company.kind === 'private' && !company.closed,
            'Private effect requires an open private'
        )
        if (effect.kind === 'close') {
            closePrivate(state, company.id)
            for (const pieceId of effect.retireUnplacedPieceIds ?? []) {
                assert(
                    !Object.values(state.tileInventory.placements).some(
                        (placement) => placement.pieceId === pieceId
                    ) && !state.tileInventory.retiredPieceIds.includes(pieceId),
                    'Only an unused tile may expire'
                )
                state.tileInventory.retiredPieceIds.push(pieceId)
            }
        } else if (effect.kind === 'income') company.privateRevenue = effect.revenue
        else
            applyPrivateShareExchange(
                state,
                company.id,
                effect.certificateId,
                effect.exemptOwnershipLimit,
                rules
            )
    }
}
