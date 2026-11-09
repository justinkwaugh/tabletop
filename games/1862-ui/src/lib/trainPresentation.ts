import type { Band } from '@tabletop/1862'
import { Bands, TrainKinds, trainDefinitionId } from '@tabletop/1862'

// Each band takes the colour of the tiles its phase brings (§9), deepening band by band, so a
// train's band reads from its badge: its name gives only its reach.
export const PhaseColors1862: Readonly<Record<Band, string>> = {
    A: '#ffdf00',
    B: '#8ccf8c',
    C: '#4fa66f',
    D: '#d9a074',
    E: '#c48659',
    F: '#a96c44',
    G: '#8d5737',
    H: '#6e432b'
}

export const TrainColors1862: Readonly<Record<string, string>> = Object.fromEntries(
    Bands.flatMap((band) =>
        TrainKinds.map((kind) => [trainDefinitionId(band, kind), PhaseColors1862[band]])
    )
)
