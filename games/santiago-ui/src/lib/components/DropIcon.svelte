<script lang="ts">
    let { class: className = '' }: { class?: string } = $props()
</script>

<!-- A small water drop — matches the canal/spring water color used on the board,
     styled for the canal-building and irrigation phase icons. -->
<svg viewBox="0 0 24 24" class={className} aria-hidden="true">
    <path d="M12 3 C12 3 6 11 6 15.5 A6 6 0 0 0 18 15.5 C18 11 12 3 12 3 Z"
          fill="#38bdf8" stroke="#0369a1" stroke-width="1" />
    <ellipse cx="9.8" cy="13" rx="1.4" ry="2.6" fill="#bae6fd" opacity="0.6" />
</svg>
