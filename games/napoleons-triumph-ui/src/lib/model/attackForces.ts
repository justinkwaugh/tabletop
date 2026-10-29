import { RecordedHistory, assertExists, type GameAction } from '@tabletop/common'
import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
import type { AttackLosses } from './attackLosses.js'
import { actionsOfTheLastAttack } from './lastAttack.js'
import type { RecordedGame } from './moveReplay.js'

// Last seen rather than as the attack opened, which would hide the faces the fight revealed; a loss record is public, so it also reveals.
export function unitsAsTheyEnteredTheAttack(
    game: RecordedGame,
    losses: AttackLosses
): ReadonlyMap<string, ProjectedUnit> {
    const fought = actionsOfTheLastAttack(game.actions)
    assertExists(fought, 'Expected the threat that opened the attack among the recorded actions')
    const units = unitsLastSeen(game, fought)
    for (const loss of [...losses.attacker.taken, ...losses.defender.taken]) {
        const unit = units.get(loss.unitId)
        if (unit) {
            units.set(loss.unitId, {
                ...unit,
                ...(unit.face && { face: loss.face }),
                shown: loss.face
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
