import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import {
    LowenherzGameConfig,
    LowenherzGameConfigOptions,
    normalizeLowenherzConfig
} from './config.js'

export class LowenherzConfigurator
    extends BaseConfigurator<LowenherzGameConfig>
    implements GameConfigurator<LowenherzGameConfig>
{
    normalizeConfig = normalizeLowenherzConfig
    schema = LowenherzGameConfig
    options = LowenherzGameConfigOptions
}

export const lowenherzConfigurator = new LowenherzConfigurator()
