
import React, { useRef } from 'react';
import './SectionRow.css';
import MovieCard from './MovieCard';

const SectionRow = ({ title, movies, onMovieClick, onPlay, onToggleFavorite }) => {
    const rowRef = useRef(null);

    const scrollLeft = () => {
        if (rowRef.current) {
            rowRef.current.scrollBy({ left: -window.innerWidth / 2, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (rowRef.current) {
            rowRef.current.scrollBy({ left: window.innerWidth / 2, behavior: 'smooth' });
        }
    };

    return (
        <div className="section-row">
            <h2 className="section-title">{title}</h2>

            <div className="row-wrapper">
                <button className="handle handle-left" onClick={scrollLeft}>
                    <span className="arrow">‹</span>
                </button>

                <div className="row-items" ref={rowRef}>
                    {movies.map((movie) => (
                        <MovieCard
                            key={movie.id}
                            movie={movie}
                            onClick={() => onMovieClick(movie)}
                            onPlay={onPlay ? () => onPlay(movie) : undefined}
                            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(movie) : undefined}
                        />
                    ))}
                </div>

                <button className="handle handle-right" onClick={scrollRight}>
                    <span className="arrow">›</span>
                </button>
            </div>
        </div>
    );
};

export default SectionRow;
