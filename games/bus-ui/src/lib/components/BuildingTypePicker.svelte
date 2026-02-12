<script lang="ts">
    import { BuildingType, isSiteId } from '@tabletop/bus'
    import { Floater } from '@tabletop/frontend-components'
    import HouseIcon from '$lib/images/HouseIcon.svelte'
    import OfficeIcon from '$lib/images/OfficeIcon.svelte'
    import PubIcon from '$lib/images/PubIcon.svelte'
    import type { BusGameSession } from '$lib/model/session.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession() as BusGameSession

    const BUILDING_TYPE_OPTIONS: { type: BuildingType; label: string }[] = [
        { type: BuildingType.House, label: 'House' },
        { type: BuildingType.Office, label: 'Office' },
        { type: BuildingType.Pub, label: 'Pub' }
    ]
    const PICKER_ICON_SIZE = 32
    const PICKER_ICON_BORDER_COLOR = '#333'
    const PICKER_ICON_BORDER_WIDTH = 1
    const PICKER_ICON_BORDER_RADIUS = PICKER_ICON_SIZE / 2 - PICKER_ICON_BORDER_WIDTH / 2

    let floater: Floater
    let optionChosen = $state(false)

    async function choose(type: BuildingType) {
        const siteId = gameSession.chosenSite
        if (!siteId || !isSiteId(siteId)) {
            return
        }

        optionChosen = true
        floater?.close()
        await gameSession.placeBuilding(siteId, type)
    }

    function handleClose() {
        if (optionChosen) {
            return
        }

        gameSession.chosenSite = undefined
    }
</script>

<Floater
    bind:this={floater}
    placement="top"
    offset={16}
    reference="#bus-building-picker-ref"
    onClose={handleClose}
>
    <div
        class="flex items-center gap-0 rounded-xl border-2 border-[#7c8a9c] bg-[#e4ebf1]/96 p-1 shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
    >
        {#each BUILDING_TYPE_OPTIONS as option (option.type)}
            <button
                type="button"
                class="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-transparent bg-transparent p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff27a] focus-visible:ring-offset-1 focus-visible:ring-offset-[#7c8a9c]"
                aria-label={`Choose ${option.label}`}
                onclick={() => choose(option.type)}
            >
                <span class="relative block h-[32px] w-[32px]">
                    {#if option.type === BuildingType.House}
                        <HouseIcon width={PICKER_ICON_SIZE} height={PICKER_ICON_SIZE} />
                    {:else if option.type === BuildingType.Office}
                        <OfficeIcon width={PICKER_ICON_SIZE} height={PICKER_ICON_SIZE} />
                    {:else}
                        <PubIcon width={PICKER_ICON_SIZE} height={PICKER_ICON_SIZE} />
                    {/if}
                    <svg
                        class="pointer-events-none absolute inset-0"
                        width={PICKER_ICON_SIZE}
                        height={PICKER_ICON_SIZE}
                        viewBox={`0 0 ${PICKER_ICON_SIZE} ${PICKER_ICON_SIZE}`}
                        aria-hidden="true"
                    >
                        <circle
                            cx={PICKER_ICON_SIZE / 2}
                            cy={PICKER_ICON_SIZE / 2}
                            r={PICKER_ICON_BORDER_RADIUS}
                            fill="none"
                            stroke={PICKER_ICON_BORDER_COLOR}
                            stroke-width={PICKER_ICON_BORDER_WIDTH}
                        ></circle>
                    </svg>
                </span>
            </button>
        {/each}
    </div>
</Floater>
