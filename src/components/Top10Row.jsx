import React, { useRef } from 'react';
import MovieCard from './MovieCard';
import './Top10Row.css';

const Top10Row = ({ movies, onMovieClick }) => {
    const rowRef = useRef(null);

    // Only take top 10
    const top10 = movies.slice(0, 10);

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

    if (top10.length === 0) return null;

    return (
        <div className="top10-row">
            <h2 className="section-title">Top 10 Indicados</h2>

            <div className="row-wrapper">
                <button className="handle handle-left" onClick={scrollLeft}>
                    <span className="arrow">‹</span>
                </button>

                <div className="top10-scroll-container" ref={rowRef}>
                    {top10.map((movie, index) => (
                        <div className="top10-item" key={movie.id}>
                            <div className="big-number">
                                <span className="rank-text">{(index + 1).toString().padStart(2, '0')}</span>
                            </div>
                            {/* Force MovieCard to use poster_image by overriding backdrop_image in the prop */}
                            <MovieCard
                                movie={{
                                    ...movie,
                                    backdrop_image: movie.poster_image || movie.backdrop_image
                                }}
                                onClick={() => onMovieClick(movie)}
                                disableHover={true}
                            />
                        </div>
                    ))}
                </div>

                <button className="handle handle-right" onClick={scrollRight}>
                    <span className="arrow">›</span>
                </button>
            </div>
        </div>
    );
};

export default Top10Row;
