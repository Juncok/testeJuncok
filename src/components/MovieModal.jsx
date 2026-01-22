import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import MovieCard from './MovieCard';
import './MovieModal.css';

const MovieModal = ({ movie, onClose, onPlay, onMovieClick, allMedia }) => {
    const [isFavorite, setIsFavorite] = useState(false);
    const [loadingFav, setLoadingFav] = useState(false);
    const [similarMovies, setSimilarMovies] = useState([]);

    useEffect(() => {
        if (movie) {
            checkIfFavorite();
            fetchSimilarMovies();
        }
    }, [movie]);

    const checkIfFavorite = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('media_id', movie.id)
            .maybeSingle();

        setIsFavorite(!!data);
    };

    const toggleFavorite = async () => {
        setLoadingFav(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Você precisa estar logado para salvar favoritos.');
            setLoadingFav(false);
            return;
        }

        if (isFavorite) {
            await supabase
                .from('favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('media_id', movie.id);
            setIsFavorite(false);
        } else {
            await supabase
                .from('favorites')
                .insert([{ user_id: user.id, media_id: movie.id }]);
            setIsFavorite(true);
        }
        setLoadingFav(false);
    };

    const fetchSimilarMovies = async () => {
        if (!movie.genre || !allMedia) return;
        const mainGenre = movie.genre.split(',')[0].trim();

        // Filter locally from allMedia which already has progress injected
        const similar = allMedia
            .filter(m =>
                m.id !== movie.id &&
                m.genre?.toLowerCase().includes(mainGenre.toLowerCase())
            )
            .slice(0, 6);

        setSimilarMovies(similar);
    };

    if (!movie) return null;

    const backdropUrl = movie.backdrop_image || movie.image;

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

    // NOTE: This logic is duplicated from MovieCard.Ideally should be a helper utility.
    const durationInSeconds = parseDurationToSeconds(movie.duration);
    const progressPercent = (movie.initial_progress && durationInSeconds)
        ? Math.min((movie.initial_progress / durationInSeconds) * 100, 100)
        : 0;

    // Standardized Rule: Hide progress if < 1% or < 30s
    const shouldShowProgress = progressPercent >= 1 && movie.initial_progress > 30;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                <div className="modal-hero">
                    <div className="modal-backdrop">
                        <img src={backdropUrl} alt={movie.title} />
                        <div className="modal-gradient"></div>
                    </div>

                    <div className="modal-info">
                        {movie.logo_url ? (
                            <img src={movie.logo_url} alt={movie.title} className="modal-logo" />
                        ) : (
                            <h2 className="modal-title">{movie.title}</h2>
                        )}

                        {/* Progress Bar in Modal */}
                        {shouldShowProgress && (
                            <div className="modal-progress-wrapper">
                                <div className="modal-progress-track">
                                    <div className="modal-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                                <span className="modal-progress-text">
                                    {Math.floor(progressPercent)}% assistido
                                </span>
                            </div>
                        )}

                        <div className="modal-meta-row">
                            <span className="match">{movie.match || 98}% Match</span>
                            <span className="year">{movie.year}</span>
                            <span className="age">{movie.rating || '12+'}</span>
                            <span className="duration">{movie.duration}</span>
                            <span className="genre">{movie.genre}</span>
                        </div>

                        <div className="modal-buttons">
                            <button className="btn-play" onClick={() => onPlay(movie)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5 3l14 9-14 9V3z" />
                                </svg>
                                {shouldShowProgress ? 'Retomar' : 'Assistir'}
                            </button>
                            {shouldShowProgress && (
                                <button className="btn-restart" onClick={() => onPlay({ ...movie, initial_progress: 0 })}>
                                    Do Início
                                </button>
                            )}
                            <button
                                className={`btn-add ${isFavorite ? 'is-favorite' : ''}`}
                                onClick={toggleFavorite}
                                disabled={loadingFav}
                            >
                                {isFavorite ? (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        Minha Lista
                                    </>
                                ) : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        Minha Lista
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="modal-description-grid">
                            <div className="description-col">
                                <p className="description-text">{movie.description}</p>
                            </div>
                            <div className="details-col">
                                {movie.cast && <p><span className="label">Elenco:</span> {movie.cast}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Similar Titles Section */}
                {similarMovies.length > 0 && (
                    <div className="modal-similar-section">
                        <h3>Títulos Semelhantes</h3>
                        <div className="similar-grid">
                            {similarMovies.map(similar => (
                                <MovieCard
                                    key={similar.id}
                                    movie={similar}
                                    onClick={() => onMovieClick(similar)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MovieModal;
