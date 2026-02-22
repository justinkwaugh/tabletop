<script lang="ts">
    import GlassBeadIcon from '$lib/images/GlassBeadIcon.svelte'

    type BeadTone = 'amber' | 'red' | 'green'

    const GLASS_BEAD_VIEWBOX_WIDTH = 100
    const GLASS_BEAD_VIEWBOX_HEIGHT = 100
    const GLASS_BEAD_ASPECT_RATIO = GLASS_BEAD_VIEWBOX_WIDTH / GLASS_BEAD_VIEWBOX_HEIGHT

    let {
        x,
        y,
        height = 18,
        tone = 'amber',
        opacity = 0.85
    }: {
        x: number
        y: number
        height?: number
        tone?: BeadTone
        opacity?: number
    } = $props()

    const width = $derived(height * GLASS_BEAD_ASPECT_RATIO)
    const iconX = $derived(x - width / 2)
    const iconY = $derived(y - height / 2)
    const iconIdSuffix = $derived(`${tone}-${Math.round(x * 10)}-${Math.round(y * 10)}`)
</script>

<g class="pointer-events-none select-none" aria-hidden="true" {opacity}>
    <GlassBeadIcon x={iconX} y={iconY} {width} {height} {tone} idSuffix={iconIdSuffix} />
</g>
