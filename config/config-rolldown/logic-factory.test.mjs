import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { compileFunction } from 'node:vm'
import { createRequire } from 'node:module'
import { rolldown } from 'rolldown'
import {
    asciiOutput,
    collectibleChunkProblem,
    collectibleLogic,
    nonAsciiProblem
} from './logic-factory.js'

const evaluate = (source, filename) => {
    const module = { exports: {} }
    compileFunction(source, ['exports', 'require', 'module'], { filename })(
        module.exports,
        createRequire(filename),
        module
    )
    return module.exports
}

// Builds an entry the way a title's logic build emits its factory.
const buildLogicFactory = async (directory, source) => {
    const entry = join(directory, 'index.js')
    await writeFile(entry, source)
    const build = await rolldown({
        input: entry,
        plugins: [collectibleLogic()],
        logLevel: 'silent'
    })
    try {
        const { output } = await build.generate({
            format: 'cjs',
            codeSplitting: false,
            ...asciiOutput
        })
        return output[0].code
    } finally {
        await build.close()
    }
}

test('a logic factory is ASCII-only and its strings keep their characters', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'logic-factory-'))
    try {
        const source = await buildLogicFactory(
            directory,
            `/** Rule \u00a712: pays \u00a550 \u2014 once. */
             /*! kept-licence - MIT License */
             export const Definition = { currency: '\u00a5', bonus: \`\u20bd10 \u2014 per train\`,
                 dash: /\u2013/.test('1\u20132') };`
        )
        assert.equal(nonAsciiProblem(source), undefined)
        assert.match(source, /kept-licence/)
        assert.deepEqual(evaluate(source, join(directory, 'index.cjs')).Definition, {
            currency: '\u00a5',
            bonus: '\u20bd10 \u2014 per train',
            dash: true
        })
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})

test('a logic build fails on a character Rolldown cannot escape', async () => {
    assert.equal(nonAsciiProblem('const plain = "\\u00a5"'), undefined)
    assert.match(nonAsciiProblem('const a = 1\nconst yen = "\u00a5"'), /line 2 .* U\+00A5/)
    const directory = await mkdtemp(join(tmpdir(), 'logic-factory-'))
    try {
        await assert.rejects(
            buildLogicFactory(directory, 'export const Definition = String.raw`\u00a5`'),
            /ASCII-only.*U\+00A5/
        )
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})

test('a logic build that still imports a package is not collectible', async () => {
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
        await assert.rejects(
            buildLogicFactory(
                directory,
                `import x from 'some-package'; export const Definition = x;`
            ),
            /builtin/
        )
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
