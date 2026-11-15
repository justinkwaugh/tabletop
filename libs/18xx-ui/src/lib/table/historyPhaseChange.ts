import { isAdvancePhase } from '@tabletop/18xx'
import { assertExists, type GameAction } from '@tabletop/common'

export type PhaseChangePalette = {
    phaseColors: Readonly<Record<string, string>>
    phaseTileColors: Readonly<Record<string, readonly string[]>>
    tileColors: Readonly<Record<string, string>>
    tileColorNames: Readonly<Record<string, string>>
}

export function historyPhaseChange(
    action: GameAction,
    { phaseColors, phaseTileColors, tileColors, tileColorNames }: PhaseChangePalette
): { color: string; label?: string } | undefined {
    if (!isAdvancePhase(action)) return undefined
    assertExists(action.metadata, 'Recorded phase change requires its event')
    const { fromPhaseId, toPhaseId } = action.metadata.event
    const previous = phaseColors[fromPhaseId]
    const next = phaseColors[toPhaseId]
    const previousTiles = phaseTileColors[fromPhaseId]
    const nextTiles = phaseTileColors[toPhaseId]
    assertExists(previousTiles, `Unknown tile phase: ${fromPhaseId}`)
    assertExists(nextTiles, `Unknown tile phase: ${toPhaseId}`)
    const unlocked = nextTiles.filter((color) => !previousTiles.includes(color))
    if (previous === next && !unlocked.length) return undefined
    const unlockedColor = unlocked.at(-1)
    const color = unlockedColor ? tileColors[unlockedColor] : next
    assertExists(color, `Unknown history phase color: ${toPhaseId}`)
    return {
        color,
        label: unlocked.length
            ? `${unlocked.map((color) => tileColorNames[color] ?? color).join(' and ')} tiles now available`
            : undefined
    }
}
