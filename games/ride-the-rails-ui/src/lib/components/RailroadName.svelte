<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadName } from '$lib/utils/describeAction.js'

    let { railroadId }: { railroadId: RailroadId } = $props()

    // U-6: a railroad is always drawn in its rule colour, with its monogram ink.
    const token = $derived(`--rtr-railroad-${railroadId.slice('railroad.'.length)}`)
</script>

<span
    class="rounded px-1.5 font-medium"
    style:background-color="var({token})"
    style:color="var({token}-ink)">{railroadName(railroadId)}</span
>
