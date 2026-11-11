import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import {
    FreshFishGameConfig,
    FreshFishGameConfigOptions,
    normalizeFreshFishConfig
} from './gameConfig.js'

export class FreshFishConfigurator
    extends BaseConfigurator<FreshFishGameConfig>
    implements GameConfigurator<FreshFishGameConfig>
{
    normalizeConfig = normalizeFreshFishConfig
    schema = FreshFishGameConfig
    options = FreshFishGameConfigOptions
}
