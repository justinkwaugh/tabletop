import { Type, type Static } from 'typebox'
import { BooleanConfigOption, ConfigOptionType, GameConfigOptions } from '@tabletop/common'

const useInvestmentBankOption: BooleanConfigOption = {
    id: 'useInvestmentBank',
    type: ConfigOptionType.Boolean,
    name: 'Use Investment Bank',
    description: 'Enables the Investment Bank add-on rules',
    default: true
}

export type ContainerGameConfig = Static<typeof ContainerGameConfig>
export const ContainerGameConfig = Type.Object({
    useInvestmentBank: Type.Optional(Type.Boolean({ default: useInvestmentBankOption.default }))
})

export const ContainerGameConfigOptions: GameConfigOptions = [useInvestmentBankOption]
