import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { LwGameConfig, LwGameConfigOptions } from './gameConfig.js'

export class LwConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = LwGameConfig
    options = LwGameConfigOptions
}
