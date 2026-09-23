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
    deployBackendCommand,
    deployFrontendCommand,
    deployGameLogicCommand,
    directoryPlaceholderSpecs,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import type { CommandSpec } from './lib/commands.js'
import {
    assertGamePublishable,
    deployGame,
    publishManifest,
    releaseGame,
    type PublishContext
} from './lib/gamePublish.js'
import { getDeployConfigPath, getManifestPath, getRepoRoot } from './lib/paths.js'
import { formatPreflightReport, runReleasePreflight } from './lib/releasePreflight.js'
import { syncManifestFromPackages, type BumpType } from './lib/versions.js'

const repoRoot = getRepoRoot()
const manifestPath = getManifestPath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)

const usage = `tabletop-deploy [command]

Commands:
  tui                          Launch the TUI (default)
  status                       Print the current manifest
  sync-manifest                Sync site-manifest.json from package versions
  preflight --game=<id> [--json]
                               Report the serving and local versions, the last release
                               baseline per artifact, and which files and commits changed
                               since it, ending with whether logic and UI or only UI need
                               a release. Read-only.
  release-game --game=<id> [--logic] (--major | --minor | --patch) [--no-deploy]
                               Bump the game's package versions, sync the manifest, commit,
                               tag, push, then deploy (unless --no-deploy). Requires a clean
                               working tree on a branch. <id> is the manifest gameId or
                               packageId. Without --logic only the UI is released; with
                               --logic both logic and UI are released.
  deploy-game --game=<id> [--logic]
                               Build and deploy the game at HEAD, publish the manifest, and
                               invalidate the backend cache. Requires a clean tree, a release
                               tag on HEAD for each artifact, and an unpublished version.
                               Running with --game and no command is the same as deploy-game.
  build-ui <gameId>            Build a game UI bundle (rollup)
  deploy-ui <gameId>           deploy-game for the UI only, with the same guards
  build-logic <gameId>         Build a game logic bundle (rollup)
  deploy-logic <gameId>        Build + bundle game logic and deploy to GCS, with the same guards
  build-frontend               Build the frontend
  deploy-frontend              Deploy the frontend bundle to GCS
  build-backend                Build the backend
  deploy-backend [--with-traffic] Deploy the backend (Cloud Run)
  rollback-backend <revision>  Shift traffic to a backend revision

Release tags:
  <packageId>-v<version>       Logic artifact
  <packageId>-ui-v<version>    UI artifact

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

const runAndReport = async (
    spec: { label: string; logPath: string },
    action: () => Promise<void>
) => {
    console.log(`${spec.label}: running (log: ${spec.logPath})`)
    await action()
    console.log(`${spec.label}: complete`)
}

const runDeployWithDirectoryPlaceholders = async (spec: CommandSpec) => {
    const placeholderSpecs = directoryPlaceholderSpecs(repoRoot, spec)
    for (const placeholder of placeholderSpecs) {
        await runAndReport(placeholder, () => runCommand(placeholder))
    }
    await runAndReport(spec, () => runCommand(spec))
}

const loadSyncedManifest = async () => {
    const manifest = await readManifest(manifestPath)
    const { manifest: syncedManifest, changed } = await syncManifestFromPackages(repoRoot, manifest)
    if (changed) {
        await writeManifest(manifestPath, syncedManifest)
    }
    return syncedManifest
}

type SemverFlags = { major?: boolean; minor?: boolean; patch?: boolean }

const requestedBumps = (values: SemverFlags): BumpType[] => {
    const requested: BumpType[] = []
    if (values.major) requested.push('major')
    if (values.minor) requested.push('minor')
    if (values.patch) requested.push('patch')
    return requested
}

const resolveBumpType = (values: SemverFlags): BumpType => {
    const requested = requestedBumps(values)
    if (requested.length !== 1) {
        throw new Error('release-game requires exactly one of --major, --minor, or --patch')
    }
    return requested[0]
}

const requireGame = (command: string, game: string | undefined): string => {
    if (!game) throw new Error(`${command} requires --game=<gameId|packageId>`)
    return game
}

const requirePositionalGame = (command: string, game: string | undefined): string => {
    if (!game) throw new Error(`${command} requires a gameId`)
    return game
}

const main = async () => {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            help: { type: 'boolean', short: 'h' },
            'with-traffic': { type: 'boolean' },
            game: { type: 'string' },
            logic: { type: 'boolean' },
            major: { type: 'boolean' },
            minor: { type: 'boolean' },
            patch: { type: 'boolean' },
            'no-deploy': { type: 'boolean' },
            json: { type: 'boolean' }
        }
    })

    if (values.help) {
        console.log(usage)
        return
    }

    const command = positionals[0] ?? (values.game !== undefined ? 'deploy-game' : 'tui')

    if (command === 'tui') {
        render(<App />)
        return
    }

    if (command === 'status' || command === 'sync-manifest') {
        const manifest = await loadSyncedManifest()
        console.log(JSON.stringify(manifest, null, 2))
        return
    }

    const deployConfig = mergeEnvConfig(await readDeployConfig(deployConfigPath))
    const context: PublishContext = {
        repoRoot,
        manifestPath,
        deployConfig,
        log: (message) => console.log(message)
    }
    const includeLogic = values.logic === true

    if (command === 'preflight') {
        const report = await runReleasePreflight(
            repoRoot,
            manifestPath,
            deployConfig,
            requireGame(command, values.game)
        )
        console.log(values.json ? JSON.stringify(report, null, 2) : formatPreflightReport(report))
        return
    }

    if (command === 'release-game') {
        await releaseGame(context, {
            game: requireGame(command, values.game),
            includeLogic,
            bump: resolveBumpType(values),
            deploy: values['no-deploy'] !== true
        })
        return
    }

    if (command === 'deploy-game') {
        if (requestedBumps(values).length > 0) {
            throw new Error(
                'deploy-game does not bump versions; use release-game with --major, --minor, or --patch'
            )
        }
        await deployGame(context, { game: requireGame(command, values.game), includeLogic })
        return
    }

    if (command === 'build-ui') {
        const gameId = requirePositionalGame(command, positionals[1])
        const spec = buildGameUiCommand(repoRoot, gameId)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-ui') {
        const gameId = requirePositionalGame(command, positionals[1])
        await deployGame(context, { game: gameId, includeLogic: false })
        return
    }

    if (command === 'build-logic') {
        const gameId = requirePositionalGame(command, positionals[1])
        const spec = buildGameLogicCommand(repoRoot, gameId)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-logic') {
        const gameId = requirePositionalGame(command, positionals[1])
        const { entry, manifest } = await assertGamePublishable(context, gameId, ['logic'])
        const buildSpec = buildGameLogicPackageCommand(repoRoot, entry.packageId)
        await runAndReport(buildSpec, () => runCommand(buildSpec))
        const bundleSpec = buildGameLogicCommand(repoRoot, entry.packageId)
        await runAndReport(bundleSpec, () => runCommand(bundleSpec))
        await runDeployWithDirectoryPlaceholders(
            deployGameLogicCommand(repoRoot, manifest, entry.packageId, deployConfig)
        )
        await publishManifest(context)
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
