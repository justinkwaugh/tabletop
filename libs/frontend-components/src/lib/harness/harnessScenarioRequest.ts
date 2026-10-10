// A request, described in words, for a scenario someone will record later; it is fulfilled when a
// recording with the same id appears. .agents/skills/harness-scenarios/SKILL.md fulfils one.
export type HarnessScenarioRequest = {
    format: 1
    id: string
    label: string
    description: string
    title: string
    requestedAt: string
}

export function isScenarioRequest(value: unknown): value is HarnessScenarioRequest {
    return (
        typeof value === 'object' &&
        value !== null &&
        'format' in value &&
        value.format === 1 &&
        'id' in value &&
        typeof value.id === 'string' &&
        'label' in value &&
        typeof value.label === 'string' &&
        'description' in value &&
        typeof value.description === 'string' &&
        'title' in value &&
        typeof value.title === 'string' &&
        'requestedAt' in value &&
        typeof value.requestedAt === 'string'
    )
}

export function pendingScenarioRequests(
    files: Record<string, unknown>,
    recordedIds: ReadonlySet<string>
): HarnessScenarioRequest[] {
    return Object.values(files)
        .filter(isScenarioRequest)
        .filter((request) => !recordedIds.has(request.id))
}
