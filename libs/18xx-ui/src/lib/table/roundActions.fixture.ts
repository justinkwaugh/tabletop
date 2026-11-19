import { ActionSource, type GameAction } from '@tabletop/common'
import type {
    CompleteStockRound,
    DistributeEarnings,
    FinishOperatingTurn,
    InterruptOperatingTurn,
    OperatingRoundIdentity,
    PlayerNetWorth,
    RoundEnd,
    ResumeOperatingTurn,
    StartOperatingRound
} from '@tabletop/18xx'

const base = { gameId: 'income', source: ActionSource.System }

export function stockRoundEnd(id: string, playerNetWorth?: PlayerNetWorth): CompleteStockRound {
    return {
        ...base,
        id,
        type: 'CompleteStockRound',
        metadata: {
            nextPlayerOrder: ['alex', 'blake'],
            marketMoves: [],
            ...(playerNetWorth ? { roundEnd: { round: 'stock', playerNetWorth } } : {})
        }
    }
}

export function operatingRoundStart(
    id: string,
    identity: OperatingRoundIdentity,
    playerNetWorth: PlayerNetWorth,
    privateIncome: Record<string, number> = {}
): StartOperatingRound {
    return {
        ...base,
        id,
        type: 'StartOperatingRound',
        metadata: {
            operatingSet: {
                ...identity,
                ...(identity.endless ? {} : { roundCount: 1 }),
                companyOrder: ['R'],
                completedCompanyIds: [],
                privateIncomePaid: true,
                completed: false
            },
            payments: Object.entries(privateIncome).map(([playerId, amount]) => ({
                from: { kind: 'bank' as const },
                to: { kind: 'player' as const, playerId },
                amount
            })),
            snapshot: { ...identity, complete: false, playerNetWorth, companyIds: ['R'] }
        }
    }
}

export function operatingTurnEnd(
    id: string,
    identity: OperatingRoundIdentity,
    playerNetWorth: PlayerNetWorth
): FinishOperatingTurn {
    return {
        ...base,
        id,
        type: 'FinishOperatingTurn',
        companyId: 'R',
        metadata: { ...identity, complete: true, playerNetWorth, companyIds: ['R'] }
    }
}

export function earnings(
    round: OperatingRoundIdentity,
    dividends: Record<string, number>
): DistributeEarnings {
    return {
        ...base,
        id: 'earnings',
        type: 'DistributeEarnings',
        companyId: 'R',
        choice: 'pay',
        metadata: {
            companyId: 'R',
            choice: 'pay',
            revenue: 30,
            retained: 0,
            dividendPerShare: 3,
            bonusPerShare: 0,
            bankAdjustment: 0,
            payments: Object.entries(dividends).map(([playerId, amount]) => ({
                from: { kind: 'company' as const, companyId: 'R' },
                to: { kind: 'player' as const, playerId },
                amount
            })),
            privateEffects: [],
            round
        }
    }
}

export const resume: ResumeOperatingTurn = { ...base, id: 'resume', type: 'ResumeOperatingTurn' }
export const interrupt: InterruptOperatingTurn = {
    ...base,
    id: 'interrupt',
    type: 'InterruptOperatingTurn'
}

/** A round of the title's own, begun and ended by Actions of these types. */
export const MergerRound = {
    name: 'Merger round',
    abbreviation: 'MR',
    starts: (action: GameAction) => action.type === 'StartMergerRound',
    ends: (action: GameAction) => action.type === 'EndMergerRound'
}

export function mergerRoundStart(id: string): GameAction {
    return { ...base, id, type: 'StartMergerRound' }
}

export function mergerRoundEnd(id: string, playerNetWorth?: PlayerNetWorth): GameAction {
    return {
        ...base,
        id,
        type: 'EndMergerRound',
        ...(playerNetWorth ? { metadata: { roundEnd: { round: 'title', playerNetWorth } } } : {})
    }
}

export function openingEnd(
    id: string,
    playerNetWorth: PlayerNetWorth
): GameAction & { metadata: { roundEnd: RoundEnd } } {
    return {
        ...base,
        id,
        type: 'ResolveAuction',
        metadata: { roundEnd: { round: 'opening', playerNetWorth } }
    }
}
