<script lang="ts">
    import EventTile from '../EventTile.svelte'
</script>

<div class="sh-step">
    <div class="row">
        <EventTile eventId="homesteaders" width={96} />
        <p class="hint">
            Homesteaders: as the faction with the fewest settlements, add 2 settlements to one of
            your bases. Choose one of the highlighted systems on the map.
        </p>
    </div>
</div>

<style>
    .row {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }
</style>
