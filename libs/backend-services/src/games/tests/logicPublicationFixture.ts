import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { SiteManifest } from '@tabletop/games-config'
import { SyntheticDefinition } from './syntheticGame.js'

export async function logicPublicationFixture() {
    const directory = await mkdtemp(path.join(tmpdir(), 'logic-publication-'))
    const manifestPath = path.join(directory, 'manifest.json')
    const titleId = SyntheticDefinition.info.id
    const packageId = 'synthetic'
    const manifest = (version: string): SiteManifest => ({
        frontend: { version: '1.0.0' },
        games: [{ gameId: titleId, packageId, logicVersion: version, uiVersion: version }]
    })
    const bundles = new Map<string, string>()
    async function artifact(
        version: string,
        format: 'cjs' | 'esm' = 'cjs',
        actionTypes?: string[]
    ) {
        const target = path.join(directory, packageId, 'logic', version)
        await mkdir(target, { recursive: true })
        let bundle = bundles.get(format)
        if (!bundle) {
            bundle = buildSync({
                stdin: {
                    contents: `import { SyntheticDefinition } from './syntheticGame.js';
                        import { Type } from 'typebox';
                        import { GameAction } from '@tabletop/common';
                        const Definition = SyntheticDefinition;
                        export { Definition };
                        export function setTestActions(names) {
                            Definition.runtime.apiActions = Object.fromEntries(names.map(name => [name,
                                Type.Object({ ...Type.Omit(GameAction, ['createdAt', 'updatedAt']).properties,
                                    type: Type.Literal(name), count: Type.Integer({ minimum: 1 })
                                }, { additionalProperties: false })
                            ]));
                        }`,
                    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
                    loader: 'ts'
                },
                bundle: true,
                write: false,
                platform: 'node',
                format,
                logLevel: 'silent'
            }).outputFiles[0].text
            bundles.set(format, bundle)
        }
        const namespace = format === 'cjs' ? 'module.exports.' : ''
        const source =
            `${bundle}\n${namespace}Definition.info.metadata.version = ${JSON.stringify(version)};\n` +
            (actionTypes ? `${namespace}setTestActions(${JSON.stringify(actionTypes)});` : '')
        await writeFile(path.join(target, format === 'cjs' ? 'index.cjs' : 'index.js'), source)
        return target
    }
    async function publish(value: SiteManifest) {
        await writeFile(manifestPath, JSON.stringify(value))
    }
    return {
        directory,
        manifestPath,
        titleId,
        manifest,
        artifact,
        publish,
        close: () => rm(directory, { recursive: true, force: true })
    }
}
