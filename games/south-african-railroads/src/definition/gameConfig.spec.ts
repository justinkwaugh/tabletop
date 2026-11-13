import { describe, expect, it } from 'vitest'
import { isListConfigOption } from '@tabletop/common'
import { MapId } from '../maps/types.js'
import { SarGameConfigOptions } from './gameConfig.js'

describe('the Map option', () => {
    it('offers every map, South African Railroads first and the default', () => {
        const [option] = SarGameConfigOptions
        expect(isListConfigOption(option)).toBe(true)
        if (!isListConfigOption(option)) {
            return
        }
        expect(option.default).toBe(MapId.SouthAfrica)
        expect(option.options.map((choice) => choice.value)).toEqual([
            MapId.SouthAfrica,
            MapId.Pennsylvania,
            MapId.TexasSpecial,
            MapId.Veld
        ])
    })
})
