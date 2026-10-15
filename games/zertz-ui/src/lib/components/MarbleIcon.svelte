<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'

    let {
        color,
        size = 18,
        faded = false
    }: { color: MarbleColor; size?: number; faded?: boolean } = $props()
</script>

<span
    class="marble marble-{color} inline-block shrink-0 rounded-full"
    class:faded
    style:width="{size}px"
    style:height="{size}px"
></span>

<style>
    .marble {
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
    }

    .marble-white {
        background: radial-gradient(circle at 32% 30%, #ffffff 0%, #ece8df 45%, #b9b2a3 100%);
    }

    .marble-grey {
        background: radial-gradient(circle at 32% 30%, #d6d9db 0%, #8e9497 45%, #4f5558 100%);
    }

    .marble-black {
        background: radial-gradient(circle at 32% 30%, #6c7275 0%, #25292b 45%, #070808 100%);
    }

    .faded {
        opacity: 0.18;
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.5);
    }
</style>
