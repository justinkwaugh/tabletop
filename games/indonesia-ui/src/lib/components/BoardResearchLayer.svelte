<script lang="ts">
    import CubeMarker from '$lib/components/CubeMarker.svelte'
    import {
        RESEARCH_ROWS,
        RESEARCH_TRACK_CELLS,
        type ResearchRow
    } from '$lib/definitions/researchTrackPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import {
        researchCubeHorizontalJitter,
        researchCubeOffsets,
        researchCubeRotationDegrees
    } from '$lib/utils/researchCubeLayout.js'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { ActionType, MachineState, ResearchArea } from '@tabletop/indonesia'

    let {
        selectedPlayerId = null,
        currentPlayerId = null
    }: {
        selectedPlayerId?: string | null
        currentPlayerId?: string | null
    } = $props()

    type ResearchCubeEntry = {
        key: string
        x: number
        y: number
        color: string
        rotationDegrees: number
    }

    type ResearchNextCellHighlight = {
        key: string
        row: ResearchRow
        left: number
        top: number
        width: number
        height: number
    }

    const gameSession = getGameSession()

    const RESEARCH_COLUMN_COUNT = 5
    const RESEARCH_CUBE_SIZE = 18
    const RESEARCH_CUBE_GAP = 0.5
    const RESEARCH_CUBE_SPACING = RESEARCH_CUBE_SIZE + RESEARCH_CUBE_GAP
    const SHOW_RESEARCH_SLOT_OUTLINES = true
    const RESEARCH_SLOT_FILL_COLOR = '#ffffff'
    const RESEARCH_SLOT_FILL_OPACITY = 0.08
    const RESEARCH_SLOT_OUTLINE_COLOR = '#1f2937'
    const RESEARCH_SLOT_OUTLINE_OPACITY = 0.9
    const RESEARCH_SLOT_OUTLINE_WIDTH = 2.4
    const RESEARCH_NEXT_CELL_HIGHLIGHT_FILL_OPACITY = 0.34
    const RESEARCH_NEXT_CELL_HIGHLIGHT_STROKE_OPACITY = 0.98
    const RESEARCH_NEXT_CELL_HIGHLIGHT_STROKE_WIDTH = 3.6
    const RESEARCH_AREA_BY_ROW: Record<ResearchRow, ResearchArea> = {
        bid: ResearchArea.bid,
        slots: ResearchArea.slots,
        mergers: ResearchArea.mergers,
        expansion: ResearchArea.expansion,
        hull: ResearchArea.hull
    }

    let applyingResearch = $state(false)

    const researchCellsByRow: Record<ResearchRow, (typeof RESEARCH_TRACK_CELLS)[number][]> = {
        bid: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'bid'),
        slots: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'slots'),
        mergers: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'mergers'),
        expansion: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'expansion'),
        hull: RESEARCH_TRACK_CELLS.filter((cell) => cell.row === 'hull')
    }

    function clampResearchColumnIndex(value: number): number {
        return Math.max(0, Math.min(RESEARCH_COLUMN_COUNT - 1, Math.trunc(value)))
    }

    const showResearchAdvanceHighlights: boolean = $derived.by(
        () => gameSession.gameState.machineState === MachineState.ResearchAndDevelopment
    )

    const selectedResearchPlayerState: (typeof gameSession.gameState.players)[number] | null = $derived.by(
        () =>
            selectedPlayerId
                ? gameSession.gameState.players.find(
                      (playerState) => playerState.playerId === selectedPlayerId
                  ) ?? null
                : null
    )

    const researchNextCellHighlightColor: string = $derived.by(() => {
        if (!selectedPlayerId) {
            return '#475569'
        }

        return gameSession.colors.getPlayerUiColor(selectedPlayerId)
    })

    const researchNextCellHighlightStrokeColor: string = $derived.by(() =>
        shadeHexColor(researchNextCellHighlightColor, 0.48)
    )

    const nextResearchCellHighlights: ResearchNextCellHighlight[] = $derived.by(() => {
        if (!showResearchAdvanceHighlights || !selectedResearchPlayerState) {
            return []
        }

        const selectedCurrentPlayer =
            !!selectedPlayerId && !!currentPlayerId && selectedPlayerId === currentPlayerId
        const rowsToHighlight: readonly ResearchRow[] = selectedCurrentPlayer ? RESEARCH_ROWS : ['hull']

        const highlights: ResearchNextCellHighlight[] = []
        for (const row of rowsToHighlight) {
            const currentColumnIndex = clampResearchColumnIndex(selectedResearchPlayerState.research[row])
            if (currentColumnIndex >= RESEARCH_COLUMN_COUNT - 1) {
                continue
            }

            const nextCell = researchCellsByRow[row][currentColumnIndex + 1]
            if (!nextCell) {
                continue
            }

            highlights.push({
                key: `${row}-${currentColumnIndex + 1}`,
                row,
                left: nextCell.left,
                top: nextCell.top,
                width: nextCell.width,
                height: nextCell.height
            })
        }

        return highlights
    })

    const researchCubes: ResearchCubeEntry[] = $derived.by(() => {
        const cubes: ResearchCubeEntry[] = []
        const players = gameSession.gameState.players

        for (const row of RESEARCH_ROWS) {
            const rowCells = researchCellsByRow[row]
            const playerIdsByColumn: string[][] = [[], [], [], [], []]

            for (const playerState of players) {
                const researchValue = playerState.research[row]
                const columnIndex = clampResearchColumnIndex(researchValue)
                playerIdsByColumn[columnIndex].push(playerState.playerId)
            }

            for (let columnIndex = 0; columnIndex < RESEARCH_COLUMN_COUNT; columnIndex += 1) {
                const cell = rowCells[columnIndex]
                const playerIds = playerIdsByColumn[columnIndex]
                if (!cell || playerIds.length === 0) {
                    continue
                }

                const offsets = researchCubeOffsets(
                    playerIds.length,
                    RESEARCH_CUBE_SPACING,
                    row,
                    `${row}-${columnIndex}`
                )
                for (let offsetIndex = 0; offsetIndex < playerIds.length; offsetIndex += 1) {
                    const playerId = playerIds[offsetIndex]
                    const offset = offsets[offsetIndex]
                    if (!offset) {
                        continue
                    }

                    cubes.push({
                        key: `${row}-${columnIndex}-${playerId}`,
                        x:
                            cell.center.x +
                            offset.x +
                            researchCubeHorizontalJitter(
                                `${columnIndex}-${playerId}-${offsetIndex}`,
                                row,
                                RESEARCH_CUBE_SPACING
                            ),
                        y: cell.center.y + offset.y,
                        color: gameSession.colors.getPlayerUiColor(playerId),
                        rotationDegrees: researchCubeRotationDegrees(
                            `${columnIndex}-${playerId}`,
                            row
                        )
                    })
                }
            }
        }

        return cubes
    })

    const canSubmitResearchAction: boolean = $derived.by(() => {
        return (
            !applyingResearch &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.ResearchAndDevelopment &&
            !!selectedPlayerId &&
            gameSession.validActionTypes.includes(ActionType.Research)
        )
    })

    async function handleResearchHighlightPointerDown(highlight: ResearchNextCellHighlight): Promise<void> {
        if (!canSubmitResearchAction || !selectedPlayerId) {
            return
        }

        applyingResearch = true
        try {
            await gameSession.research(RESEARCH_AREA_BY_ROW[highlight.row])
        } finally {
            applyingResearch = false
        }
    }
</script>

<g class="select-none" aria-label="Research track cubes layer">
    {#if SHOW_RESEARCH_SLOT_OUTLINES}
        {#each RESEARCH_TRACK_CELLS as slot (slot.id)}
            <rect
                x={slot.left}
                y={slot.top}
                width={slot.width}
                height={slot.height}
                fill={RESEARCH_SLOT_FILL_COLOR}
                fill-opacity={RESEARCH_SLOT_FILL_OPACITY}
                stroke={RESEARCH_SLOT_OUTLINE_COLOR}
                stroke-width={RESEARCH_SLOT_OUTLINE_WIDTH}
                opacity={RESEARCH_SLOT_OUTLINE_OPACITY}
                stroke-linejoin="round"
                pointer-events="none"
            ></rect>
        {/each}
    {/if}

    {#each nextResearchCellHighlights as highlight (highlight.key)}
        <rect
            x={highlight.left}
            y={highlight.top}
            width={highlight.width}
            height={highlight.height}
            fill={researchNextCellHighlightColor}
            fill-opacity={RESEARCH_NEXT_CELL_HIGHLIGHT_FILL_OPACITY}
            stroke={researchNextCellHighlightStrokeColor}
            stroke-width={RESEARCH_NEXT_CELL_HIGHLIGHT_STROKE_WIDTH}
            stroke-opacity={RESEARCH_NEXT_CELL_HIGHLIGHT_STROKE_OPACITY}
            stroke-linejoin="round"
            pointer-events={canSubmitResearchAction ? 'all' : 'none'}
            cursor={canSubmitResearchAction ? 'pointer' : 'default'}
            onpointerdown={() => {
                handleResearchHighlightPointerDown(highlight)
            }}
        ></rect>
    {/each}

    {#each researchCubes as cube (cube.key)}
        <CubeMarker
            x={cube.x}
            y={cube.y}
            size={RESEARCH_CUBE_SIZE}
            color={cube.color}
            rotationDegrees={cube.rotationDegrees}
        />
    {/each}
</g>
