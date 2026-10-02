<script lang="ts">
    import {
        FountainRimFilterId,
        FountainTrimFilterId,
        FountainWaterFilterId,
        FountainWaterShadeId
    } from '$lib/utils/fountainShape.js'
</script>

<filter id={FountainWaterFilterId} x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="8"></feTurbulence>
    <feColorMatrix
        type="matrix"
        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 -0.35"
        result="glints"
    ></feColorMatrix>
    <feComposite in="glints" in2="SourceAlpha" operator="in" result="waterGlints"></feComposite>
    <feMerge>
        <feMergeNode in="SourceGraphic"></feMergeNode>
        <feMergeNode in="waterGlints"></feMergeNode>
    </feMerge>
</filter>
<filter id={FountainRimFilterId} x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="height"></feGaussianBlur>
    <feDiffuseLighting
        in="height"
        surfaceScale="2.2"
        diffuseConstant="1.05"
        lighting-color="#ffffff"
        result="light"
    >
        <feDistantLight azimuth="225" elevation="50"></feDistantLight>
    </feDiffuseLighting>
    <feComposite in="light" in2="SourceAlpha" operator="in" result="rimLight"></feComposite>
    <feBlend in="SourceGraphic" in2="rimLight" mode="multiply" result="carved"></feBlend>
    <feDropShadow
        in="carved"
        dx="1.5"
        dy="2.5"
        stdDeviation="1.6"
        flood-color="#3a2a14"
        flood-opacity="0.4"
    ></feDropShadow>
</filter>
<filter id={FountainTrimFilterId} x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" flood-color="#3a2a14" flood-opacity="0.4"
    ></feDropShadow>
</filter>
<radialGradient id={FountainWaterShadeId} cx="50%" cy="50%" r="55%">
    <stop offset="0" stop-color="#a9d6e6"></stop>
    <stop offset="1" stop-color="#5f9fba"></stop>
</radialGradient>
