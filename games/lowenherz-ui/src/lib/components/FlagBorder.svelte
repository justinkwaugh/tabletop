<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import flagsLines from '$lib/images/borders/flags-lines.png'
    import flagsBodyMask from '$lib/images/borders/flags-body-mask.png'
    import flagsBandMask from '$lib/images/borders/flags-band-mask.png'

    const gameSession = getGameSession()
    let { playerId }: { playerId: string } = $props()

    let baseColor = $derived(gameSession.colors.getPlayerUiColor(playerId))
</script>

<!-- Same fill-mask + line-art compositing as PlayerState's tintedIcon, but with two
     masked fills instead of one - the flags' main field takes the player's color, and
     the thin trim between the outer/inner outline takes a darker shade of it, while
     the pole/gems/outline/cross art (already colored in the source art) stays on top
     unchanged. -->
<div class="relative w-full" style="aspect-ratio: 2042 / 260;">
    <div
        class="absolute inset-0"
        style="
            background-color: {baseColor};
            mask-image: url({flagsBodyMask}); mask-size: 100% 100%; mask-repeat: no-repeat;
            -webkit-mask-image: url({flagsBodyMask}); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat;
        "
    ></div>
    <div
        class="absolute inset-0"
        style="
            background-color: color-mix(in srgb, {baseColor} 65%, black);
            mask-image: url({flagsBandMask}); mask-size: 100% 100%; mask-repeat: no-repeat;
            -webkit-mask-image: url({flagsBandMask}); -webkit-mask-size: 100% 100%; -webkit-mask-repeat: no-repeat;
        "
    ></div>
    <img src={flagsLines} alt="" class="absolute inset-0 w-full h-full object-contain" />
</div>
