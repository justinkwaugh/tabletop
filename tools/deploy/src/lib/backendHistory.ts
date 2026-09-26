import { resolveBackendTarget, type BackendService } from './backendPublish.js'
import {
    readBackendHistory,
    routeTrafficAndVerify,
    type BackendRevision,
    type BackendServiceHistory
} from './backendTraffic.js'
import { revisionSuffixForVersion } from './commands.js'
import type { PublishContext } from './publishCore.js'

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
        await routeTrafficAndVerify(context, plan.service, plan.revision)
        context.log(`${plan.service} serving now: ${plan.revision} (100%)`)
    }
}
