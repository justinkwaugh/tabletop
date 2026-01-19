import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
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
    onSpawn?: (child: ChildProcess) => void
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
        options?.onSpawn?.(child)

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

export const buildGameUiCommand = (repoRoot: string, packageId: string): CommandSpec => ({
    label: `bundle-ui:${packageId}`,
    command: 'npm',
    args: ['run', 'bundle', '--workspace', `@tabletop/${packageId}-ui`],
    cwd: repoRoot,
    logPath: `/tmp/${packageId}-ui-bundle.log`
})

export const buildGameUiPackageCommand = (repoRoot: string, packageId: string): CommandSpec => ({
    label: `build-ui:${packageId}`,
    command: 'turbo',
    args: ['build', `--filter=@tabletop/${packageId}-ui`],
    cwd: repoRoot,
    logPath: `/tmp/${packageId}-ui-build.log`
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
    packageId: string,
    config: DeployConfig
): CommandSpec => {
    if (!config.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const entry = manifest.games.find((game) => game.packageId === packageId)
    if (!entry) {
        throw new Error(`Missing manifest entry for ${packageId}`)
    }
    const sourceDir = path.join(repoRoot, 'games', `${packageId}-ui`, 'bundle')
    const destination = `gs://${config.gcsBucket}/games/${packageId}/ui/${entry.uiVersion}`

    return {
        label: `deploy-ui:${packageId}`,
        command: 'gcloud',
        args: ['storage', 'rsync', '--recursive', sourceDir, destination],
        cwd: repoRoot,
        logPath: `/tmp/${packageId}-ui-deploy.log`,
        requiresDeploy: true
    }
}

export const buildGameLogicPackageCommand = (
    repoRoot: string,
    packageId: string
): CommandSpec => ({
    label: `build-logic:${packageId}`,
    command: 'turbo',
    args: ['build', `--filter=@tabletop/${packageId}`],
    cwd: repoRoot,
    logPath: `/tmp/${packageId}-logic-build.log`
})

export const buildGameLogicCommand = (repoRoot: string, packageId: string): CommandSpec => ({
    label: `bundle-logic:${packageId}`,
    command: 'npm',
    args: ['run', 'bundle', '--workspace', `@tabletop/${packageId}`],
    cwd: repoRoot,
    logPath: `/tmp/${packageId}-logic-bundle.log`
})

export const deployGameLogicCommand = (
    repoRoot: string,
    manifest: SiteManifest,
    packageId: string,
    config: DeployConfig
): CommandSpec => {
    if (!config.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const entry = manifest.games.find((game) => game.packageId === packageId)
    if (!entry) {
        throw new Error(`Missing manifest entry for ${packageId}`)
    }
    const sourceDir = path.join(repoRoot, 'games', packageId, 'bundle')
    const destination = `gs://${config.gcsBucket}/games/${packageId}/logic/${entry.logicVersion}`

    return {
        label: `deploy-logic:${packageId}`,
        command: 'gcloud',
        args: ['storage', 'rsync', '--recursive', sourceDir, destination],
        cwd: repoRoot,
        logPath: `/tmp/${packageId}-logic-deploy.log`,
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

export const deployManifestCommand = (
    manifestPath: string,
    config: DeployConfig
): CommandSpec => {
    if (!config.gcsBucket) {
        throw new Error('Missing gcsBucket (set TABLETOP_GCS_BUCKET or deploy config)')
    }
    const destination = `gs://${config.gcsBucket}/config/site-manifest.json`

    return {
        label: 'deploy-manifest',
        command: 'gcloud',
        args: ['storage', 'cp', manifestPath, destination],
        cwd: path.dirname(manifestPath),
        logPath: '/tmp/manifest-deploy.log',
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
