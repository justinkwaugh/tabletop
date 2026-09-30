<script lang="ts">
    import { favorTokenImage, secretTokenImage } from '$lib/images/tileImages.js'

    let {
        kind,
        count,
        size = 34,
        title = undefined
    }: { kind: 'favor' | 'secret'; count: number; size?: number; title?: string } = $props()

    let src = $derived(kind === 'favor' ? favorTokenImage() : secretTokenImage())
</script>

<span class="token token--{kind}" style="width:{size}px; height:{size}px;" {title}>
    <img {src} alt={kind === 'favor' ? 'favor' : 'secrets'} />
    <span class="token__count" style="font-size:{Math.round(size * 0.5)}px;">{count}</span>
</span>

<style>
    .token {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        line-height: 0;
        pointer-events: none;
    }
    .token img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }
    .token__count {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        line-height: 1;
        color: #fff;
        text-shadow:
            0 0 3px rgba(0, 0, 0, 0.98),
            0 0 2px rgba(0, 0, 0, 0.98),
            0 1px 1px rgba(0, 0, 0, 0.98);
    }
</style>
