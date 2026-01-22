import React from 'react';
import MovieCard from './MovieCard';
import './FavoritesModal.css';

const FavoritesModal = ({ movies, onClose, onMovieClick }) => {
    return (
        <div className="favorites-overlay" onClick={onClose}>
            <div className="favorites-modal" onClick={e => e.stopPropagation()}>
                <div className="favorites-header">
                    <h2>Minha Lista</h2>
                    <button className="close-favorites" onClick={onClose}>&times;</button>
                </div>

                {movies.length === 0 ? (
                    <div className="empty-favorites">
                        <p>Você ainda não tem itens salvos na sua lista.</p>
                    </div>
                ) : (
                    <div className="favorites-grid">
                        {movies.map(movie => (
                            <MovieCard
                                key={movie.id}
                                movie={movie}
                                onClick={() => {
                                    onMovieClick(movie);
                                    onClose();
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FavoritesModal;
