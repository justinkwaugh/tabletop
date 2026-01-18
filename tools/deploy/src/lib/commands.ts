import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { DeployConfig, SiteManifest } from './types.js'

export type CommandSpec = {
    label: string
    command: string
    args: string[]
    cwd: string
    logPath: string
    requiresDeploy?: boolean
}

type RunCommandOptions = {
    onOutput?: (chunk: string) => void
}

const ensureDir = (dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true })
}

export const runCommand = (spec: CommandSpec, options?: RunCommandOptions): Promise<void> => {
    ensureDir(path.dirname(spec.logPath))
    const logStream = fs.createWriteStream(spec.logPath, { flags: 'w' })

    return new Promise((resolve, reject) => {
        const child = spawn(spec.command, spec.args, {
            cwd: spec.cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        })

        child.stdout.on('data', (chunk) => {
            logStream.write(chunk)
            options?.onOutput?.(chunk.toString())
        })
        child.stderr.on('data', (chunk) => {
            logStream.write(chunk)
            options?.onOutput?.(chunk.toString())
        })

        child.on('error', (error) => {
            logStream.end()
            reject(error)
        })

        child.on('close', (code) => {
            logStream.end()
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`${spec.label} exited with code ${code}`))
            }
        })
    })
}

export const buildGameUiCommand = (repoRoot: string, gameId: string): CommandSpec => ({
    label: `bundle-ui:${gameId}`,
    command: 'npm',
    args: ['run', 'bundle', '--workspace', `@tabletop/${gameId}-ui`],
    cwd: repoRoot,
    logPath: `/tmp/${gameId}-ui-bundle.log`
})

export const buildGameUiPackageCommand = (repoRoot: string, gameId: string): CommandSpec => ({
    label: `build-ui:${gameId}`,
    command: 'npm',
    args: ['run', 'build', '--workspace', `@tabletop/${gameId}-ui`],
    cwd: repoRoot,
    logPath: `/tmp/${gameId}-ui-build.log`
})

export const buildFrontendCommand = (repoRoot: string): CommandSpec => ({
    label: 'build-frontend',
    command: 'turbo',
    args: ['build', '--filter=@tabletop/frontend'],
    cwd: repoRoot,
    logPath: '/tmp/frontend-build.log'
})

export const buildBackendCommand = (
    repoRoot: string,
    options?: { force?: boolean }
): CommandSpec => ({
    label: 'build-backend',
    command: 'turbo',
    args: ['build', '--filter=@tabletop/backend', ...(options?.force ? ['--force'] : [])],
    cwd: repoRoot,
    logPath: options?.force ? '/tmp/backend-build-force.log' : '/tmp/backend-build.log'
})

export const buildBackendImageCommand = (repoRoot: string): CommandSpec => ({
    label: 'build-backend-image',
    command: 'npm',
    args: ['run', 'docker-build', '--workspace', '@tabletop/backend'],
    cwd: repoRoot,
    logPath: '/tmp/backend-image-build.log'
})

export const tagBackendImageCommand = (repoRoot: string, image: string): CommandSpec => ({
    label: 'tag-backend-image',
    command: 'docker',
    args: ['tag', 'backend', image],
    cwd: repoRoot,
    logPath: '/tmp/backend-image-tag.log'
})

export const pushBackendImageCommand = (repoRoot: string, image: string): CommandSpec => ({
    label: 'push-backend-image',
    command: 'docker',
    args: ['push', image],
    cwd: repoRoot,
    logPath: '/tmp/backend-image-push.log'
})

export const deployGameUiCommand = (
    repoRoot: string,
    manifest: SiteManifest,
    gameId: string,
    config: DeployConfig
): CommandSpec => {
    if (!config.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const sourceDir = path.join(repoRoot, 'games', `${gameId}-ui`, 'public')
    const destination = `gs://${config.gcsBucket}/games/${gameId}/${manifest.games[gameId].uiVersion}`

    return {
        label: `deploy-ui:${gameId}`,
        command: 'gcloud',
        args: ['storage', 'rsync', '--recursive', sourceDir, destination],
        cwd: repoRoot,
        logPath: `/tmp/${gameId}-ui-deploy.log`,
        requiresDeploy: true
    }
}

export const deployFrontendCommand = (
    repoRoot: string,
    manifest: SiteManifest,
    config: DeployConfig
): CommandSpec => {
    if (!config.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const sourceDir = path.join(repoRoot, 'apps', 'frontend', 'build')
    const destination = `gs://${config.gcsBucket}/frontend/${manifest.frontend.version}`

    return {
        label: 'deploy-frontend',
        command: 'gcloud',
        args: ['storage', 'rsync', '--recursive', sourceDir, destination],
        cwd: repoRoot,
        logPath: '/tmp/frontend-deploy.log',
        requiresDeploy: true
    }
}

export const deployBackendCommand = (
    repoRoot: string,
    config: DeployConfig,
    options?: { allowTraffic?: boolean }
): CommandSpec => {
    const allowTraffic = options?.allowTraffic === true
    const backend = config.backend
    if (backend?.deployCommand?.length) {
        const command = backend.deployCommand[0]
        const args = backend.deployCommand.slice(1)

        if (
            !allowTraffic &&
            command === 'gcloud' &&
            args[0] === 'run' &&
            args[1] === 'deploy' &&
            !args.includes('--no-traffic')
        ) {
            args.push('--no-traffic')
        }

        return {
            label: 'deploy-backend',
            command,
            args,
            cwd: repoRoot,
            logPath: '/tmp/backend-deploy.log',
            requiresDeploy: true
        }
    }

    if (!backend?.service || !backend.region || !backend.project) {
        throw new Error(
            'Missing backend deploy config (service/region/project or backend.deployCommand)'
        )
    }

    if (backend.image) {
        const args = [
            'run',
            'deploy',
            backend.service,
            '--image',
            backend.image,
            '--region',
            backend.region,
            '--project',
            backend.project
        ]

        if (!allowTraffic) {
            args.push('--no-traffic')
        }

        return {
            label: 'deploy-backend',
            command: 'gcloud',
            args,
            cwd: repoRoot,
            logPath: '/tmp/backend-deploy.log',
            requiresDeploy: true
        }
    }

    const args = [
        'run',
        'deploy',
        backend.service,
        '--source',
        '.',
        '--region',
        backend.region,
        '--project',
        backend.project
    ]

    if (!allowTraffic) {
        args.push('--no-traffic')
    }

    return {
        label: 'deploy-backend',
        command: 'gcloud',
        args,
        cwd: repoRoot,
        logPath: '/tmp/backend-deploy.log',
        requiresDeploy: true
    }
}

export const rollbackBackendCommand = (
    repoRoot: string,
    revision: string,
    config: DeployConfig
): CommandSpec => {
    const backend = config.backend
    if (!backend?.service || !backend.region || !backend.project) {
        throw new Error('Missing backend config for rollback (service/region/project)')
    }

    return {
        label: 'rollback-backend',
        command: 'gcloud',
        args: [
            'run',
            'services',
            'update-traffic',
            backend.service,
            '--region',
            backend.region,
            '--project',
            backend.project,
            '--to-revisions',
            `${revision}=100`
        ],
        cwd: repoRoot,
        logPath: '/tmp/backend-rollback.log',
        requiresDeploy: true
    }
}
