<script lang="ts">
    import { BuildingType, type BoardSquare, getDistrictInfo } from '@tabletop/urbino'
    import { getGameSession } from '$lib/model/sessionContext.svelte'

    let {
        pos,
        building,
        architectIndex,
        isValid,
        selectedArchitectIndex,
        playerColor,
        onclick,
    }: {
        pos: number
        building: BoardSquare
        architectIndex: number
        isValid: boolean
        selectedArchitectIndex: number | undefined
        playerColor: string | undefined
        onclick: () => void
    } = $props()

    const session = getGameSession()

    const isArchitectHere = $derived(architectIndex >= 0)
    const isArchitectSelected = $derived(
        isArchitectHere && architectIndex === selectedArchitectIndex
    )
    const isClickable = $derived(isValid || isArchitectHere)

    const bgClass = $derived.by(() => {
        if (isValid) return 'bg-[#c8e6a0] hover:bg-[#b0d880]'
        return 'bg-[#e6e6e6] hover:bg-[#d9d9d9]'
    })

    // Tooltip — portaled to document.body to escape ScalingWrapper's CSS transform
    let tooltipEl: HTMLDivElement | null = null

    function buildTooltip(x: number, y: number): HTMLDivElement {
        const state = session.gameState
        const info = getDistrictInfo(state.board, pos, state.monumentsVariant)

        const container = document.createElement('div')
        Object.assign(container.style, {
            position: 'fixed',
            zIndex: '9999',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            lineHeight: '1.6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            pointerEvents: 'none',
            left: `${x + 14}px`,
            top: `${y - 10}px`,
        })

        const header = document.createElement('div')
        Object.assign(header.style, { fontWeight: '600', color: '#6b7280', marginBottom: '4px' })
        header.textContent = info.contested ? 'District' : 'District (uncontested)'
        container.appendChild(header)

        if (info.contested) {
            const sorted = [...info.playerStats.entries()].sort((a, b) => b[1].total - a[1].total)
            for (const [pid, stats] of sorted) {
                const isWinner = pid === info.winner
                const row = document.createElement('div')
                Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: isWinner ? '600' : '400' })

                const dot = document.createElement('div')
                Object.assign(dot.style, {
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '1px solid #9ca3af',
                    background: session.colors.getPlayerUiColor(pid),
                    flexShrink: '0',
                })

                const label = document.createElement('span')
                label.style.color = '#1f2937'
                const name = pid === session.myPlayer?.id ? 'You' : (session.getPlayerName(pid) ?? 'Player')
                const suffix = isWinner ? ' ★' : ''
                label.textContent = `${name}: ${stats.total} pt${stats.total !== 1 ? 's' : ''}${suffix}`

                row.appendChild(dot)
                row.appendChild(label)
                container.appendChild(row)
            }
        }

        return container
    }

    function onmouseenter(e: MouseEvent) {
        if (!building) return
        tooltipEl = buildTooltip(e.clientX, e.clientY)
        document.body.appendChild(tooltipEl)
    }

    function onmousemove(e: MouseEvent) {
        if (!tooltipEl) return
        tooltipEl.style.left = `${e.clientX + 14}px`
        tooltipEl.style.top = `${e.clientY - 10}px`
    }

    function onmouseleave() {
        tooltipEl?.remove()
        tooltipEl = null
    }

    $effect(() => () => {
        tooltipEl?.remove()
        tooltipEl = null
    })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="relative flex h-12 w-12 cursor-pointer items-center justify-center transition-colors {bgClass}"
    class:cursor-pointer={isClickable}
    class:cursor-default={!isClickable}
    class:ring-2={isArchitectSelected}
    class:ring-[#c87941]={isArchitectSelected}
    {onclick}
    {onmouseenter}
    {onmousemove}
    {onmouseleave}
>
    <!-- Building -->
    {#if building}
        <svg
            viewBox="0 0 20 20"
            width="35"
            height={building.buildingType === BuildingType.Tower ? 38.5 : 35}
            preserveAspectRatio={building.buildingType === BuildingType.Tower ? 'none' : 'xMidYMid meet'}
            fill={playerColor}
            stroke="#483737"
            stroke-width="1"
            stroke-linejoin="round"
            class="select-none drop-shadow-sm"
        >
            <title>{building.buildingType}</title>
            {#if building.buildingType === BuildingType.House}
                <path d="M 2.5,4.75 L 17.5,4.75 L 19,9.25 L 1,9.25 Z" />
                <path d="M 1,9.25 L 19,9.25 L 19,15.25 L 1,15.25 Z" />
            {:else if building.buildingType === BuildingType.Palace}
                <path d="M 1,11.5 L 19,11.5 L 19,17.5 L 1,17.5 Z" />
                <path d="M 10,2.5 L 19,11.5 L 1,11.5 Z" />
                <path d="M 2.5,7 L 10,2.25 L 10,5.5 L 1,11.5 Z" />
                <path d="M 10,2.25 L 17.5,7 L 19,11.5 L 10,5.5 Z" />
            {:else if building.buildingType === BuildingType.Tower}
                <path d="M 2.3,8.7 L 17.7,8.7 L 17.7,19 L 2.3,19 Z" />
                <path d="M 10,4.1 L 17.2,8.7 L 17.2,10.3 L 2.8,10.3 L 2.8,8.7 Z" />
                <path d="M 3.6,4.9 L 10,1 L 10,3.6 L 2.3,8.7 Z" />
                <path d="M 10,1 L 16.4,4.9 L 17.2,8.7 L 10,3.6 Z" />
            {/if}
        </svg>
    {/if}

    <!-- Architect marker -->
    {#if isArchitectHere}
        <div
            class="absolute inset-0 flex items-center justify-center"
            title="Architect {architectIndex + 1}"
        >
            <svg
                viewBox="0 0 20 20"
                width="31"
                height="31"
                fill={isArchitectSelected ? '#991b1b' : '#dc2626'}
                stroke="#483737"
                stroke-width="1.5"
                class="select-none drop-shadow-sm"
            >
                <path d="M 5.5,1 L 14.5,1 L 12.25,7.75 L 16.75,19 L 3.25,19 L 7.75,7.75 Z" />
                <text x="10" y="15" text-anchor="middle" dominant-baseline="middle"
                      font-size="8" font-weight="bold" fill="white" stroke="#333"
                      stroke-width="0.5" paint-order="stroke fill">{architectIndex + 1}</text>
            </svg>
        </div>
    {/if}

    <!-- Valid placement indicator (empty valid square) -->
    {#if isValid && !building}
        <div class="h-3.5 w-3.5 rounded-full bg-[#6b9b30] opacity-60"></div>
    {/if}
</div>
