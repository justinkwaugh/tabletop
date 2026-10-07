<script lang="ts">
    import {
        PawnBaseY,
        PawnBodyShadeId,
        PawnBrimShadowId,
        PawnBrimY,
        PawnClipId,
        PawnFootShadeId,
        PawnGroundShadowId,
        PawnHatShadeId,
        PawnOutline,
        PawnTopY,
        PawnWaistShadeId,
        PawnWaistY
    } from '$lib/utils/pawnShape.js'
</script>

<clipPath id={PawnClipId}>
    <path d={PawnOutline}></path>
</clipPath>
<linearGradient id={PawnBodyShadeId} gradientUnits="userSpaceOnUse" x1="-7" y1="0" x2="7" y2="0">
    <stop offset="0" stop-color="#000000" stop-opacity="0.12"></stop>
    <stop offset="0.28" stop-color="#ffffff" stop-opacity="0.38"></stop>
    <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"></stop>
    <stop offset="1" stop-color="#000000" stop-opacity="0.38"></stop>
</linearGradient>
<radialGradient
    id={PawnHatShadeId}
    gradientUnits="userSpaceOnUse"
    cx="-2"
    cy={PawnTopY + 3.6}
    r="7"
    fx="-2.2"
    fy={PawnTopY + 3.2}
>
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"></stop>
    <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.08"></stop>
    <stop offset="1" stop-color="#000000" stop-opacity="0.2"></stop>
</radialGradient>
<linearGradient
    id={PawnBrimShadowId}
    gradientUnits="userSpaceOnUse"
    x1="0"
    y1={PawnBrimY}
    x2="0"
    y2={PawnBrimY + 2.6}
>
    <stop offset="0" stop-color="#000000" stop-opacity="0.38"></stop>
    <stop offset="1" stop-color="#000000" stop-opacity="0"></stop>
</linearGradient>
<linearGradient
    id={PawnWaistShadeId}
    gradientUnits="userSpaceOnUse"
    x1="0"
    y1={PawnWaistY - 1.2}
    x2="0"
    y2={PawnWaistY + 1.6}
>
    <stop offset="0" stop-color="#000000" stop-opacity="0"></stop>
    <stop offset="0.45" stop-color="#000000" stop-opacity="0.2"></stop>
    <stop offset="1" stop-color="#000000" stop-opacity="0"></stop>
</linearGradient>
<linearGradient
    id={PawnFootShadeId}
    gradientUnits="userSpaceOnUse"
    x1="0"
    y1={PawnBaseY - 3}
    x2="0"
    y2={PawnBaseY + 1.4}
>
    <stop offset="0" stop-color="#000000" stop-opacity="0"></stop>
    <stop offset="1" stop-color="#000000" stop-opacity="0.22"></stop>
</linearGradient>
<radialGradient id={PawnGroundShadowId}>
    <stop offset="0" stop-color="#2a1c10" stop-opacity="0.4"></stop>
    <stop offset="1" stop-color="#2a1c10" stop-opacity="0"></stop>
</radialGradient>
