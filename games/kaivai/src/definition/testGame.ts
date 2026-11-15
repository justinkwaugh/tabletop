import { PlayerStatus, type GameConfig } from '@tabletop/common'
import { Definition } from './gameDefinition.js'
import { KaivaiRuntime } from './runtime.js'

export function createTestGame(count: number, config: GameConfig) {
    return KaivaiRuntime.initializer.initializeGame(
        {
            id: 'kaivai-test',
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
