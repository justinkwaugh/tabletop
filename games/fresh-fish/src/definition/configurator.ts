import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { FreshFishGameConfig, FreshFishGameConfigOptions } from './gameConfig.js'

export class FreshFishConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = FreshFishGameConfig
    options = FreshFishGameConfigOptions
}
