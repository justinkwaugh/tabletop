import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import AjvCompiler from '@fastify/ajv-compiler'
import { actionRequestSchema, titleActionAjvOptions } from '@tabletop/common'
import { evaluateLogicFactory } from '@tabletop/common/node/collectible-factory'
import { logicValidators } from './logic-validators.js'

test('standalone validators preserve Fastify coercion, dates, and validation errors', async () => {
    const entry = fileURLToPath(new URL('./.test-logic-entry.js', import.meta.url))
    const directory = fileURLToPath(new URL('./.test-logic-output', import.meta.url))
    const build = await rollup({
        input: entry,
        plugins: [
            {
                name: 'fixture',
                resolveId: (id) => (id === entry ? id : undefined),
                load: (id) =>
                    id === entry
                        ? `
                    import { GameAction } from '@tabletop/common';
                    export const Definition = { info: { id: 'test', metadata: { version: '1.0.0' } },
                        runtime: { apiActions: { test: GameAction } } };
                `
                        : undefined
            },
            resolve({ preferBuiltins: true }),
            commonjs(),
            logicValidators(directory)
        ]
    })
    try {
        const { output } = await build.generate({ format: 'cjs', inlineDynamicImports: true })
        const chunk = output.find((item) => item.type === 'chunk')
        const validators = output.find((item) => item.fileName === 'validators.cjs')
        assert(chunk)
        assert(validators && typeof validators.source === 'string')
        const { Definition } = evaluateLogicFactory(chunk.code, `${directory}/index.cjs`)
        const compiled = evaluateLogicFactory(validators.source, `${directory}/validators.cjs`)
        const reference = AjvCompiler()({}, titleActionAjvOptions)({
            schema: actionRequestSchema(Definition.runtime.apiActions.test),
            method: 'POST',
            url: '/test',
            httpPart: 'body'
        })
        const valid = {
            gameId: 42,
            action: { id: 123, gameId: 42, source: 'user', type: 'test', index: '2' }
        }
        for (const body of [
            valid,
            {},
            { ...valid, extra: true },
            { ...valid, action: { ...valid.action, createdAt: 'bad' } },
            { ...valid, action: { ...valid.action, createdAt: '2026-10-20T00:00:00Z' } }
        ]) {
            const expected = structuredClone(body)
            const actual = structuredClone(body)
            assert.equal(compiled['action:test'](actual), reference(expected))
            assert.deepEqual(actual, expected)
            assert.deepEqual(compiled['action:test'].errors, reference.errors)
        }
        const body = structuredClone(valid)
        assert.equal(compiled['action:test'](body), true)
        assert.equal(body.action.index, 2)
        assert.equal(body.gameId, '42')
        assert.equal(typeof compiled.create, 'function')
    } finally {
        await build.close()
    }
})

test('a published ESM bundle converts to a factory the backend can evaluate', async () => {
    const { buildLogicFactorySource } = await import('./logic-sidecars.js')
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const directory = await mkdtemp(join(tmpdir(), 'logic-sidecars-'))
    try {
        const esm = join(directory, 'index.js')
        await writeFile(
            esm,
            `import { createHash } from 'node:crypto';
             export const Definition = { info: { id: 'test', metadata: { version: '1.0.0' } },
                 runtime: { apiActions: {} }, digest: createHash('sha256').update('x').digest('hex') };`
        )
        const source = await buildLogicFactorySource(esm)
        const { Definition } = evaluateLogicFactory(source, join(directory, 'index.cjs'))
        assert.equal(Definition.info.metadata.version, '1.0.0')
        assert.equal(Definition.digest.length, 64)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
