<script lang="ts">
    import OracleArt from '../board/OracleArt.svelte'

    let { size = 24, color }: { size?: number; color?: string } = $props()

    const uid = $props.id()
</script>

<svg width={size} height={size} viewBox="-26 -26 52 52" aria-hidden="true">
    <clipPath id="mg-oracle-icon-{uid}"><circle r="25.7"></circle></clipPath>
    <g clip-path="url(#mg-oracle-icon-{uid})">
        <OracleArt attentionColor={color} />
    </g>
</svg>
