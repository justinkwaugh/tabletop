<script lang="ts">
    // The magnifier's glass, shared by a panel card's corner and a lit site's corner.
    let { size = 16 }: { size?: number } = $props()
</script>

<svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width="2.6"
>
    <circle cx="10" cy="10" r="6.5"></circle>
    <path d="M15 15l6 6" stroke-linecap="round"></path>
</svg>
