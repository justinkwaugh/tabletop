import { RecordedHistory, type GameAction } from '@tabletop/common'
import { isThreatenAttack, type ProjectedUnit } from '@tabletop/napoleons-triumph'
import type { AttackLosses } from './attackLosses.js'
import type { RecordedGame } from './moveReplay.js'

export function actionsOfTheLastAttack(
    actions: readonly GameAction[]
): readonly GameAction[] | undefined {
    const openedAt = actions.findLastIndex((action) => isThreatenAttack(action))
    return openedAt < 0 ? undefined : actions.slice(openedAt)
}

/** Each unit of the last attack as last seen, which keeps what the attack revealed, at the strength it went into the attack. */
export function unitsAsTheyEnteredTheAttack(
    game: RecordedGame,
    losses: AttackLosses
): ReadonlyMap<string, ProjectedUnit> {
    const units = unitsLastSeen(game, actionsOfTheLastAttack(game.actions) ?? [])
    for (const loss of [...losses.attacker.taken, ...losses.defender.taken]) {
        const unit = units.get(loss.unitId)
        if (unit) {
            units.set(loss.unitId, {
                ...unit,
                ...(unit.face && { face: loss.face }),
                ...(unit.shown && { shown: loss.face })
            })
        }
    }
    return units
}

function unitsLastSeen(
    game: RecordedGame,
    fought: readonly GameAction[]
): Map<string, ProjectedUnit> {
    const transitions = new RecordedHistory(game.state, fought).select((state) => state.units)
    const units = new Map<string, ProjectedUnit>()
    for (const action of fought) {
        const transition = transitions.get(action.id)
        for (const unit of [...(transition?.before ?? []), ...(transition?.after ?? [])]) {
            units.set(unit.id, unit)
        }
    }
    return units
}
