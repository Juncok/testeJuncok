
import React from 'react';
import MovieCard from './MovieCard';
import './SearchResults.css';

const SearchResults = ({ results, onMovieClick, searchQuery, onPlay, onToggleFavorite }) => {
    if (results.length === 0) {
        return (
            <div className="no-results">
                <h2>Nenhum resultado encontrado para: <span className="query-highlight">"{searchQuery}"</span></h2>
                <p>Tente palavras-chave diferentes ou nomes de gêneros.</p>
            </div>
        );
    }

    return (
        <div className="search-results-page">
            <h2 className="search-title">Resultados da busca: <span className="query-highlight">"{searchQuery}"</span></h2>
            <div className="search-grid">
                {results.map((movie) => (
                    <MovieCard
                        key={movie.id}
                        movie={movie}
                        onClick={() => onMovieClick(movie)}
                        onPlay={onPlay ? () => onPlay(movie) : undefined}
                        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(movie) : undefined}
                    />
                ))}
            </div>
        </div>
    );
};

export default SearchResults;
