import type { MachineContext } from '@tabletop/common'
import type * as Type from 'typebox'
import type { HydratedPowerGridGameState } from '../model/gameState.js'

export function runSystemAction(
    context: MachineContext<HydratedPowerGridGameState>,
    schema: Type.TSchema
) {
    context.gameState.activePlayerIds = []
    context.addSystemAction(schema)
}
