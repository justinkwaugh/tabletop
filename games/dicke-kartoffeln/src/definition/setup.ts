import { Compile } from 'typebox/compile'
import { assert, type GameConfig } from '@tabletop/common'
import { DEFAULT_GAME_LENGTH, DickeKartoffelnGameConfig, MessageRule } from './gameConfig.js'

export const DickeKartoffelnGameConfigValidator = Compile(DickeKartoffelnGameConfig)

export type DickeKartoffelnSetup = {
    years: number
    messages: MessageRule
    strictEcology: boolean
}

export function readSetup(config: GameConfig): DickeKartoffelnSetup {
    assert(
        DickeKartoffelnGameConfigValidator.Check(config),
        'Game configuration is not a Dicke Kartoffeln setup'
    )
    return {
        years: Number(config.years ?? DEFAULT_GAME_LENGTH),
        messages: config.messages ?? MessageRule.EveryYear,
        strictEcology: config.strictEcology ?? false
    }
}

export function messagesInYear(setup: DickeKartoffelnSetup, year: number): boolean {
    switch (setup.messages) {
        case MessageRule.EveryYear:
            return true
        case MessageRule.FromSecondYear:
            return year >= 2
        case MessageRule.Never:
            return false
    }
}

export function usesMessages(setup: DickeKartoffelnSetup): boolean {
    return setup.messages !== MessageRule.Never
}
