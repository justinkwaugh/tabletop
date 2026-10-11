import type { HydratedNapoleonsTriumphGameState } from '@tabletop/napoleons-triumph'
import { TargetKind, type MoveTarget } from './targets.js'

// Rule 15: a Guard Attack is announced with a threat across an approach that is not obstructed.
function mayBeGuardAttack(state: HydratedNapoleonsTriumphGameState, target: MoveTarget): boolean {
    return (
        target.kind === TargetKind.Attack &&
        !state.map.approach(target.position.approach).obstructed
    )
}

export function guardUnitToAnnounce(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    pickedUnitIds: readonly string[],
    targets: readonly MoveTarget[]
): string | undefined {
    if (
        state.getPlayerState(playerId).guardAttackForfeited ||
        !targets.some((target) => mayBeGuardAttack(state, target))
    ) {
        return undefined
    }
    return pickedUnitIds.find((id) => state.unit(id).face?.guard === true)
}

export function targetsOfGuardAttack(
    state: HydratedNapoleonsTriumphGameState,
    targets: readonly MoveTarget[]
): MoveTarget[] {
    return targets.filter(
        (target) => target.kind !== TargetKind.Attack || mayBeGuardAttack(state, target)
    )
}
