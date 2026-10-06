import { expect, it } from 'vitest'
import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import { PlaygroundTitles } from '../titles.js'

it.each(PlaygroundTitles.map((title) => [title.name, title] as const))(
    '%s declares the shared 18xx preferences',
    (_name, title) => {
        expect(title.scenarios.info.preferences).toBe(EighteenXXPreferenceDefinition)
    }
)
