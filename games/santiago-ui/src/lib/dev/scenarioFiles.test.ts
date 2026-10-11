import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { listedScenarios } from '@tabletop/frontend-components'
import { Definition } from '@tabletop/santiago'

const scenariosDir = join(import.meta.dirname, '../../../scenarios')
const names = readdirSync(scenariosDir).filter((name) => name.endsWith('.json'))

// A rules or state change that leaves a committed scenario unloadable fails here, rather than in
// the harness menu.
describe.each(names)('scenario %s', (name) => {
    it('is a scenario whose state the current rules accept', () => {
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        const [listed] = listedScenarios({
            [name]: JSON.parse(readFileSync(join(scenariosDir, name), 'utf8'))
        })
        report.mockRestore()

        expect(listed?.scenario.game.typeId).toBe(Definition.info.id)
        expect(Definition.runtime.canonicalStateValidator?.Check(listed?.scenario.state)).toBe(true)
    })
})
