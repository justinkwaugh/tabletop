import { BaseConfigurator, GameConfigurator } from '@tabletop/common'
import { EstatesGameConfig, EstatesGameConfigOptions } from './gameConfig.js'

export class EstatesConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = EstatesGameConfig
    options = EstatesGameConfigOptions
}
