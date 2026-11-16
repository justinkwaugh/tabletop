<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadName } from '$lib/utils/describeAction.js'
    import RailroadPieceIcon from '../board/RailroadPieceIcon.svelte'

    let { railroadId }: { railroadId: RailroadId } = $props()
</script>

<span
    class="inline-flex items-center gap-1 rounded-full border border-rtr-line bg-rtr-panel-raised px-2 py-0.5 text-sm font-medium text-rtr-ink"
>
    <RailroadPieceIcon {railroadId} size={18} />
    {railroadName(railroadId)}
</span>
