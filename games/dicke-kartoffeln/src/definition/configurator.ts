import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { DickeKartoffelnGameConfig, DickeKartoffelnGameConfigOptions } from './gameConfig.js'

export class DickeKartoffelnConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = DickeKartoffelnGameConfig
    options = DickeKartoffelnGameConfigOptions
}
