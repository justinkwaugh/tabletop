<script lang="ts">
    import Lightbox from '../presentation/Lightbox.svelte'
    import PublishedCardPlate from './PublishedCardPlate.svelte'
    import type { PublishedCardPlate as Plate } from '../session/eighteenXXSession.svelte.js'

    let {
        imageUrl,
        name,
        plate,
        onclose
    }: {
        imageUrl: string
        name: string
        plate?: Plate
        onclose: () => void
    } = $props()
</script>

<Lightbox label={name} {onclose}>
    <div data-card-image>
        <img class="card-image" src={imageUrl} alt={name} />
        {#if plate}<PublishedCardPlate {plate} />{/if}
    </div>
</Lightbox>

<style>
    [data-card-image] {
        width: fit-content;
    }
    .card-image {
        display: block;
        width: auto;
        height: auto;
        max-width: 92vw;
        max-height: min(100dvh - 48px, 560px);
        border-radius: 14px;
        box-shadow: 0 18px 48px rgb(0 0 0 / 0.5);
    }
</style>
