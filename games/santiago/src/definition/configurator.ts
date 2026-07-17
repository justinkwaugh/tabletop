import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { SantiagoGameConfig, SantiagoGameConfigOptions } from './gameConfig.js'

export class SantiagoConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = SantiagoGameConfig
    options = SantiagoGameConfigOptions
}
