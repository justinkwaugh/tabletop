import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { SarGameConfig, SarGameConfigOptions } from './gameConfig.js'

export class SarConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = SarGameConfig
    options = SarGameConfigOptions
}
