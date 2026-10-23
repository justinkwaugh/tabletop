import { defineGame } from '@tabletop/common'
import type {
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
} from '../model/gameState.js'
import { DickeKartoffelnInfo } from './info.js'
import { DickeKartoffelnRuntime } from './runtime.js'

export const Definition = defineGame<
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
>({
    info: DickeKartoffelnInfo,
    runtime: DickeKartoffelnRuntime
})
