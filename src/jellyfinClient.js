/**
 * Simple Jellyfin client to fetch media data
 */
const JELLYFIN_URL = import.meta.env.VITE_JELLYFIN_URL;
const JELLYFIN_API_KEY = import.meta.env.VITE_JELLYFIN_API_KEY;

export const fetchLatestMedia = async () => {
    try {
        console.log('Fetching from Jellyfin:', JELLYFIN_URL);

        let items = [];

        // 1. Fetch Views (Libraries)
        const viewsResponse = await fetch(`${JELLYFIN_URL}/Items`, {
            headers: { 'Accept': 'application/json', 'X-Emby-Token': JELLYFIN_API_KEY }
        });

        if (!viewsResponse.ok) throw new Error(`Jellyfin API error: ${viewsResponse.status}`);

        const viewsData = await viewsResponse.json();

        // Filter valid libraries (include plain Folders which might have undefined CollectionType)
        const views = (viewsData.Items || []).filter(v => {
            const type = v.Type;
            const collectionType = v.CollectionType?.toLowerCase();
            return (
                type === 'CollectionFolder' ||
                type === 'Folder' ||
                type === 'UserView' ||
                ['movies', 'tvshows'].includes(collectionType)
            );
        });

        console.log(`Found ${views.length} libraries to scan:`, views.map(v => v.Name));

        // 2. Fetch items from each view
        for (const view of views) {
            // Fetch items from specific library
            const libResponse = await fetch(
                `${JELLYFIN_URL}/Items?ParentId=${view.Id}&IncludeItemTypes=Movie,Series&Limit=100&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Fields=PrimaryImageTag,BackdropImageTags,Overview,ProductionYear,RunTimeTicks,Genres,OfficialRating,MediaSources,MediaStreams`,
                { headers: { 'Accept': 'application/json', 'X-Emby-Token': JELLYFIN_API_KEY } }
            );
            const libData = await libResponse.json();

            if (libData.Items) {
                // Determine items to add, avoiding duplicates
                const newItems = libData.Items.filter(newItem => !items.some(existing => existing.Id === newItem.Id));
                items = [...items, ...newItems];
            }
        }

        // 3. Sort merged results by DateCreated desc
        items.sort((a, b) => {
            const dateA = new Date(a.DateCreated || 0);
            const dateB = new Date(b.DateCreated || 0);
            return dateB - dateA;
        });

        console.log(`Jellyfin items found: ${items.length}`);
        return items;
    } catch (error) {
        console.error('Error fetching from Jellyfin:', error);
        return [];
    }
};

export const getImageUrl = (itemId, tag) => {
    if (!tag) return null;
    return `${JELLYFIN_URL}/Items/${itemId}/Images/Primary?fillHeight=320&fillWidth=213&tag=${tag}&quality=90&api_key=${JELLYFIN_API_KEY}`;
};

export const getBackdropUrl = (itemId, tag) => {
    if (!tag) return null;
    return `${JELLYFIN_URL}/Items/${itemId}/Images/Backdrop?fillHeight=720&tag=${tag}&quality=90&api_key=${JELLYFIN_API_KEY}`;
};

export const getStreamUrl = (itemId) => {
    // Removed Static=true to allow transcoding if needed (Universal fallback)
    return `${JELLYFIN_URL}/Videos/${itemId}/stream.mp4?api_key=${JELLYFIN_API_KEY}`;
};

export const getDownloadUrl = (itemId) => {
    // Direct file delivery (bypass transcoding entirely)
    return `${JELLYFIN_URL}/Items/${itemId}/Download?api_key=${JELLYFIN_API_KEY}`;
};

export const getSubtitleUrl = (itemId, subtitleIndex, mediaSourceId) => {
    // If mediaSourceId is not provided, use itemId as fallback (some servers allow this, but mediaSourceId is preferred)
    const sourceId = mediaSourceId || itemId;
    return `${JELLYFIN_URL}/Videos/${itemId}/${sourceId}/Subtitles/${subtitleIndex}/Stream.vtt?api_key=${JELLYFIN_API_KEY}`;
};

export const fetchItemDetails = async (itemId) => {
    try {
        console.log(`Fetching full details for item: ${itemId}`);
        const response = await fetch(
            `${JELLYFIN_URL}/Items/${itemId}?Fields=PrimaryImageTag,BackdropImageTags,Overview,ProductionYear,RunTimeTicks,Genres,OfficialRating,MediaSources,MediaStreams,Chapters,Path&validation_param=${Date.now()}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Emby-Token': JELLYFIN_API_KEY
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Jellyfin API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching item details:', error);
        return null;
    }
};
