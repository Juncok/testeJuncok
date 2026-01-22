import React from 'react';
import './Skeleton.css';

export const HeroSkeleton = () => (
    <div className="skeleton-hero">
        <div className="skeleton-content">
            <div className="skeleton-title"></div>
            <div className="skeleton-text"></div>
            <div className="skeleton-text short"></div>
            <div className="skeleton-button"></div>
        </div>
    </div>
);

export const CardSkeleton = () => (
    <div className="skeleton-card">
        <div className="skeleton-image"></div>
    </div>
);

export const RowSkeleton = () => (
    <div className="skeleton-row">
        <div className="skeleton-row-title"></div>
        <div className="skeleton-row-cards">
            {[1, 2, 3, 4, 5, 6].map(i => <CardSkeleton key={i} />)}
        </div>
    </div>
);
