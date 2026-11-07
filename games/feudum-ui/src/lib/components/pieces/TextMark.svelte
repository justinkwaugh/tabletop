<script lang="ts">
    import { StarPath } from '$lib/utils/pieceShapes.js'

    /** A vp or status star in a line of text, drawn so no font has to carry it. */
    let { kind, label }: { kind: 'vp' | 'star'; label: string } = $props()
</script>

<svg width="1.2em" height="1.2em" viewBox="0 0 24 24" role="img" aria-label={label}>
    <title>{label}</title>
    {#if kind === 'vp'}
        <circle cx="12" cy="12" r="11" fill="var(--feudum-parchment)" stroke="var(--feudum-ink)"
        ></circle>
        <path d={StarPath} transform="translate(3 3) scale(0.75)" fill="var(--feudum-ink)"></path>
    {:else}
        <path d={StarPath} fill="var(--feudum-accent)" stroke="var(--feudum-halo)"></path>
    {/if}
</svg>
