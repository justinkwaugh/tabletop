import {
    KindPalette,
    LocomotiveKind,
    locomotiveData,
    type LocomotiveId
} from '@tabletop/locomotive-werks'

// The colour-blind palette takes the Okabe–Ito colours, which stay apart under the common forms
// of colour blindness, and every kind also gets its own shape.
export const KIND_COLORS: Record<KindPalette, Record<LocomotiveKind, string>> = {
    [KindPalette.Standard]: {
        [LocomotiveKind.Passenger]: '#72be62',
        [LocomotiveKind.Fast]: '#e15d68',
        [LocomotiveKind.Freight]: '#e3c232',
        [LocomotiveKind.Special]: '#84b8c5'
    },
    [KindPalette.ColorBlind]: {
        [LocomotiveKind.Passenger]: '#009e73',
        [LocomotiveKind.Fast]: '#d55e00',
        [LocomotiveKind.Freight]: '#f0e442',
        [LocomotiveKind.Special]: '#56b4e9'
    }
}

// The darker shade the kind's text and outlines use on the paper.
export const KIND_INKS: Record<KindPalette, Record<LocomotiveKind, string>> = {
    [KindPalette.Standard]: {
        [LocomotiveKind.Passenger]: '#2f6f2a',
        [LocomotiveKind.Fast]: '#9c2632',
        [LocomotiveKind.Freight]: '#7d6406',
        [LocomotiveKind.Special]: '#2e6676'
    },
    [KindPalette.ColorBlind]: {
        [LocomotiveKind.Passenger]: '#00664a',
        [LocomotiveKind.Fast]: '#8f3c00',
        [LocomotiveKind.Freight]: '#6b6400',
        [LocomotiveKind.Special]: '#1f5f86'
    }
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']

export function locomotiveName(locomotiveId: LocomotiveId): string {
    const locomotive = locomotiveData(locomotiveId)
    return `${locomotive.kind} ${ROMAN[locomotive.generation]}`
}

export function kindOf(locomotiveId: LocomotiveId): LocomotiveKind {
    return locomotiveData(locomotiveId).kind
}

export function kindColor(locomotiveId: LocomotiveId, palette: KindPalette): string {
    return KIND_COLORS[palette][kindOf(locomotiveId)]
}

export function kindInk(locomotiveId: LocomotiveId, palette: KindPalette): string {
    return KIND_INKS[palette][kindOf(locomotiveId)]
}
