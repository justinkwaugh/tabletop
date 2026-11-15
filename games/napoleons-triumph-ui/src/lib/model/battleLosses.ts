import { RecordedHistory, type GameAction, type RecordedTransition } from '@tabletop/common'
import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
import { firstLossOf, stepLossesIn, type StepLoss } from './attackLosses.js'
import { actionsOfTheLastAttack } from './lastAttack.js'
import type { RecordedGame } from './moveReplay.js'

export interface LossTaken {
    unit: ProjectedUnit
    loss: StepLoss
}

export interface BattleLosses {
    openedBy: string
    taken: LossTaken[]
}

type UnitTransitions = ReadonlyMap<string, RecordedTransition<ProjectedUnit[]>>

// The site opens a game before its history, so until the attack's actions are recorded there are no losses to place.
export function battleLossesOf(game: RecordedGame): BattleLosses | undefined {
    const fought = actionsOfTheLastAttack(game.actions)
    return fought
        ? lossesTakenIn(
              fought,
              new RecordedHistory(game.state, fought).select((state) => state.units)
          )
        : undefined
}

function lossesTakenIn(fought: readonly GameAction[], transitions: UnitTransitions): BattleLosses {
    return {
        openedBy: fought[0].id,
        taken: stepLossesIn(fought).flatMap((loss) => {
            const action = firstLossOf(loss.unitId, fought)
            // An action recorded without an undo patch ends the recorded history, so where a unit
            // stood before it is unknown.
            const unit = action
                ? transitions.get(action.id)?.before?.find((stood) => stood.id === loss.unitId)
                : undefined
            return unit?.position ? [{ unit, loss }] : []
        })
    }
}
