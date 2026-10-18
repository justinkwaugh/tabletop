<script lang="ts">
    // An event tile as printed, octagonal.
    import { eventDefinition } from '@tabletop/stellar-horizons-2'
    import { EVENT_ART } from '$lib/art/manifest.js'

    let { eventId, width = 72 }: { eventId: string; width?: number } = $props()
    const definition = $derived(eventDefinition(eventId))
</script>

<img
    class="event"
    src={EVENT_ART[eventId]}
    alt={definition.name}
    title={definition.name}
    {width}
    height={width}
/>

<style>
    .event {
        display: block;
        flex: none;
    }
</style>
