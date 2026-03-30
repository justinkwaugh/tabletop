<script lang="ts">
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import type { StartCompanyDeedEntry } from './startCompany.js'

    type StartCompanyDeedCardState = StartCompanyDeedEntry & {
        isHovered: boolean
        isSelected: boolean
        showSelectedOutline: boolean
        fill: string
        fillOpacity: number
    }

    let {
        deeds,
        selectedStartCompanyDeedId,
        applyingAreaAction,
        hasHoveredCityReferenceCardSpotlight,
        onStageSelection
    }: {
        deeds: readonly StartCompanyDeedEntry[]
        selectedStartCompanyDeedId: string | null
        applyingAreaAction: boolean
        hasHoveredCityReferenceCardSpotlight: boolean
        onStageSelection(): void
    } = $props()

    const gameSession = getGameSession()

    let hoveredStartCompanyDeedId: string | null = $derived.by(() => {
        gameSession.updatingVisibleState
        gameSession.gameState
        return null
    })

    const deedCardStates: StartCompanyDeedCardState[] = $derived.by(() => {
        return deeds.map((deed) => {
            const isSelected = selectedStartCompanyDeedId === deed.deedId
            const isHovered = hoveredStartCompanyDeedId === deed.deedId
            const showSelectedOutline = isSelected && !hasHoveredCityReferenceCardSpotlight

            return {
                ...deed,
                isHovered,
                isSelected,
                showSelectedOutline,
                fill: showSelectedOutline ? '#ffffff' : '#000000',
                fillOpacity: hasHoveredCityReferenceCardSpotlight
                    ? 0.001
                    : isSelected
                      ? 0.1
                      : isHovered
                        ? 0.08
                        : 0.001
            }
        })
    })

    function handleDeedMouseEnter(deedId: string): void {
        hoveredStartCompanyDeedId = deedId
        gameSession.hoverAvailableDeed(deedId)
    }

    function handleDeedMouseLeave(deedId: string): void {
        if (hoveredStartCompanyDeedId === deedId) {
            hoveredStartCompanyDeedId = null
        }
        if (gameSession.hoveredAvailableDeedId === deedId) {
            gameSession.clearHoveredAvailableDeed()
        }
    }

    function handleDeedClick(deedId: string): void {
        if (applyingAreaAction) {
            return
        }

        gameSession.stageStartCompanyDeed(deedId)
        onStageSelection()
    }
</script>

{#each deedCardStates as deed (deed.deedId)}
    {#if deed.showSelectedOutline}
        <rect
            x={deed.x - BOARD_DEED_CARD_WIDTH / 2}
            y={deed.y - BOARD_DEED_CARD_HEIGHT / 2}
            width={BOARD_DEED_CARD_WIDTH}
            height={BOARD_DEED_CARD_HEIGHT}
            rx={BOARD_DEED_CARD_CORNER_RX}
            ry={BOARD_DEED_CARD_CORNER_RY}
            fill="none"
            stroke="#fff8d7"
            stroke-width="7.2"
            opacity="0.9"
            pointer-events="none"
        />
        <rect
            x={deed.x - BOARD_DEED_CARD_WIDTH / 2}
            y={deed.y - BOARD_DEED_CARD_HEIGHT / 2}
            width={BOARD_DEED_CARD_WIDTH}
            height={BOARD_DEED_CARD_HEIGHT}
            rx={BOARD_DEED_CARD_CORNER_RX}
            ry={BOARD_DEED_CARD_CORNER_RY}
            fill="none"
            stroke="#1f2937"
            stroke-width="2.2"
            opacity="0.88"
            pointer-events="none"
        />
    {/if}
    <rect
        x={deed.x - BOARD_DEED_CARD_WIDTH / 2}
        y={deed.y - BOARD_DEED_CARD_HEIGHT / 2}
        width={BOARD_DEED_CARD_WIDTH}
        height={BOARD_DEED_CARD_HEIGHT}
        rx={BOARD_DEED_CARD_CORNER_RX}
        ry={BOARD_DEED_CARD_CORNER_RY}
        fill={deed.fill}
        fill-opacity={deed.fillOpacity}
        stroke="none"
        stroke-width={0}
        pointer-events={applyingAreaAction ? 'none' : 'all'}
        cursor={applyingAreaAction ? 'default' : 'pointer'}
        onmouseenter={() => {
            handleDeedMouseEnter(deed.deedId)
        }}
        onmouseleave={() => {
            handleDeedMouseLeave(deed.deedId)
        }}
        onclick={() => {
            handleDeedClick(deed.deedId)
        }}
    />
{/each}
