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
        width: auto;
        height: auto;
        max-width: 92vw;
        max-height: min(100dvh - 48px, 560px);
        border-radius: 14px;
        box-shadow: 0 18px 48px rgb(0 0 0 / 0.5);
    }
</style>
