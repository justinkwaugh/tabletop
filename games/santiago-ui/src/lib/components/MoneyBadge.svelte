<script lang="ts">
    let {
        amount,
        hidden = false,
        onclick,
        disabled = false
    }: {
        amount: number
        hidden?: boolean
        onclick?: () => void
        disabled?: boolean
    } = $props()

    const interactive = $derived(!!onclick)
</script>

<svelte:element
    this={interactive ? 'button' : 'span'}
    type={interactive ? 'button' : undefined}
    {onclick}
    disabled={interactive ? disabled : undefined}
    class="group relative inline-flex items-center justify-center shrink-0 leading-none {interactive ? 'cursor-pointer disabled:cursor-not-allowed disabled:opacity-40' : ''}"
    style="width: 2.5em; height: 1.6em; {hidden ? 'opacity: 0.45; filter: grayscale(70%);' : ''}"
>
    <svg viewBox="0 0 48 30"
         class="absolute inset-0 w-full h-full {interactive ? 'transition-[filter,transform] duration-150 group-hover:brightness-110 group-hover:drop-shadow-[0_0_6px_rgba(250,204,21,0.85)] group-active:scale-95' : ''}"
         aria-hidden="true">
        <defs>
            <pattern id="banknote-texture" width="5" height="5" patternTransform="rotate(30)" patternUnits="userSpaceOnUse">
                <rect width="5" height="5" fill="#e0c98f" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#c2a968" stroke-width="0.6" opacity="0.4" />
            </pattern>
        </defs>
        <rect x="1" y="1" width="46" height="28" rx="3" fill="url(#banknote-texture)" stroke="#6b4a23" stroke-width="1.5" />
        <rect x="4" y="4" width="40" height="22" rx="2" fill="none" stroke="#6b4a23" stroke-width="0.75" stroke-dasharray="1.4 1.4" opacity="0.6" />
        <!-- Cifrão — the escudo currency symbol: an "S" crossed by two vertical bars -->
        <text x="9.5" y="16" text-anchor="middle" dominant-baseline="central"
              font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="12"
              fill="#6b4a23" opacity="0.7">S</text>
        <line x1="7.9" y1="9.5" x2="7.9" y2="21" stroke="#6b4a23" stroke-width="0.9" opacity="0.7" />
        <line x1="11.1" y1="9.5" x2="11.1" y2="21" stroke="#6b4a23" stroke-width="0.9" opacity="0.7" />
    </svg>
    <span
        class="relative z-[1] font-bold text-[0.78em] tracking-tight"
        style="color:#4a2f12; text-shadow: 0 1px 0 rgba(255,255,255,0.35); padding-left: 0.6em"
    >
        {hidden ? '?' : amount}
    </span>
</svelte:element>
