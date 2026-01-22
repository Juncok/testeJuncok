
import React from 'react';
import './Hero.css';

const Hero = ({ movie, onPlay }) => {
    if (!movie) return null;

    const parseDurationToSeconds = (dur) => {
        if (!dur) return 0;
        if (typeof dur === 'number') return dur;
        let totalSeconds = 0;
        const hoursMatch = dur.match(/(\d+)h/);
        const minsMatch = dur.match(/(\d+)m/);
        const onlyMins = dur.match(/(\d+)\s*min/i);

        if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
        if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60;
        if (!hoursMatch && !minsMatch && onlyMins) totalSeconds += parseInt(onlyMins[1]) * 60;
        if (totalSeconds === 0 && !isNaN(dur)) totalSeconds = parseInt(dur) * 60;
        return totalSeconds;
    };

    const durationInSeconds = parseDurationToSeconds(movie.duration);
    const progressPercent = (movie.initial_progress && durationInSeconds)
        ? Math.min((movie.initial_progress / durationInSeconds) * 100, 100)
        : 0;

    // Standardized Rule: Hide progress if < 1% or < 30s
    const shouldShowProgress = progressPercent >= 1 && movie.initial_progress > 30;

    return (
        <div className="hero">
            <div className="hero-background">
                <img
                    src={movie.backdrop_image || movie.poster_image}
                    alt={movie.title}
                />
                <div className="hero-gradient"></div>
            </div>

            <div className="hero-content">
                {movie.logo_url ? (
                    <img src={movie.logo_url} alt={movie.title} className="hero-logo" />
                ) : (
                    <h1 className="hero-title">{movie.title}</h1>
                )}

                <p className="hero-description">
                    {movie.description}
                </p>

                {shouldShowProgress && (
                    <div className="hero-progress-wrapper">
                        <div className="hero-progress-container">
                            <div className="hero-progress-bar" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="hero-progress-text">{Math.floor(progressPercent)}% assistido</span>
                    </div>
                )}

                <div className="hero-buttons">
                    <button className="btn btn-primary" onClick={() => onPlay(movie)}>
                        <svg className="icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                        {shouldShowProgress ? 'Retomar' : 'Assistir'}
                    </button>
                    {shouldShowProgress && (
                        <button className="btn btn-secondary" onClick={() => onPlay({ ...movie, initial_progress: 0 })}>
                            Do Início
                        </button>
                    )}
                </div>

                <div className="hero-meta">
                    <span className="match-score">{movie.match || 98}% Relevante</span>
                    <span className="year">{movie.year}</span>
                    <span className="rating-tag">{movie.rating || 'L'}</span>
                    <span className="duration">{movie.duration}</span>
                </div>
            </div>
        </div>
    );
};

export default Hero;
