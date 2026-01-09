import { BaseConfigurator, GameConfigurator } from '@tabletop/common'
import { SampleGameConfig, SampleGameConfigOptions } from './config.js'

export class SampleConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = SampleGameConfig
    options = SampleGameConfigOptions
}
