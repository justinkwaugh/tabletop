import { BaseConfigurator, GameConfigurator } from '@tabletop/common'
import { SolGameConfig, SolGameConfigOptions } from './gameConfig.js'

export class SolConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = SolGameConfig
    options = SolGameConfigOptions
}
