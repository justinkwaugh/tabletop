import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { compileFunction } from 'node:vm'
import { createRequire } from 'node:module'
import { buildLogicFactorySource, collectibleChunkProblem } from './logic-factory.js'

const evaluate = (source, filename) => {
    const module = { exports: {} }
    compileFunction(source, ['exports', 'require', 'module'], { filename })(
        module.exports,
        createRequire(filename),
        module
    )
    return module.exports
}

test('a published ESM bundle converts to a factory the backend can evaluate', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logic-factory-'))
    try {
        const esm = join(directory, 'index.js')
        await writeFile(
            esm,
            `import { createHash } from 'node:crypto';
             export const Definition = { info: { id: 'test', metadata: { version: '1.0.0' } },
                 runtime: { apiActions: {} }, digest: createHash('sha256').update('x').digest('hex') };`
        )
        const { Definition } = evaluate(
            await buildLogicFactorySource(esm),
            join(directory, 'index.cjs')
        )
        assert.equal(Definition.info.metadata.version, '1.0.0')
        assert.equal(Definition.digest.length, 64)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})

test('a bundle that still imports a package is not collectible', async () => {
    assert.equal(
        collectibleChunkProblem({ imports: ['node:crypto'], dynamicImports: [] }),
        undefined
    )
    assert.match(collectibleChunkProblem({ imports: ['typebox'], dynamicImports: [] }), /builtin/)
    assert.match(
        collectibleChunkProblem({ imports: [], dynamicImports: ['./x.js'] }),
        /single bundle/
    )
    const directory = await mkdtemp(join(tmpdir(), 'logic-factory-'))
    try {
        const esm = join(directory, 'index.js')
        await writeFile(esm, `import x from 'some-package'; export const Definition = x;`)
        await assert.rejects(buildLogicFactorySource(esm), /builtin/)
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
