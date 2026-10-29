import { PlayerStatus, type GameConfig } from '@tabletop/common'
import { Definition } from '../definition/definition.js'
import { LowenherzRuntime } from '../definition/runtime.js'

export function createTestGame(count: number, config: GameConfig) {
    return LowenherzRuntime.initializer.initializeGame(
        {
            id: 'lowenherz-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}
