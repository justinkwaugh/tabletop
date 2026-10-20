import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { evaluateLogicFactory } from '@tabletop/common/node/collectible-factory'
import { buildLogicFactorySource } from '@tabletop/rollup-config/logic-factory'
import { gcsPathExists } from './gcs.js'
import { runCommand, type CommandSpec } from './commands.js'
import { fetchBucketManifest } from './remoteManifest.js'
import { assertDeployConfig, type PublishContext } from './publishCore.js'
import type { GameManifestEntry } from './types.js'

// Logic artifacts published before the build emitted it lack the collectible factory the backend
// activates in place. Migration adds it beside the immutable ESM bundle; nothing already
// published changes.
export const SIDECAR_FILES = ['index.cjs'] as const

export type LogicArtifactPlan = {
    packageId: string
    gameId: string
    version: string
    url: string
    missing: string[]
}

// The versions the manifest can select for a title: the current one and its rollback history.
export const selectableLogicVersions = (entry: GameManifestEntry): string[] => [
    ...new Set([
        entry.logicVersion,
        ...(entry.history ?? []).map((record) => record.logicVersion),
        ...(entry.priorLogicVersions ?? [])
    ])
]

const logicArtifactUrl = (bucket: string, packageId: string, version: string) =>
    `gs://${bucket}/games/${packageId}/logic/${version}`

export const planLogicArtifactMigration = async (
    entries: GameManifestEntry[],
    bucket: string,
    exists: (url: string) => Promise<boolean> = gcsPathExists
): Promise<LogicArtifactPlan[]> => {
    const plans: LogicArtifactPlan[] = []
    for (const entry of entries) {
        for (const version of selectableLogicVersions(entry)) {
            if (!version) continue
            const url = logicArtifactUrl(bucket, entry.packageId, version)
            const missing: string[] = []
            for (const file of SIDECAR_FILES) {
                if (!(await exists(`${url}/${file}`))) missing.push(file)
            }
            if (missing.length) {
                plans.push({
                    packageId: entry.packageId,
                    gameId: entry.gameId,
                    version,
                    url,
                    missing
                })
            }
        }
    }
    return plans
}

const copyCommand = (
    repoRoot: string,
    label: string,
    source: string,
    destination: string
): CommandSpec => ({
    label,
    command: 'gcloud',
    args: ['storage', 'cp', source, destination],
    cwd: repoRoot,
    logPath: `/tmp/${label.replace(/[^A-Za-z0-9._-]+/g, '-')}.log`,
    requiresDeploy: true
})

// Builds a published artifact's factory from its ESM bundle into `directory` and checks it
// evaluates to the Definition the manifest names before anything is uploaded.
export const buildLogicSidecars = async (
    plan: LogicArtifactPlan,
    esmFilename: string,
    directory: string
): Promise<string[]> => {
    const factory = await buildLogicFactorySource(esmFilename)
    const loaded: unknown = evaluateLogicFactory(factory, path.join(directory, 'index.cjs'))
    const definition =
        typeof loaded === 'object' && loaded !== null && 'Definition' in loaded
            ? loaded.Definition
            : undefined
    if (
        typeof definition !== 'object' ||
        definition === null ||
        !('info' in definition) ||
        !('runtime' in definition)
    ) {
        throw new Error(`${plan.url}/index.js has no Definition`)
    }
    const info = (definition as { info: { id: string; metadata: { version: string } } }).info
    if (info.id !== plan.gameId || info.metadata.version !== plan.version) {
        throw new Error(
            `${plan.url}/index.js is ${info.id} ${info.metadata.version}, not ${plan.gameId} ${plan.version}`
        )
    }
    const target = path.join(directory, 'index.cjs')
    await fs.writeFile(target, factory)
    return [target]
}

export const migrateLogicArtifacts = async (
    context: PublishContext,
    options: { apply: boolean; game?: string }
): Promise<LogicArtifactPlan[]> => {
    const bucket = assertDeployConfig(context.deployConfig)
    const manifest = await fetchBucketManifest(context.deployConfig)
    const entries = manifest.games.filter(
        (entry) =>
            !options.game || entry.gameId === options.game || entry.packageId === options.game
    )
    if (options.game && !entries.length) throw new Error(`Unknown game "${options.game}"`)
    const plans = await planLogicArtifactMigration(entries, bucket)
    if (!plans.length) {
        context.log('every selectable logic artifact already has its factory')
        return plans
    }
    for (const plan of plans) {
        context.log(`${plan.url}: missing ${plan.missing.join(', ')}`)
    }
    if (!options.apply) {
        context.log('plan only; rerun with --apply to build and upload the missing files')
        return plans
    }
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tabletop-logic-migration-'))
    try {
        for (const plan of plans) {
            const directory = path.join(workspace, plan.packageId, plan.version)
            await fs.mkdir(directory, { recursive: true })
            const esm = path.join(directory, 'index.js')
            await runCommand(
                copyCommand(
                    context.repoRoot,
                    `fetch-logic:${plan.packageId}@${plan.version}`,
                    `${plan.url}/index.js`,
                    esm
                )
            )
            const files = await buildLogicSidecars(plan, esm, directory)
            for (const file of files) {
                await runCommand(
                    copyCommand(
                        context.repoRoot,
                        `upload-${path.basename(file)}:${plan.packageId}@${plan.version}`,
                        file,
                        `${plan.url}/${path.basename(file)}`
                    )
                )
            }
            context.log(`${plan.url}: added ${files.map((file) => path.basename(file)).join(', ')}`)
        }
    } finally {
        await fs.rm(workspace, { recursive: true, force: true })
    }
    return plans
}
