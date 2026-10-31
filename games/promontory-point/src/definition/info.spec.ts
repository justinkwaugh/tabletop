import { GameVisibility, defaultGameConfig, normalizeGameConfig } from '@tabletop/common'
import { Value } from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { PromontoryPointGameConfig, normalizePromontoryPointConfig } from './config.js'
import { PromontoryPointInfo } from './info.js'
import { GAME_VERSION } from './version.js'

describe('Promontory Point listing', () => {
    it('reports the package version, 0.1.0', () => {
        expect(GAME_VERSION).toBe('0.1.0')
        expect(PromontoryPointInfo.metadata.version).toBe(GAME_VERSION)
    })

    it('is listed at Alpha and in beta', () => {
        expect(PromontoryPointInfo.metadata.visibility).toBe(GameVisibility.Alpha)
        expect(PromontoryPointInfo.metadata.beta).toBe(true)
    })

    it('seats 2 to 4 players, 4 by default, with no BoardGameGeek entry', () => {
        expect(PromontoryPointInfo.id).toBe('promontory-point')
        expect(PromontoryPointInfo.metadata.name).toBe('Promontory Point')
        expect(PromontoryPointInfo.metadata.minPlayers).toBe(2)
        expect(PromontoryPointInfo.metadata.maxPlayers).toBe(4)
        expect(PromontoryPointInfo.metadata.defaultPlayerCount).toBe(4)
        expect(PromontoryPointInfo.metadata).not.toHaveProperty('bggId')
    })
})

describe('Promontory Point configuration', () => {
    it('R-6.3-H1: names the four-piece variant as an optional boolean option', () => {
        expect(Value.Check(PromontoryPointGameConfig, {})).toBe(true)
        expect(Value.Check(PromontoryPointGameConfig, { fourPieceVariant: true })).toBe(true)
        expect(Value.Check(PromontoryPointGameConfig, { fourPieceVariant: false })).toBe(true)
        expect(Value.Check(PromontoryPointGameConfig, { fourPieceVariant: 'yes' })).toBe(false)
    })
    it('R-6.3-H1: normalizes a missing four-piece variant to false and keeps a stated one', () => {
        const configurator = PromontoryPointInfo.configurator
        expect(configurator).toBeDefined()
        expect(normalizeGameConfig({}, configurator)).toEqual({ fourPieceVariant: false })
        expect(normalizeGameConfig({ fourPieceVariant: null }, configurator)).toEqual({
            fourPieceVariant: false
        })
        expect(normalizePromontoryPointConfig({ fourPieceVariant: true })).toEqual({
            fourPieceVariant: true
        })
        const normalized = normalizePromontoryPointConfig({})
        expect(normalizePromontoryPointConfig(normalized)).toEqual(normalized)
        expect(() => normalizePromontoryPointConfig({ fourPieceVariant: 'yes' })).toThrow()
    })

    it('R-6.3-H1: offers the four-piece variant, off by default', () => {
        const configurator = PromontoryPointInfo.configurator
        expect(configurator?.options.map((option) => option.id)).toEqual(['fourPieceVariant'])
        expect(defaultGameConfig(configurator?.options ?? [])).toEqual({ fourPieceVariant: false })
    })
})
