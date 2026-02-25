<script lang="ts">
    import CubeIcon from '$lib/images/CubeIcon.svelte'

    let {
        x,
        y,
        size = 16,
        color = '#6b7280',
        rotationDegrees = 0
    }: {
        x: number
        y: number
        size?: number
        color?: string
        rotationDegrees?: number
    } = $props()
</script>

<g class="pointer-events-none select-none" aria-hidden="true">
    <g transform={`translate(${x} ${y}) rotate(${rotationDegrees})`}>
        <CubeIcon x={-size / 2} y={-size / 2} width={size} height={size} fill={color} />
    </g>
</g>
