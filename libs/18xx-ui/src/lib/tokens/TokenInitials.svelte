<script lang="ts">
    import { centredTextShift } from '../presentation/textBaseline.js'

    let { label, fill }: { label: string; fill: string } = $props()
    const FontSizes = [16, 16, 16, 14, 11.5, 9.5]
    const fontSize = $derived(FontSizes[Math.min(label.length, FontSizes.length - 1)])
</script>

<text
    x="20"
    y="20"
    text-anchor="middle"
    dy={centredTextShift(fontSize)}
    font-family="ui-sans-serif, system-ui, sans-serif"
    font-size={fontSize}
    font-weight="700"
    {fill}>{label}</text
>
