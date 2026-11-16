import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { Definition } from '@tabletop/1822'
import { RecordedHistory } from '@tabletop/common'

const folder = new URL('../src/scenarios/', import.meta.url)
const files = (await readdir(folder)).filter((name) => name.endsWith('.json'))

for (const name of files) {
    test(`scenario ${name} is a position the harness can open`, async () => {
        const { game, state, actions } = JSON.parse(await readFile(new URL(name, folder), 'utf8'))
        assert.equal(game.typeId, Definition.info.id)
        assert.equal(Definition.runtime.canonicalStateValidator.Check(state), true)
        assert.equal(state.gameId, game.id)
        assert.ok(actions.every((action) => action.gameId === game.id))
        // History and Undo walk the recorded patches back to the start; each State they reach is valid.
        const validator = Definition.runtime.canonicalStateValidator
        const steps = new RecordedHistory(state, actions).select((reached) =>
            validator.Check(reached)
        )
        assert.equal(steps.size, actions.length)
        for (const [actionId, { before }] of steps) assert.equal(before, true, `before ${actionId}`)
    })
}
