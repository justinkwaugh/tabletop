<script lang="ts">
    import Lightbox from '../presentation/Lightbox.svelte'

    let {
        imageUrl,
        name,
        onclose
    }: {
        imageUrl: string
        name: string
        onclose: () => void
    } = $props()
</script>

<Lightbox label={name} {onclose}>
    <div data-card-image>
        <img class="card-image" src={imageUrl} alt={name} />
    </div>
</Lightbox>

<style>
    .card-image {
        display: block;
        /* Portrait cards (about 3:5): fill the shorter viewport dimension with a margin. */
        width: min(92vw, calc((100dvh - 48px) * 0.6));
        max-height: calc(100dvh - 48px);
        height: auto;
        border-radius: 14px;
        box-shadow: 0 18px 48px rgb(0 0 0 / 0.5);
    }
</style>
