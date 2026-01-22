import React from 'react';
import './BrandHubs.css';

const getAssetUrl = (filename) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/assets/${filename}`;
};

const hubs = [
    {
        id: 'novidades',
        label: 'NOVIDADES',
        filter: 'new',
        video: getAssetUrl('hub-novidades.mp4'),
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
            </svg>
        )
    },
    {
        id: 'filmes',
        label: 'FILMES',
        filter: 'movies',
        video: getAssetUrl('hub-filmes.mp4'),
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
            </svg>
        )
    },
    {
        id: 'series',
        label: 'SÉRIES',
        filter: 'series',
        video: getAssetUrl('hub-series.mp4'),
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
            </svg>
        )
    },
    {
        id: 'animes',
        label: 'ANIMES',
        filter: 'animes',
        video: getAssetUrl('hub-animes.mp4'),
        icon: (
            <svg viewBox="0 0 100 100" fill="currentColor">
                <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="80" fontWeight="bold" fontFamily="serif">愛</text>
            </svg>
        )
    },
    {
        id: 'mylist',
        label: 'MINHA LISTA',
        filter: 'mylist',
        video: getAssetUrl('hub-mylist.mp4'),
        icon: (
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
        )
    }
];

const BrandHubs = ({ onFilterChange, activeFilter }) => {
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        if (!containerRef.current) return;

        const tiles = containerRef.current.querySelectorAll('.brand-tile');
        tiles.forEach(tile => {
            const video = tile.querySelector('video');
            const hubFilter = tile.getAttribute('data-filter');

            if (video) {
                if (hubFilter === activeFilter) {
                    video.play().catch(() => { });
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    }, [activeFilter]);

    return (
        <div className="brand-hubs" ref={containerRef}>
            <div className="brand-hubs-container">
                {hubs.map((hub) => (
                    <div
                        key={hub.id}
                        data-filter={hub.filter}
                        className={`brand-tile ${activeFilter === hub.filter ? 'active' : ''}`}
                        onClick={() => onFilterChange(hub.filter)}
                        onMouseEnter={(e) => {
                            // On desktop, we still want hover behavior for non-active items
                            const video = e.currentTarget.querySelector('video');
                            if (video && activeFilter !== hub.filter) {
                                video.play().catch(() => { });
                            }
                        }}
                        onMouseLeave={(e) => {
                            const video = e.currentTarget.querySelector('video');
                            if (video && activeFilter !== hub.filter) {
                                video.pause();
                                video.currentTime = 0;
                            }
                        }}
                    >
                        <div className="tile-background">
                            <video
                                src={hub.video}
                                loop
                                muted
                                playsInline
                                preload="auto"
                            />
                        </div>
                        <div className="tile-content">
                            <span className="hub-icon">{hub.icon}</span>
                            <span className="hub-label">{hub.label}</span>
                        </div>
                        <div className="tile-glow"></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrandHubs;
