<script lang="ts">
    // Drawn rather than the 🩷/💔 emoji: U+1FA77 (Emoji 15.0) has no glyph in Windows' Segoe UI
    // Emoji and rendered as a tofu box there.
    let { broken = false }: { broken?: boolean } = $props()
</script>

<svg
    viewBox="0 0 24 24"
    class="block w-full h-full"
    aria-hidden="true"
    fill="#ff4fa8"
    stroke="#7a1f3d"
    stroke-width="1.1"
    stroke-linejoin="round"
>
    {#if broken}
        <path
            transform="translate(-0.5 0) rotate(-4 8 12)"
            d="M11.5 6.9 C10.5 5.1 9.2 4 7.7 4 C5.1 4 3 6.2 3 8.9 C3 13.6 7.2 16.9 11.9 20.4 L10.5 16.5 L12.9 13 L9.9 10.3 Z"
        />
        <path
            transform="translate(0.5 0.3) rotate(4 16 12)"
            d="M12.6 6.9 C13.5 5.1 14.8 4 16.3 4 C18.9 4 21 6.2 21 8.9 C21 13.6 16.8 16.9 12.6 20.3 L11.5 16.7 L13.9 13 L10.9 10.3 Z"
        />
    {:else}
        <path
            d="M12 20.6 C7.2 16.9 3 13.6 3 8.9 C3 6.2 5.1 4 7.7 4 C9.5 4 11 5 12 6.7 C13 5 14.5 4 16.3 4 C18.9 4 21 6.2 21 8.9 C21 13.6 16.8 16.9 12 20.6 Z"
        />
    {/if}
</svg>
