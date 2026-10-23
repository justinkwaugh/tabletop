import { sameOwner, sharesOwned, type Owner } from '../finance/finance.js'
import { companyShareCount } from '../company/companyCharters.js'
import { exceedsStockLimits, type StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'
import {
    withIgnoredStops,
    type IgnorableStockInstructionStop,
    type StandingStockInstruction,
    type StockInstruction,
    type StockInstructionStopReason,
    type StockPositionSnapshot
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
        instruction: withIgnoredStops(instruction, instruction.ignoredStops ?? []),
        snapshot: stockPositionSnapshot(state, playerId, rules),
        ...(titleSnapshot ? { titleSnapshot } : {})
    }
}

export function stockPositionSnapshot(
    state: StockState,
    playerId: string,
    rules: Pick<StockRules, 'charters'>
): StockPositionSnapshot {
    const owner: Owner = { kind: 'player', playerId }
    return state.companies.flatMap((company) => {
        if (!companyShareCount(state, rules.charters, company.id)) return []
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
    const watches = (stop: IgnorableStockInstructionStop) =>
        !standing.instruction.ignoredStops?.includes(stop)
    if (exceedsStockLimits(state, owner, rules)) return { code: 'limits' }
    for (const current of stockPositionSnapshot(state, standing.playerId, rules)) {
        const before = standing.snapshot.find((item) => item.companyId === current.companyId)
        if (!before) continue
        const companyId = current.companyId
        if (watches('company-started') && !before.started && current.started)
            return { code: 'company-started', companyId }
        const presidentChanged =
            (before.president === undefined) !== (current.president === undefined) ||
            (before.president &&
                current.president &&
                !sameOwner(before.president, current.president))
        if (
            watches('president-changed') &&
            presidentChanged &&
            !(current.president && sameOwner(current.president, owner))
        )
            return { code: 'president-changed', companyId }
        if (watches('shares-sold') && current.bankShares > before.bankShares)
            return { code: 'shares-sold', companyId }
        const presides = current.president !== undefined && sameOwner(current.president, owner)
        const secure =
            rules.instructions?.securePresidency?.(state, current.companyId, owner) ??
            current.ownerShares * 2 >
                (companyShareCount(state, rules.charters, current.companyId) ?? 0)
        if (
            watches('presidency-threatened') &&
            presides &&
            !secure &&
            current.rivalShares > before.rivalShares
        )
            return { code: 'presidency-threatened', companyId }
    }
    return undefined
}
