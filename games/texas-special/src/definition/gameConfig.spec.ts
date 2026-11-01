import { describe, expect, it } from 'vitest'
import { isListConfigOption } from '@tabletop/common'
import { MapId } from '../maps/types.js'
import { SarGameConfigOptions } from './gameConfig.js'

describe('the Map option', () => {
    it('offers only Texas Special, the default, withholding the other maps', () => {
        const [option] = SarGameConfigOptions
        expect(isListConfigOption(option)).toBe(true)
        if (!isListConfigOption(option)) {
            return
        }
        expect(option.default).toBe(MapId.TexasSpecial)
        expect(option.options.map((choice) => choice.value)).toEqual([MapId.TexasSpecial])
    })
})
