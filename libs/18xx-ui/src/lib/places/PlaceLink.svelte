<script lang="ts">
    import { getPlaceLinks } from './placeLinks.js'

    let { locationId }: { locationId: string } = $props()

    const places = getPlaceLinks()
    const name = $derived(places.name(locationId))
</script>

<button
    type="button"
    class="place-link"
    data-description-exclude
    title={`Show ${name} on the map`}
    onclick={() => places.reveal(locationId)}>{name}</button
>

<style>
    .place-link {
        display: inline;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        color: inherit;
        text-align: inherit;
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        cursor: pointer;
    }
    .place-link:hover {
        text-decoration-style: solid;
    }
</style>
