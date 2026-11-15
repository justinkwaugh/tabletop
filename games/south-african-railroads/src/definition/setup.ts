import { Compile } from 'typebox/compile'
import { assert, type GameConfig } from '@tabletop/common'
import { MapId } from '../maps/types.js'
import { SarGameConfig } from './gameConfig.js'

export const SarGameConfigValidator = Compile(SarGameConfig)

export type SarSetup = { mapId: MapId }

export function readSarSetup(config: GameConfig): SarSetup {
    assert(
        SarGameConfigValidator.Check(config),
        'Game configuration is not a South African Railroads setup'
    )
    return { mapId: config.map ?? MapId.SouthAfrica }
}
