import { getCompany, sameOwner, sharesOwned, type Owner } from '../finance/finance.js'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'
import type {
    StandingStockInstruction,
    StockInstruction,
    StockInstructionStopReason,
    StockPositionSnapshot
} from './stockInstruction.js'

export function createStandingStockInstruction(
    state: StockState,
    playerId: string,
    instruction: StockInstruction,
    rules: StockRules
): StandingStockInstruction {
    const titleSnapshot = rules.instructions?.titleSnapshot?.(state, playerId)
    return {
        playerId,
        instruction,
        snapshot: stockPositionSnapshot(state, playerId),
        ...(titleSnapshot ? { titleSnapshot } : {})
    }
}

export function stockPositionSnapshot(state: StockState, playerId: string): StockPositionSnapshot {
    const owner: Owner = { kind: 'player', playerId }
    return state.companies.flatMap((company) => {
        if (!company.shareCount) return []
        const rivalShares = Math.max(
            0,
            ...state.players
                .filter((player) => player.playerId !== playerId)
                .map((player) =>
                    sharesOwned(state, company.id, { kind: 'player', playerId: player.playerId })
                )
        )
        return [
            {
                companyId: company.id,
                started: company.started === true,
                ...(company.president ? { president: company.president } : {}),
                ownerShares: sharesOwned(state, company.id, owner),
                rivalShares,
                bankShares: sharesOwned(state, company.id, { kind: 'bank' })
            }
        ]
    })
}

export function stockPositionChange(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules
): StockInstructionStopReason | undefined {
    const familyChange = () => familyPositionChange(state, standing, rules)
    return rules.instructions?.positionChange
        ? rules.instructions.positionChange(state, standing, familyChange)
        : familyChange()
}

function familyPositionChange(
    state: StockState,
    standing: StandingStockInstruction,
    rules: StockRules
): StockInstructionStopReason | undefined {
    const owner: Owner = { kind: 'player', playerId: standing.playerId }
    if (exceedsStockLimits(state, owner, rules)) return { code: 'limits' }
    for (const current of stockPositionSnapshot(state, standing.playerId)) {
        const before = standing.snapshot.find((item) => item.companyId === current.companyId)
        if (!before) continue
        const companyId = current.companyId
        if (!before.started && current.started) return { code: 'company-started', companyId }
        const presidentChanged =
            (before.president === undefined) !== (current.president === undefined) ||
            (before.president &&
                current.president &&
                !sameOwner(before.president, current.president))
        if (presidentChanged && !(current.president && sameOwner(current.president, owner)))
            return { code: 'president-changed', companyId }
        if (current.bankShares > before.bankShares) return { code: 'shares-sold', companyId }
        const presides = current.president !== undefined && sameOwner(current.president, owner)
        const secure =
            rules.instructions?.securePresidency?.(state, current.companyId, owner) ??
            current.ownerShares * 2 > (getCompany(state, current.companyId).shareCount ?? 0)
        if (presides && !secure && current.rivalShares > before.rivalShares)
            return { code: 'presidency-threatened', companyId }
    }
    return undefined
}
