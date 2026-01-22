
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import ProfileModal from './ProfileModal';
import './Navbar.css';
import logo from '../assets/logo.png';

const Navbar = ({ activeFilter, setActiveFilter, searchQuery, setSearchQuery, session, onShowFavorites, genres, newMedia, onMovieClick, hasUnseenNotifications, onNotifOpen }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showGenres, setShowGenres] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Refs for click-outside logic
  // Refs for click-outside logic
  const profileRef = useRef(null);
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const genresRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Update scrolled state (background change)
      if (currentScrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      // Smart Navbar Logic: Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 150) {
        // Scrolling down and not at the top
        setIsVisible(false);
      } else {
        // Scrolling up or at the top
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Click Outside logic - Robust for iOS
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Profile menu
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      // Search box - only if it's visible and not empty (to avoid accidental recoil while typing)
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        if (!searchQuery) {
          setIsSearchVisible(false);
        }
      }
      // Notifications
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      // Genres dropdown
      if (genresRef.current && !genresRef.current.contains(event.target)) {
        setShowGenres(false);
      }
    };

    // Use mousedown for desktop and touchend for mobile (iOS especially)
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside); // Critical for iOS

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [searchQuery]);

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''} ${!isVisible ? 'hidden' : ''}`}>
      <div className="navbar-container">
        <div className="profile-menu" ref={profileRef}>
          <img
            src={session?.user?.user_metadata?.avatar_url || 'https://api.dicebear.com/9.x/adventurer/svg?seed=Felix'}
            alt="Perfil"
            className="nav-avatar"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setIsSearchVisible(false);
              setShowGenres(false);
              setShowNotifications(false);
            }}
          />
          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-info-header">
                <span className="profile-name">
                  {session?.user?.user_metadata?.full_name || 'Usuário'}
                </span>
                <span className="profile-email-sub">{session?.user?.email}</span>
              </div>
              <button onClick={() => { setShowProfileEdit(true); setShowProfileMenu(false); }}>Editar Perfil</button>
              <button onClick={() => { onShowFavorites(); setShowProfileMenu(false); }}>Minha Lista</button>
              <button onClick={async () => {
                console.log('Navbar: User clicked Sign Out');
                const { error } = await supabase.auth.signOut();
                if (error) console.error('SignOut error:', error);

                // Nuclear Option: Manually clear Supabase storage keys
                for (let key of Object.keys(localStorage)) {
                  if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                  }
                  if (key === 'supabase.auth.token') localStorage.removeItem(key);
                }

                // Force a hard reload to clear all state if the listener fails
                window.location.reload();
              }}>Sair</button>
            </div>
          )}
        </div>

        {showProfileEdit && (
          <ProfileModal
            session={session}
            onClose={() => setShowProfileEdit(false)}
            onUpdate={() => {
              window.location.reload();
            }}
          />
        )}

        <ul className="navbar-links">
          <li>
            <button
              className={activeFilter === 'all' && !searchQuery ? 'active' : ''}
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
                setIsSearchVisible(false);
                setShowGenres(false);
                setShowNotifications(false);
              }}
            >
              Início
            </button>
          </li>
          <li className={`navbar-dropdown-container ${showGenres ? 'open' : ''}`} ref={genresRef}>
            <button className="navbar-dropdown-trigger" onClick={() => {
              setShowGenres(!showGenres);
              setIsSearchVisible(false);
              setShowProfileMenu(false);
              setShowNotifications(false);
            }}>
              <span>Explorar</span> <span className="arrow">▾</span>
            </button>
            {showGenres && (
              <div className="navbar-dropdown-menu">
                <div className="dropdown-grid">
                  {/* Fixed Exploration Links */}
                  <button
                    className="explore-item-highlight"
                    onClick={() => { onShowFavorites(); setShowGenres(false); }}
                  >
                    Minha Lista
                  </button>
                  <button
                    className="explore-item-highlight"
                    onClick={() => { setActiveFilter('new'); setShowGenres(false); setSearchQuery(''); }}
                  >
                    Novidades
                  </button>

                  <div className="dropdown-divider"></div>

                  {genres?.map(genre => (
                    <button
                      key={genre}
                      onClick={() => { setSearchQuery(genre); setShowGenres(false); setActiveFilter('all'); }}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
        </ul>

        <div className="navbar-right">
          <div className={`search-box ${isSearchVisible ? 'visible' : ''}`} ref={searchRef}>
            <div className="search-icon" onClick={() => setIsSearchVisible(!isSearchVisible)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Títulos, pessoas, gêneros"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              onBlur={() => { if (!searchQuery) setIsSearchVisible(false); }}
              autoFocus={isSearchVisible}
            />
          </div>

          <div className="navbar-notifications" ref={notificationRef}>
            <button
              className="notification-btn"
              title="Novidades"
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) onNotifOpen();
                setIsSearchVisible(false);
                setShowGenres(false);
                setShowProfileMenu(false);
              }}
            /* onBlur removed to use global click listener */
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {hasUnseenNotifications && <span className="notification-badge"></span>}
            </button>
            {showNotifications && (
              <div className="notifications-dropdown">
                <h3 className="notif-title">Novidades</h3>
                <div className="notif-list">
                  {newMedia?.length > 0 ? (
                    newMedia.map(item => (
                      <div
                        key={item.id}
                        className="notif-item"
                        onClick={() => {
                          onMovieClick(item);
                          setShowNotifications(false);
                        }}
                      >
                        <img src={item.backdrop_image || item.poster_image} alt="" />
                        <div className="notif-info">
                          <span className="notif-name">{item.title}</span>
                          <span className="notif-meta">Adicionado recentemente</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="notif-empty">Nenhuma novidade no momento</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
