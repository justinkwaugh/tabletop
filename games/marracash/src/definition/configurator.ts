import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { MarracashGameConfig, MarracashGameConfigOptions } from './config.js'

export class MarracashConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = MarracashGameConfig
    options = MarracashGameConfigOptions
}
