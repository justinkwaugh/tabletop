import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { RailheadsGameConfig, RailheadsGameConfigOptions } from './gameConfig.js'

export class RailheadsConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = RailheadsGameConfig
    options = RailheadsGameConfigOptions
}
