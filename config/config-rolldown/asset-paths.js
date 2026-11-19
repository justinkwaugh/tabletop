export const gameUiPublicAssetsPath = ({ gameId, uiVersion, assetBaseUrl = '' }) =>
    `${assetBaseUrl}/games/${gameId}/ui/${uiVersion}/assets/`
