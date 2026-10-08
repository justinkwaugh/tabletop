<script lang="ts">
    import { W, H } from '$lib/utils/boardGeometry.js'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    const MOOD_EASE_SECONDS = 4

    const session = getGameSession()
    const mood = $derived(session.landMood)
    const layerStyle = $derived(
        `left: 10px; top: 10px; width: ${W}px; height: ${H}px; ` +
            `transition-duration: ${session.easesAmbientChanges ? MOOD_EASE_SECONDS : 0}s`
    )
</script>

<div class="light sun-wash" aria-hidden="true" style={layerStyle}></div>
<div class="light lush" aria-hidden="true" style="{layerStyle}; opacity: {mood.lush}"></div>
<div class="light bleach" aria-hidden="true" style="{layerStyle}; opacity: {mood.drought * 0.35}"></div>
<div class="light glare" aria-hidden="true" style="{layerStyle}; opacity: {mood.drought}"></div>

<style>
    .light {
        position: absolute;
        pointer-events: none;
        border-radius: 14px;
        transition-property: opacity;
        transition-timing-function: ease-in-out;
    }
    .sun-wash {
        mix-blend-mode: soft-light;
        opacity: 0.7;
        background:
            radial-gradient(
                130% 120% at 4% 0%,
                rgba(255, 246, 210, 1),
                rgba(255, 232, 170, 0.55) 40%,
                rgba(255, 220, 150, 0) 85%
            ),
            linear-gradient(rgba(255, 236, 185, 0.35), rgba(255, 236, 185, 0.35));
    }
    /* Thriving land: a richer, golden warmth. */
    .lush {
        mix-blend-mode: soft-light;
        background: radial-gradient(
            120% 110% at 8% 4%,
            rgba(255, 196, 70, 0.75),
            rgba(255, 186, 60, 0.35) 55%,
            rgba(255, 176, 50, 0.15) 100%
        );
    }
    /* Drying land: color drains away... */
    .bleach {
        mix-blend-mode: saturation;
        background: rgb(150, 150, 150);
    }
    /* ...and the sun turns hard and white. */
    .glare {
        mix-blend-mode: screen;
        background: radial-gradient(
            130% 120% at 4% 0%,
            rgba(255, 252, 240, 0.32),
            rgba(255, 250, 235, 0.12) 50%,
            rgba(255, 250, 235, 0.04) 100%
        );
    }
</style>
