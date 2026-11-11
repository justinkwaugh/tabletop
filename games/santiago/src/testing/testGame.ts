import { PlayerStatus, type GameConfig } from '@tabletop/common'
import { Definition } from '../definition/gameDefinition.js'
import { SantiagoRuntime } from '../definition/runtime.js'

export function createTestGame(count: number, config: GameConfig) {
    return SantiagoRuntime.initializer.initializeGame(
        {
            id: 'santiago-test',
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
