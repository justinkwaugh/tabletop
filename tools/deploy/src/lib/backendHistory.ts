import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { withCloudSdkPythonEnv } from './cloudSdkPython.js'
import { resolveBackendTarget, type BackendService } from './backendPublish.js'
import { routeTrafficToRevisionCommand, revisionSuffixForVersion } from './commands.js'
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

export const previousBackendRevision = (history: BackendServiceHistory): BackendRevision => {
    if (history.traffic.length !== 1 || history.traffic[0].percent !== 100) {
        throw new Error(
            `${history.service} has split or missing traffic; select an explicit revision`
        )
    }
    const current = history.revisions.find(
        (revision) => revision.name === history.traffic[0].revision
    )
    if (!current) throw new Error(`Serving revision missing for ${history.service}`)
    const previous = history.revisions.find(
        (revision) => revision.ready && revision.created < current.created
    )
    if (!previous) throw new Error(`${history.service} has no earlier ready revision`)
    return previous
}

export const listBackendHistory = async (context: PublishContext, services: BackendService[]) => {
    const target = resolveBackendTarget(context.deployConfig, services)
    for (const service of target.services) {
        const history = await readBackendHistory(context, service)
        context.log(`${service} revisions, newest first (* = serving traffic):`)
        for (const revision of history.revisions) {
            const percent = history.traffic
                .filter((entry) => entry.revision === revision.name)
                .reduce((sum, entry) => sum + entry.percent, 0)
            context.log(
                `${percent ? '*' : ' '} ${revision.name}  ${percent}%  ${revision.ready ? 'ready' : 'not ready'}  ${revision.created}`
            )
        }
    }
}

export const switchBackend = async (
    context: PublishContext,
    services: BackendService[],
    selection: { version?: string; revision?: string } = {}
) => {
    const target = resolveBackendTarget(context.deployConfig, services)
    if (selection.revision && target.services.length !== 1)
        throw new Error('An explicit revision requires --service=backend|tasks')
    const plans = []
    for (const service of target.services) {
        const history = await readBackendHistory(context, service)
        const requested =
            selection.revision ??
            (selection.version
                ? `${service}-${revisionSuffixForVersion(selection.version)}`
                : undefined)
        const revision = requested
            ? history.revisions.find((entry) => entry.name === requested)
            : previousBackendRevision(history)
        if (!revision?.ready)
            throw new Error(`${service}: requested revision is missing or not ready`)
        plans.push({ service, revision: revision.name, before: history.traffic })
    }
    if (!selection.version && !selection.revision && plans.length > 1) {
        const currentReleases = new Set(
            plans.map((plan) => plan.before[0].revision.slice(plan.service.length + 1))
        )
        const targetReleases = new Set(
            plans.map((plan) => plan.revision.slice(plan.service.length + 1))
        )
        if (currentReleases.size !== 1 || targetReleases.size !== 1) {
            throw new Error(
                'Services have different release histories; choose --version or --service explicitly'
            )
        }
    }
    for (const plan of plans)
        context.log(
            `${plan.service}: ${plan.before.map((entry) => `${entry.revision} (${entry.percent}%)`).join(', ')} -> ${plan.revision} (100%)`
        )
    for (const plan of plans) {
        await runSpec(
            context,
            routeTrafficToRevisionCommand(
                context.repoRoot,
                plan.service,
                plan.revision,
                context.deployConfig
            )
        )
        const current = await readBackendHistory(context, plan.service)
        if (
            current.traffic.length !== 1 ||
            current.traffic[0].revision !== plan.revision ||
            current.traffic[0].percent !== 100
        ) {
            throw new Error(
                `${plan.service}: traffic verification failed; earlier services may already have switched`
            )
        }
        context.log(`${plan.service} serving now: ${plan.revision} (100%)`)
    }
}
