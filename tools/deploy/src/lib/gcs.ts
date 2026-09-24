import { spawn } from 'node:child_process'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'

export const gcsPathExists = (target: string): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn('gcloud', ['storage', 'ls', target], {
            env: withCloudSdkPythonEnv(process.env),
            stdio: ['ignore', 'pipe', 'pipe']
        })
        let hasOutput = false

        child.stdout.on('data', (chunk) => {
            if (chunk.toString().trim()) {
                hasOutput = true
            }
        })

        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0 && hasOutput))
    })

export const artifactImageExists = (image: string, project: string): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn(
            'gcloud',
            ['artifacts', 'docker', 'images', 'describe', image, '--project', project, '--quiet'],
            { env: withCloudSdkPythonEnv(process.env), stdio: ['ignore', 'ignore', 'ignore'] }
        )
        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0))
    })

export const cloudRunRevisionExists = (
    revision: string,
    project: string,
    region: string
): Promise<boolean> =>
    new Promise((resolve) => {
        const child = spawn(
            'gcloud',
            [
                'run',
                'revisions',
                'describe',
                revision,
                '--project',
                project,
                '--region',
                region,
                '--quiet'
            ],
            { env: withCloudSdkPythonEnv(process.env), stdio: ['ignore', 'ignore', 'ignore'] }
        )
        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0))
    })
