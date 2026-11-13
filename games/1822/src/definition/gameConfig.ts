import * as Type from 'typebox'
import { BaseConfigurator, type GameConfigOptions, type GameConfigurator } from '@tabletop/common'

const Schema = Type.Object({}, { additionalProperties: false })

export const GameConfig1822 = { schema: Schema }

export class Configurator1822 extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = []
}
