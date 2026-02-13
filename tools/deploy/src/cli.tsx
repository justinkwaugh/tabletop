#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { parseArgs } from 'node:util'
import App from './app.js'
import { readManifest, writeManifest } from './lib/manifest.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import {
    buildBackendCommand,
    buildFrontendCommand,
    buildGameLogicCommand,
    buildGameLogicPackageCommand,
    buildGameUiCommand,
    buildGameUiPackageCommand,
    deployBackendCommand,
    deployFrontendCommand,
    deployGameLogicCommand,
    deployGameUiCommand,
    gcsDirectoryPlaceholderCommands,
    gcsRsyncDirectoryPlaceholderCommands,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import type { CommandSpec } from './lib/commands.js'
import { getDeployConfigPath, getManifestPath, getRepoRoot } from './lib/paths.js'
import { syncManifestFromPackages } from './lib/versions.js'

const repoRoot = getRepoRoot()
const manifestPath = getManifestPath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)

const usage = `tabletop-deploy [command]

Commands:
  tui                          Launch the TUI (default)
  status                       Print the current manifest
  sync-manifest                Sync site-manifest.json from package versions
  build-ui <gameId>            Build a game UI bundle (rollup)
  deploy-ui <gameId>           Build + bundle a game UI and deploy to GCS
  build-logic <gameId>         Build a game logic bundle (rollup)
  deploy-logic <gameId>        Build + bundle game logic and deploy to GCS
  build-frontend               Build the frontend
  deploy-frontend              Deploy the frontend bundle to GCS
  build-backend                Build the backend
  deploy-backend [--with-traffic] Deploy the backend (Cloud Run)
  rollback-backend <revision>  Shift traffic to a backend revision

Environment:
  TABLETOP_GCS_BUCKET           GCS bucket name
  TABLETOP_BACKEND_SERVICE      Cloud Run service name
  TABLETOP_BACKEND_REGION       Cloud Run region
  GCLOUD_PROJECT                GCP project
  TABLETOP_BACKEND_MANIFEST_URL Backend /manifest URL
  TABLETOP_BACKEND_ADMIN_URL    Backend admin invalidate URL
  TABLETOP_BACKEND_ADMIN_USER   Backend admin username
  TABLETOP_BACKEND_ADMIN_PASSWORD Backend admin password
  TABLETOP_BACKEND_ADMIN_TOKEN  Backend admin auth token
  TABLETOP_BACKEND_ADMIN_COOKIE Backend admin session cookie
  CLOUDSDK_PYTHON               Python runtime for Cloud SDK commands
  TABLETOP_GCS_ACCESS_TOKEN     Access token used for GCS placeholder creation
`

const runAndReport = async (spec: { label: string; logPath: string }, action: () => Promise<void>) => {
    console.log(`${spec.label}: running (log: ${spec.logPath})`)
    await action()
    console.log(`${spec.label}: complete`)
}

const directoryPlaceholderSpecs = (spec: CommandSpec): CommandSpec[] => {
    if (spec.command !== 'gcloud') return []
    if (spec.args[0] !== 'storage') return []
    if (spec.args.length < 2) return []
    const operation = spec.args[1]
    if (operation !== 'rsync' && operation !== 'cp') return []
    const source = spec.args[spec.args.length - 2]
    const destination = spec.args[spec.args.length - 1]
    if (!destination.startsWith('gs://')) return []
    if (operation === 'rsync' && !source.startsWith('gs://')) {
        return gcsRsyncDirectoryPlaceholderCommands(repoRoot, source, destination, {
            labelPrefix: spec.label,
            logPrefix: spec.logPath
        })
    }
    return gcsDirectoryPlaceholderCommands(repoRoot, destination, {
        treatDestinationAsObject: operation === 'cp',
        labelPrefix: spec.label,
        logPrefix: spec.logPath
    })
}

const runDeployWithDirectoryPlaceholders = async (spec: CommandSpec) => {
    const placeholderSpecs = directoryPlaceholderSpecs(spec)
    for (const placeholder of placeholderSpecs) {
        await runAndReport(placeholder, () => runCommand(placeholder))
    }
    await runAndReport(spec, () => runCommand(spec))
}

const loadSyncedManifest = async () => {
    const manifest = await readManifest(manifestPath)
    const { manifest: syncedManifest, changed } = await syncManifestFromPackages(
        repoRoot,
        manifest
    )
    if (changed) {
        await writeManifest(manifestPath, syncedManifest)
    }
    return syncedManifest
}

const main = async () => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            help: { type: 'boolean', short: 'h' },
            'with-traffic': { type: 'boolean' }
        }
    })

    if (values.help) {
        console.log(usage)
        return
    }

    const command = positionals[0] ?? 'tui'

    if (command === 'tui') {
        render(<App />)
        return
    }

    if (command === 'status') {
        const manifest = await loadSyncedManifest()
        console.log(JSON.stringify(manifest, null, 2))
        return
    }

    if (command === 'sync-manifest') {
        const manifest = await loadSyncedManifest()
        console.log(JSON.stringify(manifest, null, 2))
        return
    }

    const deployConfig = mergeEnvConfig(await readDeployConfig(deployConfigPath))

    if (command === 'build-ui') {
        const gameId = positionals[1]
        if (!gameId) throw new Error('build-ui requires a gameId')
        const spec = buildGameUiCommand(repoRoot, gameId)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-ui') {
        const gameId = positionals[1]
        if (!gameId) throw new Error('deploy-ui requires a gameId')
        const buildSpec = buildGameUiPackageCommand(repoRoot, gameId)
        await runAndReport(buildSpec, () => runCommand(buildSpec))
        const bundleSpec = buildGameUiCommand(repoRoot, gameId)
        await runAndReport(bundleSpec, () => runCommand(bundleSpec))
        const manifest = await loadSyncedManifest()
        const spec = deployGameUiCommand(repoRoot, manifest, gameId, deployConfig)
        await runDeployWithDirectoryPlaceholders(spec)
        return
    }

    if (command === 'build-logic') {
        const gameId = positionals[1]
        if (!gameId) throw new Error('build-logic requires a gameId')
        const spec = buildGameLogicCommand(repoRoot, gameId)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-logic') {
        const gameId = positionals[1]
        if (!gameId) throw new Error('deploy-logic requires a gameId')
        const buildSpec = buildGameLogicPackageCommand(repoRoot, gameId)
        await runAndReport(buildSpec, () => runCommand(buildSpec))
        const bundleSpec = buildGameLogicCommand(repoRoot, gameId)
        await runAndReport(bundleSpec, () => runCommand(bundleSpec))
        const manifest = await loadSyncedManifest()
        const spec = deployGameLogicCommand(repoRoot, manifest, gameId, deployConfig)
        await runDeployWithDirectoryPlaceholders(spec)
        return
    }

    if (command === 'build-frontend') {
        const spec = buildFrontendCommand(repoRoot)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-frontend') {
        const manifest = await loadSyncedManifest()
        const spec = deployFrontendCommand(repoRoot, manifest, deployConfig)
        await runDeployWithDirectoryPlaceholders(spec)
        return
    }

    if (command === 'build-backend') {
        const spec = buildBackendCommand(repoRoot)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-backend') {
        const allowTraffic = values['with-traffic'] === true
        const spec = deployBackendCommand(repoRoot, deployConfig, { allowTraffic })
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'rollback-backend') {
        const revision = positionals[1]
        if (!revision) throw new Error('rollback-backend requires a revision name')
        const spec = rollbackBackendCommand(repoRoot, revision, deployConfig)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    console.error(`Unknown command: ${command}`)
    console.log(usage)
    process.exitCode = 1
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
