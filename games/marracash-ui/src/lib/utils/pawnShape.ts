export const PawnUnitSize = 18
export const PawnHeight = 25.9
const BaseHalfWidth = 7
export const PawnWidth = 2 * BaseHalfWidth
const NeckHalfWidth = 2.4
const BaseCurve = 0.8
const BaseBulge = 1.4
const FlareReach = 0.45

export const PawnClipId = 'marracash-pawn-clip'
export const PawnBodyShadeId = 'marracash-pawn-body-shade'
export const PawnHeadShadeId = 'marracash-pawn-head-shade'
export const PawnNeckShadeId = 'marracash-pawn-neck-shade'
export const PawnFootShadeId = 'marracash-pawn-foot-shade'
export const PawnGroundShadowId = 'marracash-pawn-ground-shadow'

export const PawnHeadRadius = 5
export const PawnBaseY = PawnHeight / 2

const headToNeck = Math.sqrt(PawnHeadRadius ** 2 - NeckHalfWidth ** 2)
export const PawnNeckY = -PawnBaseY + PawnHeadRadius + headToNeck
export const PawnHeadCenterY = PawnNeckY - headToNeck

function pawnOutline(): string {
    const footY = PawnBaseY - BaseCurve
    const flare = (footY - PawnNeckY) * FlareReach
    return [
        `M ${-BaseHalfWidth} ${footY}`,
        `C ${-BaseHalfWidth + 0.4} ${footY - flare} ${-NeckHalfWidth} ${PawnNeckY + flare} ${-NeckHalfWidth} ${PawnNeckY}`,
        `A ${PawnHeadRadius} ${PawnHeadRadius} 0 1 1 ${NeckHalfWidth} ${PawnNeckY}`,
        `C ${NeckHalfWidth} ${PawnNeckY + flare} ${BaseHalfWidth - 0.4} ${footY - flare} ${BaseHalfWidth} ${footY}`,
        `Q 0 ${PawnBaseY + BaseBulge} ${-BaseHalfWidth} ${footY} Z`
    ].join(' ')
}

export const PawnOutline = pawnOutline()

export const HistoryPawnHeight = 20
