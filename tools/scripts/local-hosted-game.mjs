#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '../..')
const localBinDirectory = path.join(repoRoot, 'node_modules', '.bin')
const commandEnvironment = {
    ...process.env,
    PATH: [localBinDirectory, process.env.PATH].filter(Boolean).join(path.delimiter)
}

const usage = `Usage:
  tools/scripts/local-hosted-game.mjs <game>
  tools/scripts/local-hosted-game.mjs --game <game> [--prepare-only]

Builds the selected game's logic and UI, stages the UI at the version selected by
the local site manifest, checks local infrastructure, and starts the Site Frontend
and backend.

Options:
  --game <game>    Game package ID or game ID (for example, fresh-fish)
  --prepare-only   Build and stage the game without checking or starting services
  --help           Show this help
`

const parseArguments = (arguments_) => {
    let gameName
    let prepareOnly = false

    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index]

        if (argument === '--help' || argument === '-h') {
            return { help: true, prepareOnly }
        }

        if (argument === '--prepare-only') {
            prepareOnly = true
            continue
        }

        if (argument === '--game') {
            gameName = arguments_[index + 1]
            if (!gameName) {
                throw new Error('--game requires a value')
            }
            index += 1
            continue
        }

        if (argument.startsWith('--game=')) {
            gameName = argument.slice('--game='.length)
            continue
        }

        if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`)
        }

        if (gameName) {
            throw new Error(`Unexpected argument: ${argument}`)
        }
        gameName = argument
    }

    if (!gameName) {
        throw new Error('Choose a game with --game <game> or a positional argument')
    }

    return { gameName, help: false, prepareOnly }
}

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'))

const normalizeGameName = (gameName) =>
    gameName
        .replace(/^@tabletop\//, '')
        .replace(/-ui$/, '')
        .toLowerCase()

const resolveGame = (manifest, requestedName) => {
    const normalizedName = normalizeGameName(requestedName)
    const game = manifest.games.find(
        (candidate) =>
            candidate.packageId.toLowerCase() === normalizedName ||
            candidate.gameId.toLowerCase() === normalizedName
    )

    if (!game) {
        const choices = manifest.games
            .map((candidate) => candidate.packageId)
            .sort()
            .join(', ')
        throw new Error(`Unknown game "${requestedName}". Available package IDs: ${choices}`)
    }

    return game
}

const verifyPackage = (packageJson, expectations, filePath) => {
    if (packageJson.name !== expectations.name) {
        throw new Error(
            `${filePath} declares ${packageJson.name ?? 'no package name'}; expected ${expectations.name}`
        )
    }

    if (packageJson.version !== expectations.version) {
        throw new Error(
            `${packageJson.name} is version ${packageJson.version}, but the local site manifest selects ` +
                `${expectations.version}. Align the package and manifest before running the hosted site.`
        )
    }
}

const parseEnvironmentFile = async (filePath) => {
    let contents
    try {
        contents = await fs.readFile(filePath, 'utf8')
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}
        }
        throw error
    }

    const values = {}
    for (const line of contents.split(/\r?\n/)) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue
        }

        const separator = trimmedLine.indexOf('=')
        if (separator === -1) {
            continue
        }

        const name = trimmedLine
            .slice(0, separator)
            .trim()
            .replace(/^export\s+/, '')
        let value = trimmedLine.slice(separator + 1).trim()
        const quote = value[0]
        if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
            value = value.slice(1, -1)
        }
        values[name] = value
    }

    return values
}

const parseHostAndPort = (address, fallbackPort) => {
    const bracketedAddress = address.match(/^\[([^\]]+)](?::(\d+))?$/)
    if (bracketedAddress) {
        return {
            host: bracketedAddress[1],
            port: Number(bracketedAddress[2] ?? fallbackPort)
        }
    }

    const separator = address.lastIndexOf(':')
    if (separator > -1 && address.indexOf(':') === separator) {
        const possiblePort = Number(address.slice(separator + 1))
        if (Number.isInteger(possiblePort)) {
            return { host: address.slice(0, separator), port: possiblePort }
        }
    }

    return { host: address, port: fallbackPort }
}

const canConnect = (service, timeoutMilliseconds = 1_000) =>
    new Promise((resolve) => {
        const socket = net.createConnection({ host: service.host, port: service.port })
        let settled = false

        const finish = (connected) => {
            if (settled) {
                return
            }
            settled = true
            socket.destroy()
            resolve(connected)
        }

        socket.setTimeout(timeoutMilliseconds)
        socket.once('connect', () => finish(true))
        socket.once('timeout', () => finish(false))
        socket.once('error', () => finish(false))
    })

const unavailableServices = async (services) => {
    const results = await Promise.all(
        services.map(async (service) => ({ service, available: await canConnect(service) }))
    )
    return results.filter((result) => !result.available).map((result) => result.service)
}

const delay = (milliseconds) =>
    new Promise((resolve) => {
        setTimeout(resolve, milliseconds)
    })

const waitForInfrastructure = async (services, timeoutMilliseconds) => {
    const deadline = Date.now() + timeoutMilliseconds
    let unavailable = await unavailableServices(services)

    while (unavailable.length > 0 && Date.now() < deadline) {
        await delay(500)
        unavailable = await unavailableServices(services)
    }

    return unavailable
}

const commandExists = (command, arguments_) =>
    spawnSync(command, arguments_, {
        cwd: repoRoot,
        env: commandEnvironment,
        stdio: 'ignore'
    }).status === 0

const runCommand = (command, arguments_) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, arguments_, {
            cwd: repoRoot,
            env: commandEnvironment,
            stdio: 'inherit'
        })

        child.once('error', reject)
        child.once('exit', (code, signal) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(
                new Error(
                    `${command} ${arguments_.join(' ')} exited with ${signal ?? `code ${code}`}`
                )
            )
        })
    })

const resolveComposeNetworkServices = async (services) => {
    const resolved = []

    for (const service of services) {
        if (await canConnect(service)) {
            resolved.push(service)
            continue
        }

        const composeNetworkService = { ...service, host: service.composeHost }
        if (service.composeHost && (await canConnect(composeNetworkService))) {
            resolved.push(composeNetworkService)
            continue
        }

        resolved.push(service)
    }

    return resolved
}

const ensureInfrastructure = async (configuredServices) => {
    let services = await resolveComposeNetworkServices(configuredServices)
    let unavailable = await unavailableServices(services)
    if (unavailable.length === 0) {
        console.log('Local infrastructure ready: Firestore and Redis')
        return services
    }

    if (!commandExists('docker', ['compose', 'version'])) {
        const details = unavailable
            .map((service) => `${service.name} at ${service.host}:${service.port}`)
            .join(', ')
        throw new Error(
            `Local infrastructure is unavailable (${details}), and Docker Compose cannot be run ` +
                'from this environment. Start the cache and firebase Compose services outside the ' +
                'devcontainer, then retry.'
        )
    }

    console.log('Starting local Firestore and Redis with Docker Compose...')
    await runCommand('docker', ['compose', 'up', '-d', 'cache', 'firebase'])
    services = await resolveComposeNetworkServices(configuredServices)
    unavailable = await waitForInfrastructure(services, 60_000)

    if (unavailable.length > 0) {
        const details = unavailable
            .map((service) => `${service.name} at ${service.host}:${service.port}`)
            .join(', ')
        throw new Error(`Timed out waiting for local infrastructure: ${details}`)
    }

    console.log('Local infrastructure ready: Firestore and Redis')
    return services
}

const assertApplicationsAreStopped = async (backendPort) => {
    const applications = [
        { name: 'backend', port: backendPort },
        { name: 'Site Frontend', port: 5173 }
    ]
    const running = []

    for (const application of applications) {
        const occupied = await Promise.all(
            ['127.0.0.1', '::1'].map((host) => canConnect({ ...application, host }))
        )
        if (occupied.some(Boolean)) {
            running.push(`${application.name} on port ${application.port}`)
        }
    }

    if (running.length > 0) {
        throw new Error(
            `${running.join(' and ')} already running. Stop the existing local site first, or use ` +
                '--prepare-only to rebuild and stage without starting it.'
        )
    }
}

const isHealthy = async (url) => {
    try {
        const response = await fetch(url)
        return response.ok
    } catch {
        return false
    }
}

const isApplicationHealthy = async (application) => {
    const results = await Promise.all(application.urls.map((url) => isHealthy(url)))
    return results.some(Boolean)
}

const waitForApplications = async (applications, child, timeoutMilliseconds) => {
    const deadline = Date.now() + timeoutMilliseconds

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error('The local Site Frontend/backend process exited before becoming ready')
        }

        const healthy = await Promise.all(
            applications.map(async (application) => isApplicationHealthy(application))
        )
        if (healthy.every(Boolean)) {
            return
        }
        await delay(500)
    }

    throw new Error(
        `Timed out waiting for ${applications.map((application) => application.name).join(' and ')}`
    )
}

const runApplications = async (backendPort, game, infrastructure) => {
    const firestore = infrastructure.find((service) => service.name === 'Firestore')
    const redis = infrastructure.find((service) => service.name === 'Redis')
    const applicationEnvironment = {
        ...commandEnvironment,
        FIRESTORE_EMULATOR_HOST: `${firestore.host}:${firestore.port}`,
        HOST: '0.0.0.0',
        REDIS_HOST: redis.host,
        REDIS_PORT: String(redis.port)
    }
    const child = spawn(
        'turbo',
        [
            'watch',
            'dev',
            '--filter=@tabletop/frontend',
            '--filter=@tabletop/backend',
            '--env-mode=loose',
            '--ui=stream'
        ],
        {
            cwd: repoRoot,
            env: applicationEnvironment,
            stdio: 'inherit'
        }
    )

    let stopping = false
    const stop = (signal) => {
        if (stopping) {
            return
        }
        stopping = true
        if (child.exitCode === null && child.signalCode === null) {
            child.kill(signal)
        }
    }
    const interrupt = () => stop('SIGINT')
    const terminate = () => stop('SIGTERM')
    process.on('SIGINT', interrupt)
    process.on('SIGTERM', terminate)

    const exit = new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', (code, signal) => resolve({ code, signal }))
    })

    try {
        await Promise.race([
            waitForApplications(
                [
                    {
                        name: 'backend',
                        urls: [
                            `http://127.0.0.1:${backendPort}/api/v1/manifest`,
                            `http://[::1]:${backendPort}/api/v1/manifest`
                        ]
                    },
                    {
                        name: 'Site Frontend',
                        urls: ['http://127.0.0.1:5173/', 'http://[::1]:5173/']
                    },
                    {
                        name: `${game.packageId} UI Artifact`,
                        urls: [
                            `http://127.0.0.1:5173/games/${game.packageId}/ui/${game.uiVersion}/index.js`,
                            `http://[::1]:5173/games/${game.packageId}/ui/${game.uiVersion}/index.js`
                        ]
                    }
                ],
                child,
                120_000
            ),
            exit.then(({ code, signal }) => {
                throw new Error(
                    `The local Site Frontend/backend process exited with ${signal ?? `code ${code}`}`
                )
            })
        ])

        console.log('')
        console.log(`Local hosted game ready: ${game.packageId}`)
        console.log('Site: http://localhost:5173')
        console.log(`Backend: http://localhost:${backendPort}`)
        console.log('Firestore emulator: http://localhost:4000')
        console.log('Stop all local app processes with Ctrl-C.')

        const result = await exit
        if (!stopping && result.code !== 0) {
            throw new Error(
                `The local Site Frontend/backend process exited with ` +
                    `${result.signal ?? `code ${result.code}`}`
            )
        }
    } catch (error) {
        if (!stopping) {
            throw error
        }
    } finally {
        process.off('SIGINT', interrupt)
        process.off('SIGTERM', terminate)
        if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGTERM')
        }
    }
}

const main = async () => {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) {
        console.log(usage)
        return
    }

    if (!commandExists('turbo', ['--version'])) {
        throw new Error('turbo is unavailable. Install workspace dependencies, then retry.')
    }

    const manifestPath = path.join(repoRoot, 'config/config-games/src/site-manifest.json')
    const manifest = await readJson(manifestPath)
    const game = resolveGame(manifest, options.gameName)
    const logicPackagePath = path.join(repoRoot, 'games', game.packageId, 'package.json')
    const uiPackagePath = path.join(repoRoot, 'games', `${game.packageId}-ui`, 'package.json')
    const logicPackage = await readJson(logicPackagePath)
    const uiPackage = await readJson(uiPackagePath)

    verifyPackage(
        logicPackage,
        { name: `@tabletop/${game.packageId}`, version: game.logicVersion },
        path.relative(repoRoot, logicPackagePath)
    )
    verifyPackage(
        uiPackage,
        { name: `@tabletop/${game.packageId}-ui`, version: game.uiVersion },
        path.relative(repoRoot, uiPackagePath)
    )

    const backendEnvironmentFile = await parseEnvironmentFile(
        path.join(repoRoot, 'apps/backend/.env.local')
    )
    const configuredEnvironment = { ...backendEnvironmentFile, ...process.env }
    const firestore = parseHostAndPort(
        configuredEnvironment.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080',
        8080
    )
    const redis = {
        host: configuredEnvironment.REDIS_HOST ?? 'localhost',
        port: Number(configuredEnvironment.REDIS_PORT ?? 6379)
    }
    const backendPort = Number(configuredEnvironment.PORT ?? 3000)

    let infrastructure
    if (!options.prepareOnly) {
        await assertApplicationsAreStopped(backendPort)
        infrastructure = await ensureInfrastructure([
            { name: 'Firestore', composeHost: 'firebase', ...firestore },
            { name: 'Redis', composeHost: 'cache', ...redis }
        ])
    }

    console.log(
        `Building ${logicPackage.name}@${logicPackage.version} and ` +
            `${uiPackage.name}@${uiPackage.version}...`
    )
    await runCommand('turbo', ['stage-ui', `--filter=${uiPackage.name}`, '--ui=stream'])

    const logicEntry = path.join(repoRoot, 'games', game.packageId, 'esm/index.js')
    const stagedUiEntry = path.join(
        repoRoot,
        '.local-static/games',
        game.packageId,
        'ui',
        game.uiVersion,
        'index.js'
    )
    await Promise.all([fs.access(logicEntry), fs.access(stagedUiEntry)])

    console.log(`Prepared local publication for ${game.packageId}`)
    console.log(`  logic: ${path.relative(repoRoot, logicEntry)}`)
    console.log(`  UI: ${path.relative(repoRoot, stagedUiEntry)}`)

    if (options.prepareOnly) {
        return
    }

    await runApplications(backendPort, game, infrastructure)
}

try {
    await main()
} catch (error) {
    console.error(`\nLocal hosted game failed: ${error.message}`)
    process.exitCode = 1
}
