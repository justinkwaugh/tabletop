import { commanderDefinition } from '@tabletop/napoleons-triumph'
import type { AdvanceStage } from '$lib/model/battleStage.js'

export function advancePrompt(stage: AdvanceStage): string {
    const lone = stage.pickableIds.length === 0
    const joining = stage.commanders.filter((entry) => entry.goes)
    const names = joining.map((entry) => commanderDefinition(entry.commanderId).name)
    const remaining = joining.reduce((sum, entry) => sum + entry.unitsStaying, 0)
    const opening = lone ? 'The defending unit steps up' : 'At least one defending unit steps up'
    const joined = names.length > 0 ? `, joined by ${names.join(' and ')}` : ''
    const parts = [`${opening} to block the approach${joined}.`]
    if (remaining > 0) {
        parts.push(
            remaining === 1
                ? 'The remaining unit detaches and remains in reserve.'
                : 'The remaining units detach and remain in reserve.'
        )
    }
    if (stage.commanders.some((entry) => !entry.goes)) {
        parts.push(
            lone
                ? 'Going alone, it is detached from its corps.'
                : 'Units going without their commander are detached from their corps.'
        )
    }
    for (const entry of stage.commanders.filter((entry) => !entry.named && !entry.goes)) {
        parts.push(`${notNamedToDefend(entry.commanderId)}.`)
    }
    return parts.join(' ')
}

export function notNamedToDefend(commanderId: string): string {
    return `${commanderDefinition(commanderId).name} was not named to defend, so he stays in reserve`
}
