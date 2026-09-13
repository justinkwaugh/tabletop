<script lang="ts">
    let { name, color, title }: { name: string; color: string; title?: string } = $props()
    const textColor = $derived.by(() => {
        const channels = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
        const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
        const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
        return luminance > 0.1992 ? '#181818' : '#ffffff'
    })
</script>

<span class="train-badge" style:background={color} style:color={textColor} {title}>{name}</span>

<style>
    .train-badge {
        display: inline-block;
        padding: 0 4px;
        border-radius: 3px;
        color: #181818;
        filter: saturate(0.6);
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        white-space: nowrap;
    }
</style>
