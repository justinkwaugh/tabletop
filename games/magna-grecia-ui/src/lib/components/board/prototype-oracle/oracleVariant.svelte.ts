// PROTOTYPE, throwaway: which oracle style the board draws. Set from the console or the
// prototype gallery: window.setOracleVariant('C').
export type OracleVariant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'

export const ORACLE_VARIANT_NAMES: Record<OracleVariant, string> = {
    A: 'Current',
    B: 'Clear tile',
    C: 'Clear & open',
    D: 'Sanctuary',
    E: 'Tholos',
    F: 'Sanctuary 2',
    G: 'Sanctuary 3 · marble',
    H: 'Sanctuary 3 · bronze',
    I: 'Marble, brighter'
}

export const oracleVariant = $state({ value: 'A' as OracleVariant })

if (typeof window !== 'undefined') {
    ;(window as unknown as { setOracleVariant: (v: OracleVariant) => void }).setOracleVariant = (
        v
    ) => {
        oracleVariant.value = v
    }
}
