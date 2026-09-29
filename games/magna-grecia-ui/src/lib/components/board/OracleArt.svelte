<script lang="ts">
    let { attentionColor }: { attentionColor?: string } = $props()
</script>

<g>
    <ellipse cx="0" cy="18" rx="22" ry="8" fill="#6b5a3a" opacity="0.3"></ellipse>
    <ellipse cx="0" cy="14" rx="20" ry="8" fill="url(#mg-marble)" stroke="#8f8779" stroke-width="1"
    ></ellipse>
    {#if attentionColor}
        <ellipse cx="0" cy="14" rx="20" ry="8" fill="none" stroke={attentionColor} stroke-width="3"
        ></ellipse>
    {/if}
    <path d="M -7 12 L -6 -6 L 6 -6 L 7 12 Z" fill="#f7f3ea" stroke="#77705f" stroke-width="0.9"
    ></path>
    <path d="M -3.5 10 L -3 -4" stroke="#d2cbbb" stroke-width="1.2"></path>
    <rect
        x="-9"
        y="-9"
        width="18"
        height="4"
        rx="1"
        fill="#efe9dc"
        stroke="#77705f"
        stroke-width="0.9"
    ></rect>
    <circle cx="0" cy="-16" r="7" fill="#f7f3ea" stroke="#77705f" stroke-width="0.9"></circle>
    <path d="M -7 -18 Q 0 -27 7 -18 Q 5 -23 0 -23 Q -5 -23 -7 -18 Z" fill="#d8cfbd"></path>
    <path d="M -6 -9 Q 0 -4 6 -9" fill="#e5ddcc" stroke="#77705f" stroke-width="0.6"></path>
    <circle cx="-2.4" cy="-16" r="0.8" fill="#5b5446"></circle>
    <circle cx="2.4" cy="-16" r="0.8" fill="#5b5446"></circle>
</g>
