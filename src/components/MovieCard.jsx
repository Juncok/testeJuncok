
import React, { useState } from 'react';
import './MovieCard.css';

const MovieCard = ({ movie, onClick, disableHover = false, onPlay, onToggleFavorite }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Map DB fields to Component expectations
    const displayImage = movie.backdrop_image || movie.cover_image || movie.image;
    const displayTitle = movie.title;
    const displayAge = movie.rating || movie.age;
    const displayDuration = movie.duration;
    const displayMatch = movie.match || 98;

    // Trailer handling - Mock or Real
    // If movie.trailer exists, use it. Otherwise, fallback or null.
    // For demo purposes, let's look for a trailer property.
    const trailerUrl = movie.trailer_url || movie.trailer;

    // Extract Video ID from YouTube URL (Simple Regex)
    const getYouTubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeId(trailerUrl);


    const genresList = typeof movie.genre === 'string'
        ? movie.genre.split(',').map(g => g.trim())
        : (movie.genres || []);

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

    const durationInSeconds = parseDurationToSeconds(displayDuration);
    const progressPercent = (movie.initial_progress && durationInSeconds)
        ? Math.min((movie.initial_progress / durationInSeconds) * 100, 100)
        : 0;

    // Standardized Rule: Hide progress if < 1% or < 30s
    const shouldShowProgress = progressPercent >= 1 && movie.initial_progress > 30;

    const handleMouseEnter = () => {
        if (disableHover) return;
        const timeout = setTimeout(() => {
            setIsHovered(true);
        }, 600); // 600ms delay before expanding
        setHoverTimeout(timeout);
    };

    const handleMouseMove = (e) => {
        if (isHovered) return;
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5; // Max 5 deg tilt
        const rotateY = ((x - centerX) / centerX) * 5;

        card.style.setProperty('--rotateX', `${rotateX}deg`);
        card.style.setProperty('--rotateY', `${rotateY}deg`);
    };

    const handleMouseLeave = (e) => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        setIsHovered(false);
        e.currentTarget.style.setProperty('--rotateX', '0deg');
        e.currentTarget.style.setProperty('--rotateY', '0deg');
    };

    return (
        <div
            className={`movie-card ${isHovered ? 'hovered' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onClick={onClick}
        >
            <img src={displayImage} alt={displayTitle} loading="lazy" />

            {!isHovered && !isMobile && (
                <div className="card-static-title-wrapper">
                    {movie.logo_url ? (
                        <img src={movie.logo_url} alt={displayTitle} className="card-logo" />
                    ) : (
                        <span className="card-static-title">{displayTitle}</span>
                    )}
                </div>
            )}

            {/* Overlay for Mobile or Top 10 Hover */}
            <div className="movie-card-overlay">
                <div className="mobile-title-gradient"></div>
                <div className="overlay-content">
                    <span className="overlay-title">{displayTitle}</span>
                    <div className="overlay-meta">
                        <span className="overlay-match">{displayMatch}% Match</span>
                        <span className="overlay-year">{movie.year}</span>
                        <span className="overlay-rating">{displayAge}</span>
                    </div>
                </div>
                {shouldShowProgress && (
                    <div className="overlay-progress-container">
                        <div className="overlay-progress-bar" style={{ width: `${progressPercent}%` }} />
                    </div>
                )}
            </div>

            {isHovered && (
                <div className="movie-card-info">
                    <div className="movie-card-image-wrapper">
                        {/* Video Preview if available, otherwise Image */}
                        {videoId ? (
                            <div className="video-preview-wrapper">
                                <iframe
                                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${videoId}&showinfo=0&rel=0&iv_load_policy=3&fs=0`}
                                    title={displayTitle}
                                    frameBorder="0"
                                    allow="autoplay; encrypted-media"
                                    aria-hidden="true"
                                ></iframe>
                            </div>
                        ) : (
                            <img src={displayImage} alt={displayTitle} />
                        )}

                        {/* Show progress bar even if video is playing */}
                        {shouldShowProgress && (
                            <div className="card-progress-container">
                                <div
                                    className="card-progress-bar"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="movie-details">
                        <div className="movie-actions">
                            {/* Restored Title as per previous design preference */}
                            <h3 className="movie-title-hover">{displayTitle}</h3>
                            <button
                                className="btn-icon play"
                                title="Play"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onPlay) onPlay(movie);
                                }}
                            >
                                ▶
                            </button>
                            <button
                                className={`btn-icon ${movie.isFavorite ? 'favorite' : ''}`}
                                title={movie.isFavorite ? "Remover da Lista" : "Adicionar à Lista"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleFavorite) onToggleFavorite(movie);
                                }}
                            >
                                {movie.isFavorite ? '✓' : '+'}
                            </button>
                            {/* Removed Like button and Arrow down */}
                        </div>

                        <div className="movie-meta">
                            <span className="match">{displayMatch}% Match</span>
                            <span className="year">{movie.year}</span>
                            <span className="age">{displayAge}</span>
                            <span className="duration">{displayDuration}</span>
                            <span className="quality">HD</span>
                        </div>

                        <div className="movie-genres">
                            <ul>
                                {genresList.slice(0, 3).map((genre, index) => (
                                    <li key={index}>{genre}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MovieCard;
