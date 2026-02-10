<script lang="ts">
    import { BuildingType } from '@tabletop/bus'
    import { Floater } from '@tabletop/frontend-components'
    import HouseIcon from '$lib/images/HouseIcon.svelte'
    import OfficeIcon from '$lib/images/OfficeIcon.svelte'
    import PubIcon from '$lib/images/PubIcon.svelte'

    let {
        onChoose,
        onClose = () => {}
    }: {
        onChoose?: (buildingType: BuildingType) => void
        onClose?: () => void
    } = $props()

    const BUILDING_TYPE_OPTIONS: { type: BuildingType; label: string }[] = [
        { type: BuildingType.House, label: 'House' },
        { type: BuildingType.Office, label: 'Office' },
        { type: BuildingType.Pub, label: 'Pub' }
    ]

    function choose(type: BuildingType) {
        onChoose?.(type)
    }
</script>

<Floater placement="top" offset={16} reference="#bus-building-picker-ref" {onClose}>
    <div
        class="flex items-center gap-1 rounded-xl border border-[#7c8a9c] bg-[#e4ebf1]/96 p-1 shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
    >
        {#each BUILDING_TYPE_OPTIONS as option (option.type)}
            <button
                type="button"
                class="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-[#8fa1b4] bg-white p-0.5 transition-colors hover:border-[#5a6d84] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff27a] focus-visible:ring-offset-1 focus-visible:ring-offset-[#7c8a9c]"
                aria-label={`Choose ${option.label}`}
                onclick={() => choose(option.type)}
            >
                {#if option.type === BuildingType.House}
                    <HouseIcon width={32} height={32} />
                {:else if option.type === BuildingType.Office}
                    <OfficeIcon width={32} height={32} />
                {:else}
                    <PubIcon width={32} height={32} />
                {/if}
            </button>
        {/each}
    </div>
</Floater>
