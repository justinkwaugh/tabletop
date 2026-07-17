<script lang="ts">
    let { class: className = '' }: { class?: string } = $props()
</script>

<!-- A small escudo coin: a gold disc with the cifrão ("S" crossed by two bars) — the
     same currency motif as MoneyBadge, styled down to icon size for the bidding phase. -->
<svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#e0c98f" stroke="#6b4a23" stroke-width="1.5" />
    <circle cx="12" cy="12" r="7" fill="none" stroke="#6b4a23" stroke-width="0.75" stroke-dasharray="1.2 1.2" opacity="0.6" />
    <text x="12" y="13" text-anchor="middle" dominant-baseline="central"
          font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="11" fill="#6b4a23">S</text>
    <line x1="10.4" y1="7.5" x2="10.4" y2="17" stroke="#6b4a23" stroke-width="0.9" />
    <line x1="13.6" y1="7.5" x2="13.6" y2="17" stroke="#6b4a23" stroke-width="0.9" />
</svg>
