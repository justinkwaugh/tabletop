<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadName } from '$lib/utils/describeAction.js'
    import LocomotiveIcon from '../board/LocomotiveIcon.svelte'

    let { railroadId }: { railroadId: RailroadId } = $props()
</script>

<span
    class="inline-flex items-center gap-1 rounded-full border border-rtr-line bg-rtr-panel-raised px-2 py-0.5 text-sm font-medium text-rtr-ink"
>
    <LocomotiveIcon {railroadId} width={20} />
    {railroadName(railroadId)}
</span>
