import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

const LightInk = '#ffffff'
const DarkInk = '#1b1b1b'

// The art plan's seat colours: kept apart from the railroad colours and amber, one value in both
// themes, each with the initials ink its fill takes by contrast. Teal is the platform's Green, and
// the platform's White is drawn lime, which reads on the paper cards where white would not.
export const RideTheRailsSeatPalette: PlayerColorPalette = {
    [Color.Green]: { fill: '#15736e', text: LightInk, contrast: LightInk },
    [Color.Pink]: { fill: '#f2a0d6', text: DarkInk, contrast: DarkInk },
    [Color.White]: { fill: '#94c43a', text: DarkInk, contrast: DarkInk },
    [Color.Brown]: { fill: '#6e4126', text: LightInk, contrast: LightInk },
    [Color.Gray]: { fill: '#8c939b', text: DarkInk, contrast: DarkInk }
}
