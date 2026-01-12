import { BaseConfigurator } from '@tabletop/common'
import type { GameConfigurator } from '@tabletop/common'
import { ContainerGameConfig, ContainerGameConfigOptions } from './config.js'

export class ContainerConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = ContainerGameConfig
    options = ContainerGameConfigOptions
}
