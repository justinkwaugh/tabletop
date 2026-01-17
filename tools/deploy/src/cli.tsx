#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { parseArgs } from 'node:util'
import App from './app.js'
import { readManifest } from './lib/manifest.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import {
    buildBackendCommand,
    buildFrontendCommand,
    buildGameUiCommand,
    deployBackendCommand,
    deployFrontendCommand,
    deployGameUiCommand,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import { getDeployConfigPath, getManifestPath, getRepoRoot } from './lib/paths.js'

const repoRoot = getRepoRoot()
const manifestPath = getManifestPath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)

const usage = `tabletop-deploy [command]

Commands:
  tui                          Launch the TUI (default)
  status                       Print the current manifest
  build-ui <gameId>            Build a game UI bundle (rollup)
  deploy-ui <gameId>           Deploy a game UI bundle to GCS
  build-frontend               Build the frontend
  deploy-frontend              Deploy the frontend bundle to GCS
  build-backend                Build the backend
  deploy-backend [--with-traffic] Deploy the backend (Cloud Run)
  rollback-backend <revision>  Shift traffic to a backend revision

Environment:
  TABLETOP_GCS_BUCKET           GCS bucket name
  TABLETOP_DEPLOY_ENABLE=1      Allow deploy commands to run
  TABLETOP_BACKEND_SERVICE      Cloud Run service name
  TABLETOP_BACKEND_REGION       Cloud Run region
  GCLOUD_PROJECT                GCP project
  TABLETOP_BACKEND_MANIFEST_URL Backend /manifest URL
`

const runAndReport = async (spec: { label: string; logPath: string }, action: () => Promise<void>) => {
    console.log(`${spec.label}: running (log: ${spec.logPath})`)
    await action()
    console.log(`${spec.label}: complete`) 
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
        const manifest = await readManifest(manifestPath)
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
        const manifest = await readManifest(manifestPath)
        const spec = deployGameUiCommand(repoRoot, manifest, gameId, deployConfig)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'build-frontend') {
        const spec = buildFrontendCommand(repoRoot)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'deploy-frontend') {
        const manifest = await readManifest(manifestPath)
        const spec = deployFrontendCommand(repoRoot, manifest, deployConfig)
        await runAndReport(spec, () => runCommand(spec))
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
