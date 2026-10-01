import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { OathGameConfig, OathGameConfigOptions } from './config.js'

export class OathConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = OathGameConfig
    options = OathGameConfigOptions
}
