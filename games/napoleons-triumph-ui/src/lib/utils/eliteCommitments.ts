import {
    GUARD_COMMITMENT_PENALTY,
    HEAVY_CAVALRY_COMMITMENT_PENALTY,
    UnitType,
    type Face,
    type HydratedNapoleonsTriumphPlayerState
} from '@tabletop/napoleons-triumph'

export interface EliteCommitment {
    id: 'guard' | 'heavyCavalry'
    name: string
    face: Face
    committed: boolean
    status: string
    explanation?: string
}

function uncommittedStatus(player: HydratedNapoleonsTriumphPlayerState, penalty: number): string {
    const cost = player.wearDownLoss(penalty)
    return cost > 0 ? `−${cost} morale to commit` : 'free to commit'
}

export function eliteCommitments(player: HydratedNapoleonsTriumphPlayerState): EliteCommitment[] {
    return [
        {
            id: 'guard',
            name: 'Guard',
            face: { type: UnitType.Infantry, strength: 1, guard: true },
            committed: player.guardCommitted,
            status: !player.guardCommitted
                ? uncommittedStatus(player, GUARD_COMMITMENT_PENALTY)
                : player.guardAttackForfeited
                  ? 'Committed / Failed'
                  : 'Committed',
            explanation: player.guardAttackForfeited
                ? 'A Guard Attack was defeated: no more Guard Attacks may be made.'
                : undefined
        },
        {
            id: 'heavyCavalry',
            name: 'Heavy cavalry',
            face: { type: UnitType.Cavalry, strength: 1 },
            committed: player.heavyCavalryCommitted,
            status: player.heavyCavalryCommitted
                ? 'Committed'
                : uncommittedStatus(player, HEAVY_CAVALRY_COMMITMENT_PENALTY)
        }
    ]
}
