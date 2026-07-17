<script lang="ts">
    let { class: className = '' }: { class?: string } = $props()
</script>

<!-- A small sprouting-plant icon: soil mound, stem, and two curved leaves —
     hand-drawn in spirit to match the escudo note's illustrated style. -->
<svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <ellipse cx="12" cy="20.5" rx="5" ry="1.4" fill="#6b4423" opacity="0.5" />
    <path d="M12 20 V12.5" stroke="#7a9b3e" stroke-width="2" stroke-linecap="round" />
    <path d="M12 12.5 Q6 12.5 5 5 Q13 6 12 12.5 Z" fill="#4ade80" />
    <path d="M12 12.5 Q18 12.5 19 5 Q11 6 12 12.5 Z" fill="#86efac" />
</svg>
