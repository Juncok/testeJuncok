const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

export const movieService = {
    // Search for movies or series
    search: async (query, type = 'movie') => {
        try {
            if (type === 'movie' || type === 'both') {
                const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${OMDB_API_KEY}`);
                const data = await response.json();
                return data.Search || [];
            } else {
                // TVMaze for series (more specialized)
                const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                return data.map(item => ({
                    Title: item.show.name,
                    Year: item.show.premiered ? item.show.premiered.split('-')[0] : '',
                    imdbID: item.show.externals.imdb,
                    Type: 'series',
                    Poster: item.show.image ? item.show.image.medium : '',
                    tvmazeId: item.show.id
                }));
            }
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    },

    // Get full details by ID
    getDetails: async (id, type = 'movie') => {
        try {
            if (type === 'movie') {
                const response = await fetch(`https://www.omdbapi.com/?i=${id}&plot=full&apikey=${OMDB_API_KEY}`);
                const data = await response.json();
                return {
                    title: data.Title,
                    description: data.Plot,
                    year: data.Year,
                    poster: data.Poster,
                    genre: data.Genre,
                    rating: data.Rated,
                    duration: data.Runtime,
                    type: 'movie'
                };
            } else {
                // TVMaze details
                const response = await fetch(`https://api.tvmaze.com/shows/${id}`);
                const data = await response.json();
                return {
                    title: data.name,
                    description: data.summary ? data.summary.replace(/<[^>]*>?/gm, '') : '',
                    year: data.premiered ? data.premiered.split('-')[0] : '',
                    poster: data.image ? data.image.original : '',
                    genre: data.genres.join(', '),
                    rating: 'L', // TVMaze rating is complex, default to L
                    duration: data.averageRuntime ? `${data.averageRuntime}m` : '',
                    type: 'series'
                };
            }
        } catch (error) {
            console.error('Details error:', error);
            return null;
        }
    }
};
