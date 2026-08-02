import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { LowenherzGameConfig, LowenherzGameConfigOptions } from './config.js'

export class LowenherzConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = LowenherzGameConfig
    options = LowenherzGameConfigOptions
}
