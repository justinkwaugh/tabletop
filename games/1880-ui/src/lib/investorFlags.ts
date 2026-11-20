import { svgDataUrl } from '@tabletop/18xx-ui'

/** Each foreign investor's country's flag, drawn on a 40-unit square (§VII). */
const Flags: Readonly<Record<string, string>> = {
    // Russia
    A1: '<rect width="40" height="13.4" fill="#fff"/><rect y="13.3" width="40" height="13.4" fill="#0039a6"/><rect y="26.6" width="40" height="13.4" fill="#d52b1e"/>',
    // Japan
    A2: '<rect width="40" height="40" fill="#fff"/><circle cx="20" cy="17" r="8" fill="#bc002d"/>',
    // Belgium
    A3: '<rect width="13.4" height="40" fill="#1a1a1a"/><rect x="13.3" width="13.4" height="40" fill="#fdda24"/><rect x="26.6" width="13.4" height="40" fill="#ef3340"/>',
    // Germany
    A4: '<rect width="40" height="13.4" fill="#1a1a1a"/><rect y="13.3" width="40" height="13.4" fill="#dd0000"/><rect y="26.6" width="40" height="13.4" fill="#ffce00"/>',
    // The United Kingdom
    A5: '<rect width="40" height="40" fill="#012169"/><path d="M0 0 40 40M40 0 0 40" stroke="#fff" stroke-width="7"/><path d="M0 0 40 40M40 0 0 40" stroke="#c8102e" stroke-width="2.4"/><path d="M20 0V40M0 20H40" stroke="#fff" stroke-width="11"/><path d="M20 0V40M0 20H40" stroke="#c8102e" stroke-width="6.5"/>',
    // Portugal
    A6: '<rect width="40" height="40" fill="#da291c"/><rect width="16" height="40" fill="#046a38"/><circle cx="16" cy="17" r="6.5" fill="#ffe900"/><path d="M12.6 13.2h6.8v5.6a3.4 3.4 0 0 1-6.8 0z" fill="#fff" stroke="#da291c" stroke-width="1.4"/>',
    // France
    A7: '<rect width="13.4" height="40" fill="#002654"/><rect x="13.3" width="13.4" height="40" fill="#fff"/><rect x="26.6" width="13.4" height="40" fill="#ce1126"/>'
}

/** The flag in a white-rimmed disc, with the investor's number at its foot where given. */
function flagDisc(investorId: string, number?: string): string {
    const numberBadge = number
        ? `<circle cx="20" cy="31.5" r="6" fill="#fff" stroke="#3a3a3a" stroke-width="0.8"/><text x="20" y="34.6" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="700" fill="#2a2a2a">${number}</text>`
        : ''
    return svgDataUrl(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><clipPath id="disc"><circle cx="20" cy="20" r="19"/></clipPath><g clip-path="url(#disc)">${Flags[investorId] ?? ''}</g><circle cx="20" cy="20" r="19" fill="none" stroke="#fff" stroke-width="1.6"/>${numberBadge}</svg>`
    )
}

/** An investor's token: its flag, numbered as its charter. */
export function investorToken(investorId: string): string {
    return flagDisc(investorId, investorId.slice(1))
}

/** An investor's flag alone, for a badge on its company's token. */
export function investorFlag(investorId: string): string {
    return flagDisc(investorId)
}
