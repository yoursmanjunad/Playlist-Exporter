
export function normalizeTrack(track) {
    // return the normalized string of the track.
    const normalizedTitle = track.title
        ?.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const normalizedArtists = (track.artists || [])
        .map(artist =>
            artist
                ?.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s]/g, "")
                .replace(/\s+/g, " ")
                .trim()
        );
    
    const normalizedAlbum = track.album 
        ?.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return {
        title: normalizedTitle,
        artists: normalizedArtists,
        album: normalizedAlbum
    }
} 