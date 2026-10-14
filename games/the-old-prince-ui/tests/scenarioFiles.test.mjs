import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { Definition } from '@tabletop/the-old-prince'

const folder = new URL('../src/scenarios/', import.meta.url)
const files = (await readdir(folder)).filter((name) => name.endsWith('.json'))

for (const name of files) {
    test(`scenario ${name} is a position the harness can open`, async () => {
        const { game, state, actions } = JSON.parse(await readFile(new URL(name, folder), 'utf8'))
        assert.equal(game.typeId, Definition.info.id)
        assert.equal(Definition.runtime.canonicalStateValidator.Check(state), true)
        assert.equal(state.gameId, game.id)
        assert.ok(actions.every((action) => action.gameId === game.id))
    })
}
