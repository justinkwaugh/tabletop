import { Compile } from 'typebox/compile'
import { assert, type GameConfig } from '@tabletop/common'
import { EditionId } from '../editions/types.js'
import { RailheadsGameConfig } from './gameConfig.js'

export const RailheadsGameConfigValidator = Compile(RailheadsGameConfig)

export type RailheadsSetup = { editionId: EditionId; offTheRails: boolean }

export function readRailheadsSetup(config: GameConfig): RailheadsSetup {
    assert(
        RailheadsGameConfigValidator.Check(config),
        'Game configuration is not a Railheads setup'
    )
    return {
        editionId: config.edition ?? EditionId.Germany,
        offTheRails: config.offTheRails ?? false
    }
}
