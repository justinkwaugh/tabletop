import type { TaskService } from '../tasks/taskService.js'

export type MaintenanceRun = { runId: string; write: boolean; counts: Record<string, number> }

export function countOutcome(counts: Record<string, number>, outcome: string): void {
    counts[outcome] = (counts[outcome] ?? 0) + 1
}

export async function enqueueMaintenancePage(
    tasks: Pick<TaskService, 'createPushTask'>,
    path: string,
    payload: MaintenanceRun
): Promise<void> {
    await tasks.createPushTask({ queue: 'maintenance', path, payload })
}

export function reportMaintenance<Event extends string>(
    name: string,
    run: MaintenanceRun,
    event: Event,
    detail: object
): void {
    console.log(
        `${name} ${JSON.stringify({ runId: run.runId, write: run.write, event, ...detail })}`
    )
}
