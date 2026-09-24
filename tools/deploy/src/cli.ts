#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { readCatalogue } from './lib/manifest.js'
import { fetchBucketManifest } from './lib/remoteManifest.js'
import { mergeEnvConfig, readDeployConfig } from './lib/config.js'
import { applyCloudSdkCredentialFile } from './lib/cloudSdkPython.js'
import {
    buildBackendCommand,
    buildFrontendCommand,
    buildGameLogicCommand,
    buildGameUiCommand,
    rollbackBackendCommand,
    runCommand
} from './lib/commands.js'
import {
    deployBackend,
    promoteBackend,
    releaseBackend,
    type BackendService
} from './lib/backendPublish.js'
import { deployFrontend, releaseFrontend } from './lib/frontendPublish.js'
import { deployGame, deployGameArtifacts, releaseGame } from './lib/gamePublish.js'
import { listHistory, rollback, switchFrontend, switchGame } from './lib/publicationHistory.js'
import { type PublishContext } from './lib/publishCore.js'
import { getCataloguePath, getDeployConfigPath, getRepoRoot } from './lib/paths.js'
import {
    formatPreflightReport,
    runBackendPreflight,
    runFrontendPreflight,
    runGamePreflight
} from './lib/releasePreflight.js'
import { type BumpType } from './lib/versions.js'

const repoRoot = getRepoRoot()
const cataloguePath = getCataloguePath(repoRoot)
const deployConfigPath = getDeployConfigPath(repoRoot)

const usage = `tabletop-deploy <command>

Commands:
  status                       Print the manifest the bucket currently serves
  list (--game=<id> | --frontend)
                               Print the publication history, newest first, marking the current
  rollback (--game=<id> | --frontend)
                               Select the publication that served before the current one.
                               Only rewrites the manifest; the artifacts must still exist.
  switch --game=<id> --ui-version=<v> [--logic-version=<v>]
  switch --frontend --version=<v>
                               Select specific published versions. Logic needs its UI too.
  preflight (--game=<id> | --frontend | --backend) [--json]
                               Report the serving and local versions, the last release
                               baseline per artifact, and which files and commits changed
                               since it, ending with whether a release is needed. Read-only.
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
  release-frontend (--major | --minor | --patch) [--no-deploy]
                               Bump the frontend package version, sync the manifest, commit,
                               tag frontend-v<version>, push, then deploy (unless --no-deploy).
  build-frontend               Build the frontend
  deploy-frontend              Build and deploy the frontend at HEAD, publish the manifest, and
                               invalidate the backend cache. Same guards as deploy-game.
  release-backend (--major | --minor | --patch) [--no-deploy] [--no-traffic] [--service=backend|tasks]
                               Bump the backend package version, commit, tag backend-v<version>,
                               push, then deploy (unless --no-deploy).
  build-backend                Build the backend
  deploy-backend [--no-traffic] [--service=backend|tasks]
                               Build the backend, build its image with Cloud Build tagged with
                               the release version, and deploy it to the backend and tasks
                               services with traffic. Same guards as deploy-game.
  promote-backend [--service=backend|tasks]
                               Shift traffic to the latest revision of the backend and tasks
                               services (after a --no-traffic deploy)
  rollback-backend <revision>  Shift traffic to a backend revision

Release tags:
  <packageId>-v<version>       Logic artifact
  <packageId>-ui-v<version>    UI artifact
  frontend-v<version>          Site frontend
  backend-v<version>           Backend image (also the image tag)

Environment:
  TABLETOP_GCS_BUCKET           GCS bucket name
  TABLETOP_GCLOUD_CREDENTIAL_FILE Service account key used for all gcloud calls
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

type SemverFlags = { major?: boolean; minor?: boolean; patch?: boolean }

const requestedBumps = (values: SemverFlags): BumpType[] => {
    const requested: BumpType[] = []
    if (values.major) requested.push('major')
    if (values.minor) requested.push('minor')
    if (values.patch) requested.push('patch')
    return requested
}

const resolveBumpType = (command: string, values: SemverFlags): BumpType => {
    const requested = requestedBumps(values)
    if (requested.length !== 1) {
        throw new Error(`${command} requires exactly one of --major, --minor, or --patch`)
    }
    return requested[0]
}

const rejectBumpFlags = (command: string, values: SemverFlags, releaseCommand: string) => {
    if (requestedBumps(values).length > 0) {
        throw new Error(
            `${command} does not bump versions; use ${releaseCommand} with --major, --minor, or --patch`
        )
    }
}

const resolveBackendServices = (service: string | undefined): BackendService[] => {
    if (service === undefined) return ['backend', 'tasks']
    if (service === 'backend' || service === 'tasks') return [service]
    throw new Error('--service must be backend or tasks')
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
            'no-traffic': { type: 'boolean' },
            service: { type: 'string' },
            game: { type: 'string' },
            frontend: { type: 'boolean' },
            backend: { type: 'boolean' },
            logic: { type: 'boolean' },
            major: { type: 'boolean' },
            minor: { type: 'boolean' },
            patch: { type: 'boolean' },
            'no-deploy': { type: 'boolean' },
            version: { type: 'string' },
            'logic-version': { type: 'string' },
            'ui-version': { type: 'string' },
            json: { type: 'boolean' }
        }
    })

    if (values.help) {
        console.log(usage)
        return
    }

    const command = positionals[0] ?? (values.game !== undefined ? 'deploy-game' : 'status')
    const deployConfig = mergeEnvConfig(await readDeployConfig(deployConfigPath))
    applyCloudSdkCredentialFile(repoRoot, deployConfig.gcloudCredentialFile)

    if (command === 'status') {
        console.log(JSON.stringify(await fetchBucketManifest(deployConfig), null, 2))
        return
    }

    const context: PublishContext = {
        repoRoot,
        catalogue: await readCatalogue(cataloguePath),
        deployConfig,
        log: (message) => console.log(message)
    }
    const includeLogic = values.logic === true

    const deployByDefault = values['no-deploy'] !== true
    const historyTarget = () => {
        if (values.frontend === true && values.game === undefined)
            return { frontend: true as const }
        if (values.frontend !== true && values.game !== undefined) return { game: values.game }
        throw new Error(`${command} takes exactly one of --game=<id> or --frontend`)
    }

    if (command === 'list') {
        await listHistory(context, historyTarget())
        return
    }

    if (command === 'rollback') {
        await rollback(context, historyTarget())
        return
    }

    if (command === 'switch') {
        const target = historyTarget()
        if ('frontend' in target) {
            if (!values.version) throw new Error('switch --frontend requires --version=<v>')
            await switchFrontend(context, values.version)
        } else {
            await switchGame(context, target.game, {
                logicVersion: values['logic-version'],
                uiVersion: values['ui-version']
            })
        }
        return
    }

    if (command === 'preflight') {
        const targets = [
            values.game !== undefined,
            values.frontend === true,
            values.backend === true
        ].filter(Boolean).length
        if (targets !== 1) {
            throw new Error('preflight takes exactly one of --game=<id>, --frontend, or --backend')
        }
        const report =
            values.frontend === true
                ? await runFrontendPreflight(context)
                : values.backend === true
                  ? await runBackendPreflight(context)
                  : await runGamePreflight(context, requireGame(command, values.game))
        console.log(values.json ? JSON.stringify(report, null, 2) : formatPreflightReport(report))
        return
    }

    if (command === 'release-game') {
        await releaseGame(context, {
            game: requireGame(command, values.game),
            includeLogic,
            bump: resolveBumpType(command, values),
            deploy: deployByDefault
        })
        return
    }

    if (command === 'deploy-game') {
        rejectBumpFlags(command, values, 'release-game')
        await deployGame(context, { game: requireGame(command, values.game), includeLogic })
        return
    }

    if (command === 'release-frontend') {
        await releaseFrontend(context, {
            bump: resolveBumpType(command, values),
            deploy: deployByDefault
        })
        return
    }

    if (command === 'deploy-frontend') {
        rejectBumpFlags(command, values, 'release-frontend')
        await deployFrontend(context)
        return
    }

    const backendOptions = {
        services: resolveBackendServices(values.service),
        serveTraffic: values['no-traffic'] !== true
    }

    if (command === 'release-backend') {
        await releaseBackend(context, {
            ...backendOptions,
            bump: resolveBumpType(command, values),
            deploy: deployByDefault
        })
        return
    }

    if (command === 'deploy-backend') {
        rejectBumpFlags(command, values, 'release-backend')
        await deployBackend(context, backendOptions)
        return
    }

    if (command === 'promote-backend') {
        await promoteBackend(context, backendOptions.services)
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
        await deployGameArtifacts(context, gameId, ['ui'])
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
        await deployGameArtifacts(context, gameId, ['logic'])
        return
    }

    if (command === 'build-frontend') {
        const spec = buildFrontendCommand(repoRoot)
        await runAndReport(spec, () => runCommand(spec))
        return
    }

    if (command === 'build-backend') {
        const spec = buildBackendCommand(repoRoot)
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
