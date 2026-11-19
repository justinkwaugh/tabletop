import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Compile } from 'typebox/compile'

export type YPlayerState = PlayerState
export const YPlayerState = PlayerState

export const YPlayerStateValidator = Compile(YPlayerState)

export class HydratedYPlayerState extends Hydratable<typeof YPlayerState> implements YPlayerState {
    declare playerId: string
    declare color: Color

    constructor(data: YPlayerState) {
        super(data, YPlayerStateValidator)
    }
}
