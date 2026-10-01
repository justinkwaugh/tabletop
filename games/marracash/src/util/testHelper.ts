import { defaultGameConfig, normalizeGameConfig, PlayerStatus } from '@tabletop/common'
import type { MarracashGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { MarracashInfo } from '../definition/info.js'
import { MarracashRuntime } from '../definition/runtime.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<MarracashGameConfig> = {}) {
    return MarracashRuntime.initializer.initializeGame(
        {
            id: 'marracash-test',
            typeId: MarracashInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(MarracashInfo.configurator?.options ?? []),
                ...config
            }),
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
