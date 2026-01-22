import React, { useRef, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import './VideoPlayer.css';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonicChromecast } from 'ionic-chromecast';

const VideoPlayer = ({ movie, onClose, onRecommendClick, session }) => {
    // Force Direct Play for Jellyfin URLs to fix duration/progress issues
    const finalVideoUrl = React.useMemo(() => {
        if (movie && movie.video_url && movie.video_url.includes('/Videos/') && !movie.video_url.includes('Static=true')) {
            const separator = movie.video_url.includes('?') ? '&' : '?';
            return `${movie.video_url}${separator}Static=true`;
        }
        return movie?.video_url || '';
    }, [movie]);

    // ... refs and state ...
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [overlayAction, setOverlayAction] = useState(null); // 'play', 'pause', 'rewind', 'forward'
    const [isPlaying, setIsPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState('00:00');
    const [duration, setDuration] = useState('00:00');
    const [showControls, setShowControls] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [brightness, setBrightness] = useState(100);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isLocked, setIsLocked] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
    const [activeSubtitle, setActiveSubtitle] = useState('off');
    const [subtitleSize, setSubtitleSize] = useState('medium'); // 'small', 'medium', 'large', 'xl'
    const [showNextEpisode, setShowNextEpisode] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true); // Start buffering
    const [videoError, setVideoError] = useState(null);
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPosition, setHoverPosition] = useState(0);
    const clickTimeout = useRef(null);
    const controlsTimeout = useRef(null);
    const hasInitialSought = useRef(false);
    const [isCastAvailable, setIsCastAvailable] = useState(false);

    useEffect(() => {
        // Load saved volume
        const savedVolume = localStorage.getItem('juncok-player-volume');
        if (savedVolume !== null) {
            const v = parseFloat(savedVolume);
            setVolume(v);
            if (videoRef.current) videoRef.current.volume = v;
        }

        if (videoRef.current) {
            // Initial seek attempt
            if (movie.initial_progress && !hasInitialSought.current) {
                console.log(`VideoPlayer: Initial seek to ${movie.initial_progress}s`);
                videoRef.current.currentTime = movie.initial_progress;
                hasInitialSought.current = true;
            }

            videoRef.current.play().catch(error => {
                console.log("Autoplay prevented:", error);
                setIsPlaying(false);
            });
        }
    }, [movie.initial_progress]);

    // Keyboard Event Listener
    useEffect(() => {
        // Native Platform Logic (Capacitor)
        if (Capacitor.isNativePlatform()) {
            const setLandscape = async () => {
                try {
                    await ScreenOrientation.lock({ orientation: 'landscape' });
                    await StatusBar.hide();
                } catch (err) {
                    console.warn('Native orientation/statusbar control failed:', err);
                }
            };
            setLandscape();

            return () => {
                // Restoration on cleanup
                const restorePortrait = async () => {
                    try {
                        await ScreenOrientation.lock({ orientation: 'portrait' });
                        await StatusBar.show();
                        await StatusBar.setStyle({ style: Style.Dark });
                    } catch (err) {
                        console.warn('Native restoration failed:', err);
                    }
                };
                restorePortrait();
            };
        }

        // Fallback: Web Force Landscape on Mobile (Browser)
        const lockOrientationWeb = async () => {
            if (screen.orientation && screen.orientation.lock) {
                try {
                    await screen.orientation.lock('landscape');
                    console.log('VideoPlayer: Orientation locked to landscape');
                } catch (err) {
                    console.warn('VideoPlayer: Orientation lock failed (not supported or ignored):', err);
                }
            };
        };

        // Only run web lock if NOT native (redundant check but safe)
        if (!Capacitor.isNativePlatform()) {
            lockOrientationWeb();
        }
    }, [movie]);

    // ... rest of effect ...


    // Chromecast Initialization (Hybrid: Native Plugin + Web SDK)
    useEffect(() => {
        let nativeListener = null;

        const initializeHybridCast = async () => {
            if (Capacitor.isNativePlatform()) {
                console.log("VideoPlayer: Initializing Native Cast (ionic-chromecast)...");
                try {
                    // 1. Initialize Plugin with CAF Receiver (CastVideos-CAF for better compatibility)
                    const initResult = await IonicChromecast.initialize({
                        receiverApplicationId: '4F8B3483'
                    });
                    console.log("VideoPlayer: Native Init Result:", initResult);

                    // 2. Setup Discovery Listeners (Dynamic)
                    await IonicChromecast.addListener('deviceAvailable', () => {
                        console.log("VideoPlayer: Native Event - Device Available!");
                        setIsCastAvailable(true);
                    });

                    await IonicChromecast.addListener('deviceUnavailable', () => {
                        console.log("VideoPlayer: Native Event - Device Unavailable");
                        setIsCastAvailable(false);
                    });

                    // 3. Initial Check
                    const { available } = await IonicChromecast.areDevicesAvailable();
                    setIsCastAvailable(available);
                    console.log(`VideoPlayer: Initial device check: ${available}`);

                    // 4. Listen for session start
                    nativeListener = await IonicChromecast.addListener('sessionStarted', async () => {
                        console.log("VideoPlayer: Native Cast Session Started. Loading media...");
                        loadMediaOnNativeCast();
                    });

                } catch (err) {
                    console.error("VideoPlayer: Native Cast Init Error:", err);
                    alert(`Erro na Inicialização do Cast: ${err.message || 'Erro desconhecido'}`);
                }
            } else {
                // Web SDK Fallback
                window['__onGCastApiAvailable'] = (isAvailable) => {
                    if (isAvailable) {
                        initializeWebCastApi();
                    }
                };
                if (window.cast && window.cast.framework) {
                    initializeWebCastApi();
                }
            }
        };

        const initializeWebCastApi = () => {
            try {
                const castContext = window.cast.framework.CastContext.getInstance();
                castContext.setOptions({
                    receiverApplicationId: window.chrome.cast.media.DEFAULT_RECEIVER_APP_ID,
                    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                });
                castContext.addEventListener(
                    window.cast.framework.CastContextEventType.SESSION_STARTED,
                    () => {
                        loadMediaOnWebCast();
                    }
                );
                setIsCastAvailable(true);
            } catch (err) {
                console.error("VideoPlayer: Web Cast Init Error", err);
            }
        };

        const loadMediaOnWebCast = () => {
            const castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
            if (!castSession) return;

            const mediaInfo = new window.chrome.cast.media.MediaInfo(finalVideoUrl, 'video/mp4');
            mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = movie.title;
            mediaInfo.metadata.subtitle = 'Juncok Streams';
            mediaInfo.metadata.images = [{ url: movie.backdrop_image || movie.image }];

            if (movie.subtitles && movie.subtitles.length > 0) {
                mediaInfo.tracks = movie.subtitles.map((track, index) => {
                    const castTrack = new window.chrome.cast.media.Track(index + 1, window.chrome.cast.media.TrackType.TEXT);
                    castTrack.trackContentId = track.url;
                    castTrack.trackContentType = 'text/vtt';
                    castTrack.subtype = window.chrome.cast.media.TextTrackType.SUBTITLES;
                    castTrack.name = track.label;
                    castTrack.language = track.lang;
                    return castTrack;
                });
            }

            const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
            request.currentTime = videoRef.current ? videoRef.current.currentTime : 0;
            castSession.loadMedia(request).then(
                () => {
                    console.log("VideoPlayer: Web Media Loaded Successfully");
                    setIsPlaying(false);
                },
                (err) => console.error('VideoPlayer: Web Cast Load Error', err)
            );
        };

        const loadMediaOnNativeCast = async () => {
            console.log("VideoPlayer: Preparing Native Cast Payload (Patched for seek)...");
            // Correct Payload for ionic-chromecast (url, images as array of strings)
            // currentTime added for the patched plugin (sent as metadata)
            // Detect MIME type based on extension
            let detectedContentType = 'video/mp4';
            if (finalVideoUrl.includes('.m3u8')) {
                detectedContentType = 'application/x-mpegurl';
            }

            const mediaOptions = {
                url: finalVideoUrl,
                metadata: {
                    title: movie.title,
                    subtitle: 'Juncok Streams',
                    images: [movie.backdrop_image || movie.image],
                    contentType: detectedContentType,
                    currentTime: videoRef.current ? videoRef.current.currentTime : 0
                }
            };

            try {
                console.log("VideoPlayer: Calling IonicChromecast.loadMedia with:", mediaOptions);
                const result = await IonicChromecast.loadMedia(mediaOptions);
                console.log("VideoPlayer: Native Load Media Result:", result);

                if (result && result.success) {
                    if (videoRef.current) videoRef.current.pause();
                    setIsPlaying(false);
                } else if (result) {
                    // Show error to help debugging without Logcat access
                    alert(`Erro no Chromecast: ${result.error || 'Falha ao carregar mídia'}\nStatus Code: ${result.statusCode || 'N/A'}`);
                } else {
                    alert("Erro no Chromecast: O plugin retornou um resultado vazio.");
                }
            } catch (err) {
                console.error("VideoPlayer: Native Load Media Error", err);
                alert(`Erro Fatal no Plugin: ${err.message || 'Erro desconhecido'}\n${JSON.stringify(err)}`);
            }
        };

        initializeHybridCast();

        return () => {
            if (nativeListener) {
                nativeListener.remove();
            }
            if (screen.orientation && screen.orientation.unlock) {
                try {
                    screen.orientation.unlock();
                } catch (e) { }
            }
        };
    }, [movie]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Wake UI on Esc if locked
            if (isLocked) {
                if (e.key === 'Escape') {
                    setShowControls(true);
                    clearTimeout(controlsTimeout.current);
                    controlsTimeout.current = setTimeout(() => {
                        if (isPlaying) setShowControls(false);
                    }, 2000);
                }
                return; // Block ALL other keys if locked
            }

            // Normal logic if NOT locked
            if (e.key === 'Escape') handleClose();
            if (e.key === ' ') {
                e.preventDefault();
                togglePlay();
            }
            if (e.key === 'f') toggleFullscreen();
            if (e.key === 'ArrowRight') handleSeek('forward');
            if (e.key === 'ArrowLeft') handleSeek('rewind');
            if (e.key === 'm') toggleMute();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLocked, isPlaying, isMuted, subtitleSize]);

    // Meta: Progress Cleanup on Unmount
    useEffect(() => {
        return () => {
            if (videoRef.current) {
                saveProgressToServer();
            }
        };
    }, []);

    // Periodic Progress Saving
    useEffect(() => {
        const saveProgressInterval = setInterval(saveProgressToServer, 10000);
        return () => {
            clearInterval(saveProgressInterval);
            saveProgressToServer();
        };
    }, [movie.id, session?.user?.id]); // Re-create interval if movie or user changes

    const handleClose = async () => {
        console.log("VideoPlayer: handleClose triggered.");
        try {
            // Try to save one last time, but don't let it block closing if it hangs
            const savePromise = saveProgressToServer();
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2s
            await Promise.race([savePromise, timeoutPromise]);
        } catch (err) {
            console.error("VideoPlayer: Error during final save in handleClose:", err);
        } finally {
            if (onClose) {
                onClose();
            } else {
                console.error("VideoPlayer: onClose prop is missing!");
            }
        }
    };

    const saveProgressToServer = React.useCallback(async () => {
        if (!videoRef.current || !movie.id || !session?.user) return;
        const user = session.user;

        const currentTimeSecs = videoRef.current.currentTime;
        if (currentTimeSecs < 5) return; // Don't save if it's just the beginning

        const { error } = await supabase.from('user_progress').upsert({
            user_id: user.id,
            media_id: movie.id,
            progress_seconds: currentTimeSecs,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, media_id' });

        if (error) {
            console.error("VideoPlayer: Error saving progress:", error);
        }
    }, [movie.id, session]);

    const formatTime = (time) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Touch Handling for Seek (Mobile)
    const [isDragging, setIsDragging] = useState(false); // Track dragging state

    const handleTouchSeek = (e) => {
        resetControlsTimeout(); // Keep controls open while dragging
        setIsDragging(true); // Mark as dragging

        if (videoRef.current && videoRef.current.duration) {
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.max(0, Math.min(1, x / width));
            const newTime = percentage * videoRef.current.duration;

            // Update UI ONLY (Visual Feedback)
            setProgress(percentage * 100);
            setCurrentTime(formatTime(newTime));

            // Do NOT seek video yet.
        }
    };

    const handleTouchSeekEnd = (e) => {
        setIsDragging(false);
        if (videoRef.current && videoRef.current.duration) {
            // We need to calculate the final position again because changedTouches gives us the lift-off point
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.changedTouches[0];
            const x = touch.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.max(0, Math.min(1, x / width));
            const newTime = percentage * videoRef.current.duration;

            console.log(`VideoPlayer: Commit Seek to ${newTime}s`);
            videoRef.current.currentTime = newTime;

            // Resume playing if it was playing? Or just stay as is.
            // Usually good UX to ensure it's not stuck buffering if paused.
        }
    };

    // Update time update to respect dragging
    const handleTimeUpdate = () => {
        if (videoRef.current && !isDragging) { // Don't fight the user while dragging
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration;
            setProgress((current / total) * 100);
            setCurrentTime(formatTime(current));
            if (!isNaN(total)) setDuration(formatTime(total));

            // Show "Next Episode" 30 seconds before end (Only for Series)
            if (movie.type === 'series' && total - current < 30 && total > 60) {
                setShowNextEpisode(true);
            } else {
                setShowNextEpisode(false);
            }
        }
    };



    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(formatTime(videoRef.current.duration));

            // Seek only if we haven't already
            if (movie.initial_progress && movie.initial_progress > 5 && !hasInitialSought.current) {
                console.log(`VideoPlayer: Seeking to ${movie.initial_progress}s (Metadata Loaded)`);
                videoRef.current.currentTime = movie.initial_progress;
                hasInitialSought.current = true;
            }
        }
    };

    const handleCanPlay = () => {
        // Fallback seek attempt if initial ones failed
        if (videoRef.current && movie.initial_progress && !hasInitialSought.current) {
            console.log(`VideoPlayer: Fallback seeking to ${movie.initial_progress}s (Can Play)`);
            videoRef.current.currentTime = movie.initial_progress;
            hasInitialSought.current = true;
        }
    };

    const showOverlay = (action) => {
        setOverlayAction(action);
        // User requested longer duration (1.2s instead of 0.8s)
        setTimeout(() => setOverlayAction(null), 1200);
    };

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (showRecommendations) {
            setShowRecommendations(false);
            videoRef.current.currentTime = 0;
        }
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
            showOverlay('play');
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
            showOverlay('pause');
        }
    };

    const handleSeek = (direction) => {
        if (videoRef.current) {
            const seekTime = direction === 'forward' ? 10 : -10;
            videoRef.current.currentTime += seekTime;
            showOverlay(direction);
        }
    };

    const handleProgressBarClick = (e) => {
        e.stopPropagation();
        if (videoRef.current && videoRef.current.duration) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const percentage = x / width;
            const newTime = percentage * videoRef.current.duration;
            console.log(`VideoPlayer: Seeking to ${newTime}s`);
            videoRef.current.currentTime = newTime;
        }
    };

    const handleProgressBarMouseMove = (e) => {
        if (videoRef.current && videoRef.current.duration) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.max(0, Math.min(1, x / width));
            const time = percentage * videoRef.current.duration;
            setHoverTime(formatTime(time));
            setHoverPosition(percentage * 100);
        }
    };

    const handleProgressBarMouseLeave = () => {
        setHoverTime(null);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const handleVolumeChange = (e) => {
        resetControlsTimeout(); // Keep controls visible
        const val = parseFloat(e.target.value);
        setVolume(val);
        localStorage.setItem('juncok-player-volume', val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
        }
        setIsMuted(val === 0);
    };

    const toggleMute = () => {
        resetControlsTimeout();
        if (videoRef.current) {
            const newMuted = !isMuted;
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
            if (!newMuted && volume === 0) {
                setVolume(0.5);
                videoRef.current.volume = 0.5;
            }
        }
    };

    const handleBrightnessChange = (e) => {
        resetControlsTimeout(); // Keep controls visible
        setBrightness(parseInt(e.target.value));
    };

    const handleSpeedChange = (speed) => {
        resetControlsTimeout();
        setPlaybackSpeed(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
        setShowSpeedMenu(false);
    };

    const handleSubtitleChange = (lang) => {
        console.log(`VideoPlayer: User requested subtitle change to: ${lang}`);
        setActiveSubtitle(lang);
        setShowSubtitleMenu(false);
    };

    // Robust text track management
    useEffect(() => {
        if (!videoRef.current) return;

        const syncTracks = () => {
            const tracks = videoRef.current.textTracks;
            console.log(`VideoPlayer: Syncing ${tracks.length} tracks with activeSubtitle: ${activeSubtitle}`);

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                const isMatch = (activeSubtitle !== 'off' && (track.language === activeSubtitle || track.label === activeSubtitle));

                if (isMatch) {
                    console.log(`VideoPlayer: Enabling track ${i} (${track.label}) for custom rendering`);
                    // Use 'hidden' mode: it fires events but doesn't show native subtitles
                    track.mode = 'hidden';
                    track.oncuechange = () => {
                        if (track.activeCues && track.activeCues.length > 0) {
                            // Extract text from the current cue
                            // We replace some common VTT tags that might show up
                            const text = track.activeCues[0].text
                                .replace(/<v[^>]*>/g, '')
                                .replace(/<\/v>/g, '')
                                .replace(/\n/g, '<br/>');
                            setCurrentSubtitle(text);
                        } else {
                            setCurrentSubtitle('');
                        }
                    };
                } else {
                    track.mode = 'disabled';
                    track.oncuechange = null;
                }
            }
            if (activeSubtitle === 'off') setCurrentSubtitle('');
        };

        syncTracks();

        // Also listen for tracks being added dynamically (happens with some browsers/sources)
        const tracks = videoRef.current.textTracks;
        tracks.addEventListener('addtrack', syncTracks);

        return () => {
            tracks.removeEventListener('addtrack', syncTracks);
        };
    }, [activeSubtitle]);

    const toggleLock = (e) => {
        e.stopPropagation();
        setIsLocked(!isLocked);
        if (!isLocked) setShowControls(false); // Immediate hide logic when locking? Or let timeout handle it?
        // User asked for immediate hide behavior or auto-hide. 
        // If we lock, we probably want to start the timer or ensure logic follows interaction.
        // Let's rely on handleMouseMove handling the hide naturally.
    };

    const handleMouseMove = () => {
        // ALLOW mouse move even if locked, to wake up UI (specifically Lock Button)
        // if (isLocked) return; <-- REMOVED

        setShowControls(true);
        clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 2000); // 2s inactivity hide (Youtube style)
    };

    // Helper to keep controls alive during interaction
    const resetControlsTimeout = () => {
        clearTimeout(controlsTimeout.current);
        controlsTimeout.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    const handleMobileButton = (action) => (e) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent ghost click
        resetControlsTimeout();
        action();
    };



    // Touch Handling for manual "Tap" detection (Robust Mobile Toggle)
    const touchStartTime = useRef(0);
    const touchStartX = useRef(0);
    const isTouchInteraction = useRef(false);

    const handleContainerTouchStart = (e) => {
        touchStartTime.current = Date.now();
        touchStartX.current = e.touches[0].clientX;
        isTouchInteraction.current = true;
    };

    const handleContainerTouchEnd = (e) => {
        const touchEndTime = Date.now();
        const touchEndX = e.changedTouches[0].clientX;

        // Calculate duration and movement
        const duration = touchEndTime - touchStartTime.current;
        const moveX = Math.abs(touchEndX - touchStartX.current);

        // Define a "Tap" as short duration (< 300ms) and little movement (< 10px)
        if (duration < 300 && moveX < 10) {
            // Valid tap - Toggle Controls
            // If locked, we want to WAKE controls (set true), if not locked, we toggle.
            // Actually simple toggle is arguably fine, or just "if hidden, show".
            // Let's stick to toggle behavior but allow it when locked.

            setShowControls(prev => !prev);

            // Start/Reset timer logic if we are showing controls
            // (We can't easily check 'prev' state inside the setShowControls callback for this side effect, 
            // so we rely on current state for a rough guess or effect logic. 
            // Better: just reset timer always on interaction.)
            clearTimeout(controlsTimeout.current);
            controlsTimeout.current = setTimeout(() => {
                if (isPlaying) setShowControls(false);
            }, 3000);
        }

        // Reset interaction flag after a short delay so onClick knows it was a touch
        setTimeout(() => {
            isTouchInteraction.current = false;
        }, 500);
    };

    const handlePlayerClick = (e) => {
        if (isLocked) return;

        // If this click was triggered by a touch event we just handled, IGNORE it.
        if (isTouchInteraction.current) return;

        // Restore IsMobile check for "Click" events in case touch interaction flag failed
        // or if we are in a hybrid state. On Mobile, "Click" (background) should NOT Play/Pause.
        const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
        if (isMobile) {
            // Background click on mobile -> Toggle Controls (or do nothing if touch end handled it)
            // We rely on handleContainerTouchEnd for the toggle. 
            // If we are here, it's likely a simulated click. We can safely ignore or ensure controls toggle.
            // Let's Just toggle for safety if it wasn't handled, but usually touchEnd did it.
            // Actually, if we are here, touchEnd might have missed it? 
            // Better to be safe: If mobile, ensure we DO NOT toggle play.
            return;
        }

        // Desktop Behavior (Legacy)
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        if (e.detail === 2) { // Double click
            clearTimeout(clickTimeout.current);
            if (x < width * 0.3) {
                handleSeek('rewind');
            } else if (x > width * 0.7) {
                handleSeek('forward');
            } else {
                togglePlay();
            }
        } else if (e.detail === 1) { // Single click
            clickTimeout.current = setTimeout(() => {
                // Ensure we don't toggle play if it was a hybrid touch-click (safety)
                if (!isTouchInteraction.current) {
                    togglePlay();
                }
            }, 300);
        }
    };

    // ... existing ...

    if (!movie || !movie.video_url) {
        return (
            <div className="video-player-overlay">
                <button className="close-player" onClick={onClose}>&times;</button>
                <div className="error-message">
                    <h2>Erro ao reproduzir</h2>
                    <p>URL do vídeo não encontrada ou inválida.</p>
                </div>
            </div>
        );
    }


    return (
        <div
            ref={containerRef}
            className={`video-player-overlay ${!showControls ? 'hide-cursor' : ''} ${isLocked ? 'is-locked' : ''} sub-size-${subtitleSize} ${showControls ? 'controls-visible' : ''}`}
            onContextMenu={e => e.preventDefault()}
            onMouseMove={handleMouseMove}
            style={{ filter: `brightness(${brightness}%)` }}
            onTouchEnd={() => {
                // Global touch end logic if needed
                // Note: handleContainerTouchEnd handles the main tap.
                // This might be redundant or for the overlay wrapper itself.
                if (!isLocked) {
                    // Ensure timer resets on any touch up if controls are up
                    clearTimeout(controlsTimeout.current);
                    controlsTimeout.current = setTimeout(() => {
                        if (isPlaying) setShowControls(false);
                    }, 3000);
                }
            }}
        >
            {/* Lock Button Overlay */}
            <button
                className={`lock-toggle-btn ${!showControls ? 'hidden' : ''} ${isLocked ? 'locked' : ''}`}
                onClick={toggleLock}
                title={isLocked ? "Desbloquear Tela" : "Bloquear Tela"}
            >
                {isLocked ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                    </svg>
                )}
            </button>

            <button className={`close-player-btn ${(!showControls && !isBuffering) || isLocked ? 'hidden' : ''}`} onClick={handleClose} title="Fechar">
                &times;
            </button>

            <div
                className="player-container"
                onClick={handlePlayerClick}
                onTouchStart={handleContainerTouchStart}
                onTouchEnd={handleContainerTouchEnd}
            >
                <video
                    ref={videoRef}
                    src={finalVideoUrl}
                    className="video-element"
                    poster={movie.backdrop_image || movie.image}
                    crossOrigin={(finalVideoUrl.includes('/Videos/') || finalVideoUrl.includes('supabase.co')) ? "anonymous" : null}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlaying={() => {
                        setIsBuffering(false);
                        setVideoError(null);
                    }}
                    onWaiting={() => setIsBuffering(true)}
                    onError={(e) => {
                        console.error("VideoPlayer: Video Element Error", e.target.error);
                        setIsBuffering(false);
                        const err = e.target.error;
                        let msg = "Erro ao carregar vídeo.";
                        if (err.code === 1) msg = "Busca interrompida.";
                        if (err.code === 2) msg = "Erro de rede.";
                        if (err.code === 3) msg = "Erro ao decodificar.";
                        if (err.code === 4) msg = "O vídeo não pôde ser carregado (CORS ou URL inválida).";
                        setVideoError(msg);
                    }}
                    onEnded={() => {
                        setIsPlaying(false);
                        setShowRecommendations(true);
                        setShowControls(true);
                    }}
                    onCanPlay={() => {
                        handleCanPlay();
                        setIsBuffering(false);
                    }}
                >
                    {movie.subtitles?.map((track, idx) => (
                        <track
                            key={`${track.lang}-${idx}`}
                            label={track.label}
                            kind="subtitles"
                            srcLang={track.lang || 'pt'}
                            src={track.url}
                            default={activeSubtitle === track.lang}
                        />
                    ))}
                    Seu navegador não suporta a tag de vídeo.
                </video>

                <div className={`central-controls-wrapper ${(!showControls && isPlaying) || isLocked ? 'hidden' : ''}`}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchEnd={e => e.stopPropagation()}
                >
                    <button
                        className="side-ctrl-btn rewind"
                        onClick={(e) => { e.stopPropagation(); handleSeek('rewind'); }}
                        onTouchEnd={handleMobileButton(() => handleSeek('rewind'))}
                        title="Voltar 10s"
                    >
                        <span className="seek-icon">↺</span>
                        <span className="seek-val">10</span>
                    </button>

                    <button
                        className={`central-ctrl-btn ${isPlaying ? 'pause' : 'play'}`}
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        onTouchEnd={handleMobileButton(togglePlay)}
                    >
                        {isPlaying ? (
                            <div className="pause-icon">
                                <span></span>
                                <span></span>
                            </div>
                        ) : (
                            <span className="play-icon">▶</span>
                        )}
                    </button>

                    <button
                        className="side-ctrl-btn forward"
                        onClick={(e) => { e.stopPropagation(); handleSeek('forward'); }}
                        onTouchEnd={handleMobileButton(() => handleSeek('forward'))}
                        title="Avançar 10s"
                    >
                        <span className="seek-icon">↻</span>
                        <span className="seek-val">10</span>
                    </button>
                </div>

                {/* Seek Action Overlay (Transient Feedback) */}
                {(overlayAction === 'rewind' || overlayAction === 'forward') && (
                    <div className={`player-action-overlay seek-action ${overlayAction}`}>
                        <div className="seek-icon-wrapper">
                            <span className="seek-arrow">{overlayAction === 'rewind' ? '«' : '»'}</span>
                            <span className="seek-seconds">10s</span>
                        </div>
                    </div>
                )}


                {/* Recommendations End Overlay */}
                {showRecommendations && !isLocked && (
                    <div className="recommendations-overlay">
                        <div className="recommendations-content">
                            <h3>Recomendados para você</h3>
                            <div className="recommendations-grid">
                                {movie.recommendations ? movie.recommendations.map(rec => (
                                    <div
                                        key={rec.id}
                                        className="rec-card"
                                        onClick={(e) => { e.stopPropagation(); onRecommendClick(rec); }}
                                    >
                                        <div className="rec-image-wrapper">
                                            <img src={rec.image} alt={rec.title} />
                                            <div className="rec-play-hint">▶</div>
                                        </div>
                                        <span className="rec-title">{rec.title}</span>
                                    </div>
                                )) : (
                                    <div className="rec-empty">Nenhuma recomendação disponível</div>
                                )}
                            </div>
                            <button className="replay-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                                Assistir Novamente ↺
                            </button>
                        </div>
                    </div>
                )}

                {/* Buffering Indicator */}
                {isBuffering && !videoError && (
                    <div className="buffering-overlay">
                        <div className="buffering-spinner"></div>
                    </div>
                )}

                {/* Video Error Message */}
                {videoError && (
                    <div className="video-error-overlay">
                        <div className="video-error-content">
                            <span className="error-icon">⚠️</span>
                            <h3>Não foi possível reproduzir este vídeo</h3>
                            <p>{videoError}</p>
                            <button className="retry-btn" onClick={() => {
                                setVideoError(null);
                                setIsBuffering(true);
                                if (videoRef.current) {
                                    videoRef.current.load();
                                    videoRef.current.play();
                                }
                            }}>
                                Tentar Novamente
                            </button>
                        </div>
                    </div>
                )}

                {/* Custom Subtitle Display */}
                {currentSubtitle && (
                    <div className={`custom-subtitle-wrapper ${showControls ? 'controls-up' : ''}`}>
                        <div
                            className="custom-subtitle-content"
                            dangerouslySetInnerHTML={{ __html: currentSubtitle }}
                        />
                    </div>
                )}
            </div>

            {/* Custom Control Bar */}
            <div
                className={`custom-controls ${!showControls || isLocked ? 'hidden' : ''}`}
                onClick={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onTouchEnd={e => e.stopPropagation()}
            >
                <div className="player-title">
                    {movie.title}
                </div>
                <div
                    className="progress-container"
                    onClick={handleProgressBarClick}
                    onMouseMove={handleProgressBarMouseMove}
                    onMouseLeave={handleProgressBarMouseLeave}
                    onTouchStart={handleTouchSeek}
                    onTouchMove={handleTouchSeek}
                    onTouchEnd={handleTouchSeekEnd}
                >
                    {/* ... inner progress ... */}
                    {hoverTime && (
                        <div
                            className="time-tooltip"
                            style={{ left: `${hoverPosition}%` }}
                        >
                            {hoverTime}
                        </div>
                    )}
                    <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
                            <div className="progress-knob"></div>
                        </div>
                    </div>
                </div>

                <div className="controls-row">
                    <div className="controls-left">
                        <div className="time-display">
                            {currentTime} / {duration}
                        </div>
                    </div>

                    <div className="controls-right">
                        {/* Speed Control */}
                        <div className="speed-control">
                            <button
                                className="ctrl-btn speed-btn"
                                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                title="Velocidade"
                            >
                                <span className="speed-label">{playbackSpeed}x</span>
                            </button>
                            {showSpeedMenu && (
                                <div className="speed-menu">
                                    {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                                        <button
                                            key={speed}
                                            className={`speed-option ${playbackSpeed === speed ? 'active' : ''}`}
                                            onClick={() => handleSpeedChange(speed)}
                                        >
                                            {speed === 1 ? 'Normal' : `${speed}x`}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Subtitle Control */}
                        <div className="subtitle-control">
                            <button
                                className={`ctrl-btn sm-btn ${activeSubtitle !== 'off' ? 'active' : ''}`}
                                onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                                title="Legendas"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                    <path d="M7 8h10M7 12h7"></path>
                                </svg>
                            </button>
                            {showSubtitleMenu && (
                                <div className="subtitle-menu">
                                    <div className="subtitle-menu-section">
                                        <h4>Legendas</h4>
                                        <button
                                            className={`subtitle-option ${activeSubtitle === 'off' ? 'active' : ''}`}
                                            onClick={() => handleSubtitleChange('off')}
                                        >
                                            Desativado
                                        </button>
                                        {movie.subtitles?.map(track => (
                                            <button
                                                key={track.lang}
                                                className={`subtitle-option ${activeSubtitle === track.lang ? 'active' : ''}`}
                                                onClick={() => handleSubtitleChange(track.lang)}
                                            >
                                                {track.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="subtitle-menu-divider"></div>
                                    <div className="subtitle-menu-section">
                                        <h4>Tamanho</h4>
                                        <div className="size-options">
                                            {[
                                                { id: 'small', label: 'Pequena' },
                                                { id: 'medium', label: 'Média' },
                                                { id: 'large', label: 'Grande' },
                                                { id: 'xl', label: 'Extra G' }
                                            ].map(size => (
                                                <button
                                                    key={size.id}
                                                    className={`size-option ${subtitleSize === size.id ? 'active' : ''}`}
                                                    onClick={() => setSubtitleSize(size.id)}
                                                >
                                                    {size.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="brightness-control">
                            <button className="ctrl-btn sm-btn" title="Brilho">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                                    <circle cx="12" cy="12" r="5"></circle>
                                    <line x1="12" y1="1" x2="12" y2="3"></line>
                                    <line x1="12" y1="21" x2="12" y2="23"></line>
                                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                    <line x1="1" y1="12" x2="3" y2="12"></line>
                                    <line x1="21" y1="12" x2="23" y2="12"></line>
                                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                                </svg>
                            </button>
                            <div className="brightness-slider-container">
                                <input
                                    type="range"
                                    min="30"
                                    max="150"
                                    step="1"
                                    value={brightness}
                                    onChange={handleBrightnessChange}
                                    className="brightness-slider"
                                />
                            </div>
                        </div>

                        <div className="volume-control">
                            <button className="ctrl-btn sm-btn" onClick={toggleMute} title="Volume">
                                {isMuted || volume === 0 ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                                        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                        <line x1="23" y1="9" x2="17" y2="15"></line>
                                        <line x1="17" y1="9" x2="23" y2="15"></line>
                                    </svg>
                                ) : volume < 0.5 ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                                        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="svg-icon">
                                        <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                    </svg>
                                )}
                            </button>
                            <div className="volume-slider-container">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="volume-slider"
                                />
                            </div>
                        </div>

                        {isCastAvailable && (
                            <button
                                className="ctrl-btn lg-btn cast-btn"
                                onClick={async () => {
                                    if (Capacitor.isNativePlatform()) {
                                        try {
                                            const { active } = await IonicChromecast.isSessionActive();
                                            if (!active) {
                                                console.log("VideoPlayer: Requesting Native Session...");
                                                await IonicChromecast.requestSession();
                                            } else {
                                                // If already connected, offer to disconnect (plugin dialog is missing)
                                                if (window.confirm("Já está conectado à TV. Deseja desconectar?")) {
                                                    console.log("VideoPlayer: Ending Native Session...");
                                                    await IonicChromecast.endSession();
                                                } else {
                                                    console.log("VideoPlayer: Reloading media on active session...");
                                                    loadMediaOnNativeCast();
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Native Cast Click Error:", err);
                                        }
                                    } else {
                                        try {
                                            const context = window.cast.framework.CastContext.getInstance();
                                            const session = context.getCurrentSession();
                                            if (!session) {
                                                context.requestSession();
                                            } else {
                                                if (window.confirm("Já está transmitindo. Deseja parar?")) {
                                                    context.endCurrentSession(true);
                                                } else {
                                                    loadMediaOnWebCast();
                                                }
                                            }
                                        } catch (err) {
                                            console.error("Web Cast Click Error", err);
                                        }
                                    }
                                }}
                                title="Transmitir para TV"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="svg-icon lg">
                                    <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
                                    <line x1="2" y1="20" x2="2.01" y2="20"></line>
                                </svg>
                            </button>
                        )}

                        <button className="ctrl-btn lg-btn" onClick={toggleFullscreen} title="Tela Cheia">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="svg-icon lg">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default VideoPlayer;
