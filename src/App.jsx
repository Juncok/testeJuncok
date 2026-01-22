import React, { useEffect, useState, useCallback } from 'react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Hero from './components/Hero';
import SectionRow from './components/SectionRow';
import Top10Row from './components/Top10Row';
import AdminPanel from './components/AdminPanel';
import MovieModal from './components/MovieModal';
import FavoritesModal from './components/FavoritesModal';
import { HeroSkeleton, RowSkeleton } from './components/Skeleton';
import VideoPlayer from './components/VideoPlayer';
import SearchResults from './components/SearchResults';
import { supabase } from './supabaseClient';
import BrandHubs from './components/BrandHubs';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { App as CapApp } from '@capacitor/app';
import './index.css';

function App() {
  const [heroMovie, setHeroMovie] = useState(null);
  const [novidades, setNovidades] = useState([]);
  const [filmes, setFilmes] = useState([]);
  const [series, setSeries] = useState([]);
  const [animes, setAnimes] = useState([]);
  const [minhaLista, setMinhaLista] = useState([]);
  const [continueAssistindo, setContinueAssistindo] = useState([]);
  const [recomendados, setRecomendados] = useState([]);
  const [generosDinamicos, setGenerosDinamicos] = useState({}); // { 'Ação': [...], 'Terror': [...] }
  const [top10List, setTop10List] = useState([]);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [allMedia, setAllMedia] = useState([]); // All items for global search
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isPlaying, setIsPlaying] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMedia, setNewMedia] = useState([]);
  const [lastSeenNotif, setLastSeenNotif] = useState(0);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    console.log('App: Auth lifecycle started');

    // Add native platform class for styling
    if (Capacitor.isNativePlatform()) {
      document.body.classList.add('is-native');

      // Set Status Bar Style (Light icons on dark background)
      StatusBar.setStyle({ style: Style.Dark }).catch(err => console.warn('StatusBar not available', err));

      // Lock orientation to portrait by default
      ScreenOrientation.lock({ orientation: 'portrait' }).catch(err => console.warn('Orientation lock failed', err));
    } else {
      document.body.classList.remove('is-native');
    }

    // Heartbeat to monitor session health (Reduced frequency to save requests)
    const heartbeat = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.warn('App Heartbeat: NO session found!');
        } else {
          const expiresAt = new Date(session.expires_at * 1000).toLocaleTimeString();
          console.log(`App Heartbeat: Session OK. Expires: ${expiresAt}`);
        }
      });
    }, 15 * 60 * 1000); // 15 minutes instead of 5

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`App Auth [${timestamp}]: Event=${event}, Session=${newSession ? 'Found' : 'Null'}`);

      // Helper for skeptical verification
      const verifySessionRobustly = async (retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
          console.log(`App Auth [${timestamp}]: Skeptical Check ${i + 1}/${retries}...`);
          const { data: { session: verified }, error } = await supabase.auth.getSession();
          if (verified) return verified;
          if (error) console.error(`App Auth [${timestamp}]: Verification error:`, error);
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
        return null;
      };

      if (newSession) {
        setSession(prev => {
          if (prev?.access_token === newSession.access_token && prev?.user?.id === newSession.user.id) {
            return prev;
          }
          return newSession;
        });
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSelectedMovie(null);
        setIsPlaying(null);
        setShowAdmin(false);
        setShowFavorites(false);
        setSearchQuery('');
        setActiveFilter('all');
        setSession(null);
        setAuthLoading(false);
        localStorage.removeItem(`supabase.auth.token`);
      } else {
        // Skeptical initial check
        if (event === 'INITIAL_SESSION') {
          await new Promise(r => setTimeout(r, 1000));
        }

        const confirmedSession = await verifySessionRobustly(2, 500);

        if (confirmedSession) {
          setSession(confirmedSession);
          setAuthLoading(false);
        } else {
          setSelectedMovie(null);
          setIsPlaying(null);
          setShowAdmin(false);
          setShowFavorites(false);
          setSearchQuery('');
          setActiveFilter('all');
          setSession(null);
          setAuthLoading(false);
        }
      }
    });

    // Fallback: Check session once if listener is slow
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setAuthLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(heartbeat);
    };
  }, []);

  const fetchData = async (silent = false) => {
    if (!session?.user?.id) {
      console.log('App: fetchData skipped - no session user ID');
      return;
    }

    try {
      if (!silent) setLoading(true);
      console.log('App: Starting fetchData for user:', session.user.id);

      const fetchResults = await Promise.all([
        supabase.from('media').select('*').eq('is_featured', true),
        supabase.from('media').select('*').eq('main_group', 'Filmes').limit(30),
        supabase.from('media').select('*').eq('main_group', 'Séries').limit(30),
        supabase.from('media').select('*').eq('main_group', 'Animes').limit(30),
        supabase.from('media').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('favorites').select('media_id, media(*)').eq('user_id', session.user.id),
        supabase.from('user_progress').select('media_id, progress_seconds, updated_at, media(*)').eq('user_id', session.user.id).order('updated_at', { ascending: false }),
        supabase.from('media').select('*').eq('is_top10', true).order('created_at', { ascending: false })
      ]);

      // Check for errors in any of the parallel requests
      fetchResults.forEach((res, index) => {
        if (res.error) {
          console.error(`App: fetchData error in request #${index}:`, res.error);
          if (res.error.status === 429) {
            console.error('App: RATE LIMIT (429) detected!');
          }
        }
      });

      const [featured, movies, shows, anims, all, favs, progress, top10] = fetchResults.map(r => r.data);

      if (progress) {
        console.log(`App: Progress data found for ${progress.length} items.`);
        if (progress.length > 0) {
          console.log('App: Latest progress entry:', progress[0]);
        }
      } else {
        console.warn('App: Progress data is NULL/Empty');
      }

      if (!all) {
        console.warn('App: "all" media data is empty, some UI might be broken');
      }

      const progressMap = {};
      progress?.forEach(p => {
        progressMap[p.media_id] = p.progress_seconds;
      });

      const favSet = new Set(favs?.map(f => f.media_id) || []);

      const injectMetadata = (list) => list?.map(m => ({
        ...m,
        initial_progress: progressMap[m.id] || 0,
        isFavorite: favSet.has(m.id)
      })) || [];

      const allWithProgress = injectMetadata(all);

      // 0. Check for new content (last 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const newItems = allWithProgress.filter(m => {
        const createdAt = new Date(m.created_at.replace(' ', 'T')).getTime();
        return createdAt > sevenDaysAgo;
      });
      setNewMedia(newItems);

      // 1. Calculate Intelligent Recommendations (Based on viewed genres)
      const genreCounts = {};
      progress?.forEach(p => {
        const gList = p.media?.genre?.split(',').map(g => g.trim()) || [];
        gList.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      });

      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(entry => entry[0]);

      const recs = allWithProgress.filter(m => {
        const gList = m.genre?.split(',').map(g => g.trim()) || [];
        return topGenres.some(tg => gList.includes(tg)) && !progressMap[m.id];
      }).slice(0, 10);

      // 2. Discover Dynamic Genres (Top 4 most frequent in DB)
      const allGenreCounts = {};
      all?.forEach(m => {
        const gList = m.genre?.split(',').map(g => g.trim()) || [];
        gList.forEach(g => {
          allGenreCounts[g] = (allGenreCounts[g] || 0) + 1;
        });
      });

      const topDiscoveryGenres = Object.entries(allGenreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);

      const dynamicRows = {};
      topDiscoveryGenres.forEach(genre => {
        dynamicRows[genre] = allWithProgress.filter(m =>
          m.genre?.split(',').map(g => g.trim()).includes(genre)
        ).slice(0, 15);
      });

      setGenerosDinamicos(dynamicRows);

      // 3. Collect ALL unique genres for Explore Menu
      const uniqueGenres = [...new Set(all?.flatMap(m =>
        m.genre?.split(',').map(g => g.trim()) || []
      ))].filter(Boolean).sort();
      setTodasCategorias(uniqueGenres);

      setNovidades(allWithProgress.slice(0, 20)); // Novidades = 20 most recent
      setTop10List(injectMetadata(top10));
      setFilmes(injectMetadata(movies));
      setSeries(injectMetadata(shows));
      setAnimes(injectMetadata(anims));
      setAllMedia(allWithProgress);
      setMinhaLista(injectMetadata(favs?.map(f => f.media)));
      setRecomendados(recs);
      setGenerosDinamicos(dynamicRows);

      // Random Hero Selection Logic
      let selectedHero = null;
      if (featured && featured.length > 0) {
        // Option A: Random from manually featured
        const randomIndex = Math.floor(Math.random() * featured.length);
        selectedHero = injectMetadata([featured[randomIndex]])[0];
      } else if (allWithProgress && allWithProgress.length > 0) {
        // Fallback: Random from 10 most recent
        const poolSize = Math.min(allWithProgress.length, 10);
        const randomIndex = Math.floor(Math.random() * poolSize);
        selectedHero = allWithProgress[randomIndex];
      }
      setHeroMovie(selectedHero);

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

      setContinueAssistindo(progress?.filter(p => {
        const durationSecs = parseDurationToSeconds(p.media?.duration);
        if (!durationSecs) return true; // Keep if duration unknown
        const progressRatio = p.progress_seconds / durationSecs;
        // Standardized Rule: At least 1% AND more than 30 seconds to be considered "watched"
        return progressRatio >= 0.01 && p.progress_seconds > 30 && progressRatio < 0.95;
      }).map(p => ({
        ...p.media,
        initial_progress: p.progress_seconds,
        resume_time: true
      })) || []);

      console.log('App: fetchData completed successfully');
      setLoading(false);
    } catch (error) {
      console.error('App: Fatal error in fetchData:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }

    const handleKeyDown = (e) => {
      // Logic for Shift + F3
      if (e.shiftKey && (e.key === 'F3' || e.keyCode === 114)) {
        e.preventDefault();
        setShowAdmin(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session?.user?.id]); // Use a more stable dependency

  // Load last seen notification timestamp
  useEffect(() => {
    if (session?.user?.id) {
      const saved = localStorage.getItem(`lastSeenNotif_${session.user.id}`);
      if (saved) setLastSeenNotif(parseInt(saved));
    }
  }, [session?.user?.id]);

  const handleNotifOpen = useCallback(() => {
    if (newMedia.length > 0) {
      // Find the most recent timestamp in the current newMedia list
      const latestTimestamp = Math.max(...newMedia.map(m =>
        new Date(m.created_at.replace(' ', 'T')).getTime()
      ));

      setLastSeenNotif(latestTimestamp);
      if (session?.user?.id) {
        localStorage.setItem(`lastSeenNotif_${session.user.id}`, latestTimestamp.toString());
      }
    } else {
      // Fallback if list is empty, though unlikely to matter
      const now = Date.now();
      setLastSeenNotif(now);
      if (session?.user?.id) {
        localStorage.setItem(`lastSeenNotif_${session.user.id}`, now.toString());
      }
    }
  }, [session?.user?.id, newMedia]);

  // Refresh data when closing player to update progress bars
  useEffect(() => {
    if (!isPlaying && session?.user?.id) {
      console.log('App: Player closed, refreshing content to update progress...');
      fetchData(true);
    }
  }, [isPlaying, session?.user?.id]);

  // Handle Mobile Back Button (Push state when modal opens, listen for popstate)
  useEffect(() => {
    const isModalOpen = selectedMovie || showFavorites || isPlaying;

    if (isModalOpen) {
      window.history.pushState({ modalOpen: true }, '');
    }

    const handlePopState = (e) => {
      if (selectedMovie) {
        setSelectedMovie(null);
      } else if (showFavorites) {
        setShowFavorites(false);
      } else if (isPlaying) {
        setIsPlaying(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedMovie, showFavorites, isPlaying]);

  // Handle Native Android Back Button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      // Check if any modal/overlay is open
      if (selectedMovie || showFavorites || isPlaying || showAdmin) {
        if (selectedMovie) setSelectedMovie(null);
        if (showFavorites) setShowFavorites(false);
        if (isPlaying) setIsPlaying(null);
        if (showAdmin) setShowAdmin(false);
      } else if (!canGoBack) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });

    return () => {
      backButtonListener.then(l => l.remove());
    };
  }, [selectedMovie, showFavorites, isPlaying, showAdmin]);

  const handlePlayerClose = useCallback(() => {
    setIsPlaying(false);
    fetchData(true); // Silent refresh
  }, []);

  const handleRecommendClick = useCallback((movie) => {
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlaying(movie);
    }, 500);
  }, []);

  const handleToggleFavorite = useCallback(async (movie) => {
    if (!session?.user) return;
    const user = session.user;

    // Optimistic UI Update
    const updateLocalList = (list) => list.map(m => {
      if (m.id === movie.id) {
        return { ...m, isFavorite: !m.isFavorite };
      }
      return m;
    });

    // Update all lists where this movie might appear
    setNovidades(prev => updateLocalList(prev));
    setFilmes(prev => updateLocalList(prev));
    setSeries(prev => updateLocalList(prev));
    setAnimes(prev => updateLocalList(prev));
    setContinueAssistindo(prev => updateLocalList(prev));
    setRecomendados(prev => updateLocalList(prev));
    setTop10List(prev => updateLocalList(prev));
    setAllMedia(prev => updateLocalList(prev));
    setNewMedia(prev => updateLocalList(prev));

    // Update Dynamic Genres
    setGenerosDinamicos(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = updateLocalList(next[key]);
      });
      return next;
    });

    if (movie.isFavorite) {
      // Remove
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('media_id', movie.id);
      setMinhaLista(prev => prev.filter(m => m.id !== movie.id));
    } else {
      // Add
      await supabase.from('favorites').insert([{ user_id: user.id, media_id: movie.id }]);
      setMinhaLista(prev => [...prev, { ...movie, isFavorite: true }]);
    }
  }, [session]);

  if (authLoading) {
    return (
      <div className="auth-loader-screen">
        <div className="loader"></div>

      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="App">
      <Navbar
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        session={session}
        onShowFavorites={() => setShowFavorites(true)}
        genres={todasCategorias}
        newMedia={newMedia}
        onMovieClick={setSelectedMovie}
        hasUnseenNotifications={newMedia.some(m => {
          const createdAt = new Date(m.created_at.replace(' ', 'T')).getTime();
          return createdAt > lastSeenNotif;
        })}
        onNotifOpen={handleNotifOpen}
      />
      {!searchQuery && (
        loading ? <HeroSkeleton /> : (
          <Hero
            movie={heroMovie}
            onPlay={(movie) => setIsPlaying(movie)}
          />
        )
      )}

      {!searchQuery && !loading && (
        <BrandHubs
          activeFilter={activeFilter}
          onFilterChange={(filter) => {
            if (filter === 'mylist') {
              setShowFavorites(true);
            } else {
              setActiveFilter(filter);
              // Smooth scroll to content only on Desktop (innerWidth > 768)
              if (window.innerWidth > 768) {
                window.scrollTo({ top: window.innerHeight * 0.7, behavior: 'smooth' });
              }
            }
          }} />
      )}

      <div className="content-container">
        {loading ? (
          <div className="content-rows">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : (
          <>
            {searchQuery ? (
              <SearchResults
                results={allMedia.filter(m =>
                  (m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (m.genre && m.genre.toLowerCase().includes(searchQuery.toLowerCase()))) &&
                  (activeFilter === 'all' ||
                    (activeFilter === 'movies' && m.main_group === 'Filmes') ||
                    (activeFilter === 'series' && m.main_group === 'Séries'))
                )}
                onMovieClick={setSelectedMovie}
                onPlay={(movie) => setIsPlaying(movie)}
                onToggleFavorite={handleToggleFavorite}
                searchQuery={searchQuery}
              />
            ) : (
              <div className="content-rows">
                {continueAssistindo.length > 0 && activeFilter === 'all' && (
                  <SectionRow
                    title="Continue Assistindo"
                    movies={continueAssistindo}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                {recomendados.length > 0 && activeFilter === 'all' && (
                  <SectionRow
                    title="Recomendados para Você"
                    movies={recomendados}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                {(activeFilter === 'all' || activeFilter === 'new') && (
                  <SectionRow
                    title="Novidades"
                    movies={novidades}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                {(activeFilter === 'all') && top10List.length > 0 && (
                  <Top10Row movies={top10List} onMovieClick={setSelectedMovie} />
                )}
                {(activeFilter === 'all' || activeFilter === 'movies') && (
                  <SectionRow
                    title="Filmes"
                    movies={filmes}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                {activeFilter === 'all' && Object.entries(generosDinamicos).map(([genre, movies]) => (
                  <SectionRow
                    key={genre}
                    title={genre}
                    movies={movies}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
                {(activeFilter === 'all' || activeFilter === 'series') && (
                  <SectionRow
                    title="Séries"
                    movies={series}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
                {(activeFilter === 'all' || activeFilter === 'animes') && animes.length > 0 && (
                  <SectionRow
                    title="Animes"
                    movies={animes}
                    onMovieClick={setSelectedMovie}
                    onPlay={(movie) => setIsPlaying(movie)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {
        showAdmin && (
          <AdminPanel
            onClose={() => {
              setShowAdmin(false);
              fetchData(); // Refresh data to show new Top 10/Changes
            }}
            session={session}
          />
        )
      }

      {/* Movie Details Modal */}
      {
        selectedMovie && (
          <MovieModal
            movie={selectedMovie}
            onClose={() => {
              setSelectedMovie(null);
              fetchData(true); // Silent refresh
            }}
            onPlay={(movie) => {
              setSelectedMovie(null);
              setIsPlaying(movie);
            }}
            onMovieClick={setSelectedMovie}
            allMedia={allMedia}
          />
        )
      }

      {/* Favorites Modal */}
      {
        showFavorites && (
          <div className="favorites-modal-placeholder">
            {/* Will implement FavoritesModal tomorrow oops next step */}
            <FavoritesModal
              movies={minhaLista}
              onClose={() => setShowFavorites(false)}
              onMovieClick={setSelectedMovie}
            />
          </div>
        )
      }

      {/* Video Player Overlay */}
      {
        isPlaying && (
          <VideoPlayer
            movie={isPlaying}
            session={session}
            onClose={handlePlayerClose}
            onRecommendClick={handleRecommendClick}
          />
        )
      }

      <footer style={{ padding: '50px', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
        <p>&copy; 2026 Juncok Streams. All rights reserved.</p>
      </footer>
    </div >
  );
}

export default App;
