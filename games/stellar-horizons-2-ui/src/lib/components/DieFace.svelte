<script lang="ts">
    // A ten-sided die with the face that came up towards the viewer, point up. The
    // game rolls a red die for exploration and black percentile dice for malfunctions.
    let {
        face,
        color,
        size = 42,
        label
    }: {
        face: string
        color: 'red' | 'black'
        size?: number
        label: string
    } = $props()

    const clipId = $props.id()
    const BODY =
        'M42.8 8.4 Q50 1.5 57.2 8.4 Q77 24.1 93.4 43 Q97 46.5 97 51.5 L97 52.5 Q97 57.5 93.2 60.8 Q76.8 77.8 57.5 91.9 Q50 98.5 42.5 91.9 Q23.2 77.8 6.8 60.8 Q3 57.5 3 52.5 L3 51.5 Q3 46.5 6.6 43 Q23 24.1 42.8 8.4 Z'
    const FRONT = '50,6.5 79.5,55 50,70.5 20.5,55'
</script>

<svg
    class="die {color}"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    role="img"
    aria-label={label}
>
    <title>{label}</title>
    <clipPath id={clipId}><path d={BODY}></path></clipPath>
    <!-- The faces run past the body, which clips them to its rounded shape. -->
    <g clip-path="url(#{clipId})">
        <polygon class="upper" points="50,6.5 50,-10 110,-10 110,59.4 79.5,55"></polygon>
        <polygon class="upper left" points="50,6.5 20.5,55 -10,59.4 -10,-10 50,-10"></polygon>
        <polygon class="lower left" points="20.5,55 50,70.5 50,110 -10,110 -10,59.4"></polygon>
        <polygon class="lower" points="79.5,55 110,59.4 110,110 50,110 50,70.5"></polygon>
        <polygon class="front" points={FRONT}></polygon>
        <polygon class="bevel" points={FRONT}></polygon>
    </g>
    <path class="rim" d={BODY}></path>
    <text x="50" y="42" class:wide={face.length > 1}>{face}</text>
</svg>

<style>
    .die {
        display: block;
        flex-shrink: 0;
    }

    .bevel {
        fill: none;
        stroke-width: 1.2;
        stroke-linejoin: round;
        opacity: 0.55;
    }

    .rim {
        fill: none;
        stroke-width: 3.2;
        stroke-linejoin: round;
    }

    text {
        font-size: 36px;
        font-weight: 800;
        text-anchor: middle;
        dominant-baseline: central;
        fill: #ffffff;
    }

    text.wide {
        font-size: 26px;
    }

    .red .front {
        fill: #f03633;
    }

    .red .upper {
        fill: #c4272a;
    }

    .red .upper.left {
        fill: #b82427;
    }

    .red .lower {
        fill: #9c1a1c;
    }

    .red .lower.left {
        fill: #8f171a;
    }

    .red .bevel {
        stroke: #ff7a70;
    }

    .red .rim {
        stroke: #1a0606;
    }

    .black .front {
        fill: #4b515d;
    }

    .black .upper {
        fill: #363b46;
    }

    .black .upper.left {
        fill: #30353f;
    }

    .black .lower {
        fill: #22262d;
    }

    .black .lower.left {
        fill: #1c1f25;
    }

    .black .bevel {
        stroke: #8a93a5;
    }

    .black .rim {
        stroke: #05060a;
    }
</style>
