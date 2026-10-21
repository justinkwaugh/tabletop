import * as Type from 'typebox'
import { BaseConfigurator, type GameConfigOptions, type GameConfigurator } from '@tabletop/common'

const Schema = Type.Object({}, { additionalProperties: false })

export class EighteenNinetyFourConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = Schema
    options: GameConfigOptions = []
}
