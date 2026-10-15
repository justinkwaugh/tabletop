import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { ReefEncounterGameConfig, ReefEncounterGameConfigOptions } from './config.js'

export class ReefEncounterConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = ReefEncounterGameConfig
    options = ReefEncounterGameConfigOptions
}
