import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { OathGameConfig, OathGameConfigOptions, normalizeOathConfig } from './config.js'

export class OathConfigurator
    extends BaseConfigurator<OathGameConfig>
    implements GameConfigurator<OathGameConfig>
{
    normalizeConfig = normalizeOathConfig
    schema = OathGameConfig
    options = OathGameConfigOptions
}
