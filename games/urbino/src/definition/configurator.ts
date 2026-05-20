import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { UrbinoGameConfig, UrbinoGameConfigOptions } from './config.js'

export class UrbinoConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = UrbinoGameConfig
    options = UrbinoGameConfigOptions
}
