import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'
import { routeTrafficToRevisionCommand } from './commands.js'
import { runSpec, type PublishContext } from './publishCore.js'
import { isObject } from './json.js'

const execFileAsync = promisify(execFile)

export interface BackendRevision {
    name: string
    created: string
    ready: boolean
}
export interface BackendServiceHistory {
    service: string
    traffic: Array<{ revision: string; percent: number }>
    revisions: BackendRevision[]
}

const readJson = async (context: PublishContext, args: string[]): Promise<unknown> => {
    const backend = context.deployConfig.backend
    if (!backend?.project || !backend.region) throw new Error('Backend project and region required')
    const { stdout } = await execFileAsync(
        'gcloud',
        ['run', ...args, '--project', backend.project, '--region', backend.region, '--quiet'],
        {
            cwd: context.repoRoot,
            env: withCloudSdkPythonEnv(process.env),
            maxBuffer: 8 * 1024 * 1024
        }
    )
    return JSON.parse(stdout)
}

export const readBackendHistory = async (
    context: PublishContext,
    service: string
): Promise<BackendServiceHistory> => {
    const description = await readJson(context, [
        'services',
        'describe',
        service,
        '--format=json(status.traffic)'
    ])
    if (
        !isObject(description) ||
        !isObject(description.status) ||
        !Array.isArray(description.status.traffic)
    ) {
        throw new Error(`Missing traffic status for ${service}`)
    }
    const traffic = description.status.traffic.flatMap((entry: unknown) => {
        if (!isObject(entry) || typeof entry.percent !== 'number' || entry.percent <= 0) return []
        if (typeof entry.revisionName !== 'string')
            throw new Error(`Unresolved serving revision for ${service}`)
        return [{ revision: entry.revisionName, percent: entry.percent }]
    })
    const revisions = await readJson(context, [
        'revisions',
        'list',
        '--service',
        service,
        '--format=json(metadata.name,metadata.creationTimestamp,status.conditions)'
    ])
    if (!Array.isArray(revisions)) throw new Error(`Missing revisions for ${service}`)
    return {
        service,
        traffic,
        revisions: revisions
            .map((entry: unknown) => {
                if (
                    !isObject(entry) ||
                    !isObject(entry.metadata) ||
                    typeof entry.metadata.name !== 'string' ||
                    typeof entry.metadata.creationTimestamp !== 'string' ||
                    !isObject(entry.status) ||
                    !Array.isArray(entry.status.conditions)
                ) {
                    throw new Error(`Invalid revision data for ${service}`)
                }
                return {
                    name: entry.metadata.name,
                    created: entry.metadata.creationTimestamp,
                    ready: entry.status.conditions.some(
                        (condition: unknown) =>
                            isObject(condition) &&
                            condition.type === 'Ready' &&
                            condition.status === 'True'
                    )
                }
            })
            .sort((a, b) => b.created.localeCompare(a.created))
    }
}

const servesOnly = (history: BackendServiceHistory, revision: string) =>
    history.traffic.length === 1 &&
    history.traffic[0].revision === revision &&
    history.traffic[0].percent === 100

// Traffic is checked on the service itself: tagged URLs such as latest--- reach the newest
// revision whatever the traffic split, so they cannot confirm what users are served.
export const assertServesOnly = async (
    context: PublishContext,
    service: string,
    revision: string
) => {
    const history = await readBackendHistory(context, service)
    if (!servesOnly(history, revision)) {
        const serving = history.traffic
            .map((entry) => `${entry.revision} (${entry.percent}%)`)
            .join(', ')
        throw new Error(
            `${service}: expected ${revision} at 100% traffic, found ${serving || 'none'}`
        )
    }
}

export const routeTrafficAndVerify = async (
    context: PublishContext,
    service: string,
    revision: string
) => {
    await runSpec(
        context,
        routeTrafficToRevisionCommand(context.repoRoot, service, revision, context.deployConfig)
    )
    await assertServesOnly(context, service, revision)
}
