import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { SolGameConfig, SolGameConfigOptions } from './gameConfig.js'

export class SolConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = SolGameConfig
    options = SolGameConfigOptions
}
