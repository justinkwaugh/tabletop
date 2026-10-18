<script lang="ts">
    let { size = 18 }: { size?: number } = $props()
</script>

<svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-hidden="true">
    <path
        d="M 2 4 L 12 4 L 12 1 L 18 1 L 18 6 L 24 6 L 24 3 L 27 3 L 27 9 L 29 9 L 29 15 L 2 15 Z"
        fill="#c42a22"
        stroke="#4a0f0b"
        stroke-width="1.2"
    />
    <circle cx="7" cy="17" r="3" fill="#4a0f0b" />
    <circle cx="16" cy="17" r="3" fill="#4a0f0b" />
    <circle cx="24" cy="17" r="3" fill="#4a0f0b" />
</svg>
