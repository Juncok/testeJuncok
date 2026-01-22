import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { movieService } from '../services/movieService';
import { translateService } from '../services/translateService';
import { fetchLatestMedia, fetchItemDetails, getImageUrl, getBackdropUrl, getStreamUrl, getSubtitleUrl } from '../jellyfinClient';
import './AdminPanel.css';

const AdminPanel = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('media'); // 'media', 'episodes', 'manage', or 'sync'
    const [seriesList, setSeriesList] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [jellyfinItems, setJellyfinItems] = useState([]);

    // Media Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        poster_image: '',
        backdrop_image: '',
        content_type: 'movie',
        main_group: 'Filmes',
        genre: '',
        is_featured: false,
        is_top10: false,
        year: new Date().getFullYear(),
        rating: 'L',
        duration: '',
        video_url: '',
        trailer_url: '',
        logo_url: '',
        subtitles: []
    });

    // Episode Form State
    const [episodeData, setEpisodeData] = useState({
        media_id: '',
        season_number: 1,
        episode_number: 1,
        title: '',
        description: '',
        thumbnail_image: '',
        duration: '',
        video_url: '',
        subtitles: []
    });

    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Fetch series for the dropdown when switching to episodes tab
    const loadSeries = async () => {
        const { data } = await supabase
            .from('media')
            .select('id, title')
            .eq('content_type', 'series')
            .order('title');
        setSeriesList(data || []);
    };

    const loadCatalog = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('media')
            .select('*')
            .order('created_at', { ascending: false });
        setCatalog(data || []);
        setLoading(false);
    };

    const loadJellyfin = async () => {
        setLoading(true);
        setStatus({ type: 'info', message: 'Buscando arquivos no Jellyfin...' });
        try {
            const items = await fetchLatestMedia();
            setJellyfinItems(items);
            if (items.length > 0) {
                setStatus({ type: 'success', message: `${items.length} itens encontrados no Jellyfin!` });
            } else {
                setStatus({ type: 'info', message: 'Nenhum item novo encontrado no Jellyfin.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Falha ao conectar com o Jellyfin.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'episodes') {
            loadSeries();
        } else if (activeTab === 'manage') {
            loadCatalog();
        } else if (activeTab === 'sync') {
            loadCatalog(); // Pre-load catalog to detect duplicates
            loadJellyfin();
        }
    }, [activeTab]);

    const handleAutoFill = async () => {
        if (!formData.title) {
            setStatus({ type: 'error', message: 'Digite um título para buscar.' });
            return;
        }

        setSearching(true);
        setStatus({ type: '', message: '' });
        try {
            const results = await movieService.search(formData.title, formData.content_type);
            setSearchResults(results);
            if (results.length === 0) {
                setStatus({ type: 'error', message: 'Nenhum resultado encontrado.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Erro ao buscar dados.' });
        } finally {
            setSearching(false);
        }
    };

    const selectMovie = async (item) => {
        setLoading(true);
        setStatus({ type: 'success', message: 'Buscando e traduzindo dados...' });
        try {
            const id = item.imdbID || item.tvmazeId;
            const details = await movieService.getDetails(id, formData.content_type);

            if (details) {
                // Tradução automática
                const [translatedTitle, translatedDesc, translatedGenre] = await Promise.all([
                    translateService.translate(details.title),
                    translateService.translate(details.description),
                    translateService.translate(details.genre)
                ]);

                setFormData(prev => ({
                    ...prev,
                    title: translatedTitle,
                    description: translatedDesc,
                    poster_image: details.poster && details.poster !== 'N/A' ? details.poster : prev.poster_image,
                    year: details.year ? parseInt(details.year) : prev.year,
                    genre: translatedGenre || prev.genre,
                    rating: details.rating || prev.rating,
                    duration: details.duration || prev.duration
                }));
                setSearchResults([]);
                setStatus({ type: 'success', message: 'Dados traduzidos e preenchidos!' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Erro ao carregar detalhes ou traduzir.' });
        } finally {
            setLoading(false);
        }
    };

    const handleImportJellyfin = async (initialItem) => {
        console.log("AdminPanel: Importing item from Jellyfin (Initial):", initialItem);
        setLoading(true);
        setStatus({ type: 'info', message: 'Buscando detalhes completos do item...' });

        try {
            // DEEP FETCH: Busca os detalhes completos do item na API para garantir que temos as legendas
            const fullItem = (await fetchItemDetails(initialItem.Id)) || initialItem;

            console.log("AdminPanel: Full Item Details:", fullItem);

            const isSeries = fullItem.Type === 'Series';

            // Detect duplication: If already in catalog, set editingId
            const existing = catalog.find(c => c.title.toLowerCase() === fullItem.Name.toLowerCase());
            if (existing) {
                console.log(`AdminPanel: Item "${fullItem.Name}" already exists (ID: ${existing.id}). Switching to Edit mode.`);
                setEditingId(existing.id);
            } else {
                setEditingId(null);
            }

            // Mapear legendas detectadas pelo Jellyfin
            let detectedSubtitles = [];

            const addSubtitle = (stream, sourceId = null) => {
                const title = stream.Title || stream.DisplayTitle || stream.Language || 'Desconhecido';
                const lang = stream.Language || 'por'; // Default to 'por' (Portuguese) if undefined
                const label = `${lang.toUpperCase()} - ${title}`;

                // Evitar duplicatas simples
                const existing = detectedSubtitles.find(s => s.label === label);
                if (!existing) {
                    detectedSubtitles.push({
                        label: label,
                        lang: lang,
                        url: getSubtitleUrl(fullItem.Id, stream.Index, sourceId)
                    });
                }
            };

            // 1. Tentar via MediaSources (Mais detalhado)
            if (fullItem.MediaSources && fullItem.MediaSources.length > 0) {
                console.log(`[Jellyfin Import Debug] Encontrados ${fullItem.MediaSources.length} MediaSources.`);
                fullItem.MediaSources.forEach(source => {
                    if (source.MediaStreams) {
                        source.MediaStreams.forEach(stream => {
                            if (stream.Type === 'Subtitle') {
                                addSubtitle(stream, source.Id);
                            }
                        });
                    }
                });
            }

            // 2. Fallback / Complemento via MediaStreams (Nível superior)
            if (fullItem.MediaStreams && fullItem.MediaStreams.length > 0) {
                console.log(`[Jellyfin Import Debug] Verificando MediaStreams de nível superior.`);
                fullItem.MediaStreams.forEach(stream => {
                    if (stream.Type === 'Subtitle') {
                        // Passamos null no sourceId para forçar o uso do ItemId (comportamento padrão do getSubtitleUrl)
                        addSubtitle(stream, null);
                    }
                });
            }

            console.log(`[Jellyfin Import Debug] Total de legendas encontradas: ${detectedSubtitles.length}`);

            setFormData({
                title: fullItem.Name,
                description: fullItem.Overview || '',
                poster_image: getImageUrl(fullItem.Id, fullItem.ImageTags?.Primary),
                backdrop_image: getBackdropUrl(fullItem.Id, fullItem.BackdropImageTags?.[0]),
                content_type: isSeries ? 'series' : 'movie',
                main_group: isSeries ? 'Séries' : 'Filmes',
                genre: (fullItem.Genres || []).join(', '),
                is_featured: false,
                year: fullItem.ProductionYear || new Date().getFullYear(),
                rating: fullItem.OfficialRating || 'L',
                duration: fullItem.RunTimeTicks ? `${Math.floor(fullItem.RunTimeTicks / 600000000)}m` : '',
                video_url: isSeries ? '' : getStreamUrl(fullItem.Id),
                subtitles: detectedSubtitles
            });
            setActiveTab('media');
            setStatus({ type: 'success', message: `Dados importados! ${detectedSubtitles.length} legendas detectadas.` });
        } catch (error) {
            console.error("AdminPanel: Error importing from Jellyfin:", error);
            setStatus({ type: 'error', message: `Erro ao importar: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleMediaChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEpisodeChange = (e) => {
        const { name, value } = e.target;
        setEpisodeData(prev => ({ ...prev, [name]: value }));
    };

    const handleCleanup = async () => {
        if (!window.confirm('Isso removerá todos os filmes sem URL de vídeo e todas as séries sem episódios. Deseja continuar?')) return;

        setLoading(true);
        setStatus({ type: 'info', message: 'Iniciando limpeza...' });

        try {
            // 1. Identify movies without video_url
            const { data: emptyMovies } = await supabase
                .from('media')
                .select('id')
                .eq('content_type', 'movie')
                .or('video_url.is.null,video_url.eq.""');

            const movieIdsToDelete = emptyMovies?.map(m => m.id) || [];

            // 2. Identify series without episodes
            const { data: allSeries } = await supabase
                .from('media')
                .select('id')
                .eq('content_type', 'series');

            const seriesIdsToDelete = [];
            if (allSeries) {
                for (const s of allSeries) {
                    const { count } = await supabase
                        .from('episodes')
                        .select('id', { count: 'exact', head: true })
                        .eq('media_id', s.id);

                    if (count === 0) {
                        seriesIdsToDelete.push(s.id);
                    }
                }
            }

            // 3. Execute Deletions
            if (movieIdsToDelete.length > 0) {
                const { error: mErr } = await supabase
                    .from('media')
                    .delete()
                    .in('id', movieIdsToDelete);
                if (mErr) throw mErr;
            }

            if (seriesIdsToDelete.length > 0) {
                const { error: sErr } = await supabase
                    .from('media')
                    .delete()
                    .in('id', seriesIdsToDelete);
                if (sErr) throw sErr;
            }

            setStatus({
                type: 'success',
                message: `Limpeza concluída! ${movieIdsToDelete.length} filmes e ${seriesIdsToDelete.length} séries removidos.`
            });
            loadCatalog(); // Refresh local catalog
        } catch (error) {
            console.error("AdminPanel: Error during cleanup:", error);
            setStatus({ type: 'error', message: `Erro na limpeza: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleMediaSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            // Remove empty optional fields to prevent schema errors
            const submissionData = { ...formData };
            if (!submissionData.video_url) delete submissionData.video_url;

            // Submission logic (Insert or Update)
            if (editingId) {
                const { error } = await supabase
                    .from('media')
                    .update(submissionData)
                    .eq('id', editingId);
                if (error) throw error;
                setStatus({ type: 'success', message: 'Conteúdo atualizado com sucesso!' });
                setEditingId(null);
            } else {
                const { error } = await supabase.from('media').insert([submissionData]);
                if (error) throw error;
                setStatus({ type: 'success', message: 'Conteúdo adicionado com sucesso!' });
            }

            setFormData({
                title: '',
                description: '',
                poster_image: '',
                backdrop_image: '',
                content_type: 'movie',
                main_group: 'Filmes',
                genre: '',
                is_featured: false,
                is_top10: false,
                year: new Date().getFullYear(),
                rating: 'L',
                duration: '',
                video_url: '',
                trailer_url: '',
                logo_url: '',
                subtitles: []
            });
        } catch (error) {
            setStatus({ type: 'error', message: `Erro: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item) => {
        setFormData({
            title: item.title || '',
            description: item.description || '',
            poster_image: item.poster_image || '',
            backdrop_image: item.backdrop_image || '',
            content_type: item.content_type || 'movie',
            main_group: item.main_group || 'Filmes',
            genre: item.genre || '',
            is_featured: item.is_featured || false,
            is_top10: item.is_top10 || false,
            year: item.year || new Date().getFullYear(),
            rating: item.rating || 'L',
            duration: item.duration || '',
            video_url: item.video_url || '',
            trailer_url: item.trailer_url || '',
            logo_url: item.logo_url || '',
            subtitles: item.subtitles || []
        });
        setEditingId(item.id);
        setActiveTab('media');
        setStatus({ type: 'success', message: `Editando: ${item.title}` });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir permanentemente este conteúdo?')) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('media').delete().eq('id', id);
            if (error) throw error;
            setStatus({ type: 'success', message: 'Conteúdo excluído com sucesso!' });
            loadCatalog();
        } catch (error) {
            setStatus({ type: 'error', message: `Erro ao excluir: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleEpisodeSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            if (!episodeData.media_id) throw new Error("Selecione uma série primeiro.");

            // 1. Get or Create Season
            let { data: seasons, error: sError } = await supabase
                .from('seasons')
                .select('id')
                .eq('media_id', episodeData.media_id)
                .eq('season_number', episodeData.season_number)
                .maybeSingle();

            let seasonId;
            if (!seasons) {
                const { data: newSeason, error: nsError } = await supabase
                    .from('seasons')
                    .insert([{ media_id: episodeData.media_id, season_number: episodeData.season_number }])
                    .select()
                    .single();
                if (nsError) throw nsError;
                seasonId = newSeason.id;
            } else {
                seasonId = seasons.id;
            }

            // 2. Insert Episode
            const { error: epError } = await supabase
                .from('episodes')
                .insert([{
                    season_id: seasonId,
                    media_id: episodeData.media_id,
                    episode_number: episodeData.episode_number,
                    title: episodeData.title,
                    description: episodeData.description,
                    thumbnail_image: episodeData.thumbnail_image,
                    duration: episodeData.duration,
                    video_url: episodeData.video_url,
                    subtitles: episodeData.subtitles
                }]);

            if (epError) throw epError;

            setStatus({ type: 'success', message: 'Episódio adicionado com sucesso!' });
            setEpisodeData(prev => ({
                ...prev,
                episode_number: parseInt(prev.episode_number) + 1,
                title: '',
                description: '',
                thumbnail_image: '',
                video_url: '',
                subtitles: []
            }));
        } catch (error) {
            setStatus({ type: 'error', message: `Erro: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleAddSubtitle = (formType) => {
        const newSub = { label: '', lang: '', url: '' };
        if (formType === 'media') {
            setFormData(prev => ({ ...prev, subtitles: [...prev.subtitles, newSub] }));
        } else {
            setEpisodeData(prev => ({ ...prev, subtitles: [...prev.subtitles, newSub] }));
        }
    };

    const handleRemoveSubtitle = (formType, index) => {
        if (formType === 'media') {
            setFormData(prev => ({
                ...prev,
                subtitles: prev.subtitles.filter((_, i) => i !== index)
            }));
        } else {
            setEpisodeData(prev => ({
                ...prev,
                subtitles: prev.subtitles.filter((_, i) => i !== index)
            }));
        }
    };

    const handleSubtitleFieldChange = (formType, index, field, value) => {
        if (formType === 'media') {
            const newSubs = [...formData.subtitles];
            newSubs[index][field] = value;
            setFormData(prev => ({ ...prev, subtitles: newSubs }));
        } else {
            const newSubs = [...episodeData.subtitles];
            newSubs[index][field] = value;
            setEpisodeData(prev => ({ ...prev, subtitles: newSubs }));
        }
    };

    const toggleTop10 = async (item) => {
        try {
            const newValue = !item.is_top10;
            const { error } = await supabase
                .from('media')
                .update({ is_top10: newValue })
                .eq('id', item.id);

            if (error) throw error;

            // Update local state without full reload
            setCatalog(prev => prev.map(c =>
                c.id === item.id ? { ...c, is_top10: newValue } : c
            ));

            // Optional: nice little toast or just silent success
        } catch (error) {
            console.error("Error toggling Top 10:", error);
            setStatus({ type: 'error', message: 'Erro ao atualizar Top 10.' });
        }
    };

    return (
        <div className="admin-overlay">
            <div className="admin-modal">
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h2>Painel Administrativo</h2>

                {/* ... (tabs remain same) ... */}
                <div className="admin-tabs">
                    <button
                        type="button"
                        className={activeTab === 'media' ? 'active' : ''}
                        onClick={() => { setActiveTab('media'); setStatus({ type: '', message: '' }); }}
                    >
                        Mídias
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'episodes' ? 'active' : ''}
                        onClick={() => { setActiveTab('episodes'); setStatus({ type: '', message: '' }); }}
                    >
                        Episódios
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'manage' ? 'active' : ''}
                        onClick={() => { setActiveTab('manage'); setStatus({ type: '', message: '' }); }}
                    >
                        Gerenciar
                    </button>
                    <button
                        type="button"
                        className={activeTab === 'sync' ? 'active' : ''}
                        onClick={() => { setActiveTab('sync'); setStatus({ type: '', message: '' }); }}
                    >
                        Sincronizar 🔄
                    </button>
                </div>

                {status.message && (
                    <div className={`status-msg ${status.type}`}>
                        {status.message}
                    </div>
                )}

                {/* ... (media and episode forms hidden for brevity, logic unchanged) ... */}
                {activeTab === 'media' && (
                    <form onSubmit={handleMediaSubmit}>
                        {/* ... (render form content same as before) ... */}
                        <div className="form-group search-container">
                            <label>Título (Auto-Preencher)</label>
                            <div className="input-with-button">
                                <input name="title" value={formData.title} onChange={handleMediaChange} required placeholder="Ex: Inception ou Breaking Bad" />
                                <button type="button" className="auto-fill-btn" onClick={handleAutoFill} disabled={searching}>
                                    {searching ? 'Buscando...' : '🔍 Buscar Dados'}
                                </button>
                            </div>
                        </div>
                        {/* ... (rest of media form) ... */}
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                <p>Selecione o resultado correto:</p>
                                <div className="results-grid">
                                    {searchResults.slice(0, 4).map((item) => (
                                        <div key={item.imdbID || item.tvmazeId} className="result-item" onClick={() => selectMovie(item)}>
                                            <img src={item.Poster && item.Poster !== 'N/A' ? item.Poster : 'https://via.placeholder.com/100x150'} alt={item.Title} />
                                            <div className="result-info">
                                                <strong>{item.Title}</strong>
                                                <span>{item.Year}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" className="cancel-search" onClick={() => setSearchResults([])}>Cancelar</button>
                                </div>
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label>Tipo Técnico</label>
                                <select name="content_type" value={formData.content_type} onChange={handleMediaChange}>
                                    <option value="movie">Filme (Único)</option>
                                    <option value="series">Série (Episódios)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Onde Exibir (Fila)</label>
                                <select name="main_group" value={formData.main_group} onChange={handleMediaChange}>
                                    <option value="Filmes">Filmes</option>
                                    <option value="Séries">Séries</option>
                                    <option value="Desenhos">Desenhos</option>
                                    <option value="Novelas">Novelas</option>
                                    <option value="Animes">Animes</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Sinopse</label>
                            <textarea name="description" value={formData.description} onChange={handleMediaChange} rows="3" />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Poster URL (Vertical)</label>
                                <input name="poster_image" value={formData.poster_image} onChange={handleMediaChange} placeholder="https://..." />
                            </div>
                            <div className="form-group">
                                <label>Backdrop URL (Horizontal)</label>
                                <input name="backdrop_image" value={formData.backdrop_image} onChange={handleMediaChange} placeholder="https://..." />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Logo URL (PNG Transparente - Opcional)</label>
                            <input name="logo_url" value={formData.logo_url} onChange={handleMediaChange} placeholder="https://... logo.png" />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Gênero</label>
                                <input name="genre" value={formData.genre} onChange={handleMediaChange} placeholder="Ação, Terror..." />
                            </div>
                            <div className="form-group">
                                <label>Ano</label>
                                <input type="number" name="year" value={formData.year} onChange={handleMediaChange} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Classificação</label>
                                <input name="rating" value={formData.rating} onChange={handleMediaChange} placeholder="L, 14+, 18+..." />
                            </div>
                            <div className="form-group">
                                <label>Duração</label>
                                <input name="duration" value={formData.duration} onChange={handleMediaChange} placeholder="2h 10m ou 45m" />
                            </div>
                        </div>

                        {formData.content_type === 'movie' && (
                            <div className="form-group">
                                <label>URL do Vídeo (Apenas para Filmes)</label>
                                <input name="video_url" value={formData.video_url} onChange={handleMediaChange} placeholder="http://meuservidor.com/filme.mp4" />
                            </div>
                        )}

                        <div className="form-group">
                            <label>URL do Trailer (YouTube)</label>
                            <input name="trailer_url" value={formData.trailer_url} onChange={handleMediaChange} placeholder="https://www.youtube.com/watch?v=..." />
                        </div>

                        <div className="subtitles-section">
                            <label>Legendas (Formato .vtt)</label>
                            {formData.subtitles.map((sub, index) => (
                                <div key={index} className="subtitle-entry">
                                    <input placeholder="Rótulo (Ex: Português)" value={sub.label} onChange={(e) => handleSubtitleFieldChange('media', index, 'label', e.target.value)} />
                                    <input placeholder="Cod. (Ex: pt-BR)" value={sub.lang} onChange={(e) => handleSubtitleFieldChange('media', index, 'lang', e.target.value)} />
                                    <input placeholder="URL .vtt" value={sub.url} onChange={(e) => handleSubtitleFieldChange('media', index, 'url', e.target.value)} />
                                    <button type="button" className="remove-sub-btn" onClick={() => handleRemoveSubtitle('media', index)}>&times;</button>
                                </div>
                            ))}
                            <button type="button" className="add-sub-btn" onClick={() => handleAddSubtitle('media')}>
                                + Adicionar Legenda
                            </button>
                        </div>

                        <div className="form-group checkbox-group">
                            <input type="checkbox" id="is_featured" name="is_featured" checked={formData.is_featured} onChange={handleMediaChange} />
                            <label htmlFor="is_featured">Destacar em "Novidades"</label>
                        </div>

                        <div className="form-group checkbox-group">
                            <input type="checkbox" id="is_top10" name="is_top10" checked={formData.is_top10} onChange={handleMediaChange} />
                            <label htmlFor="is_top10">⭐ É Top 10 Indicado</label>
                        </div>

                        <div className="admin-form-actions">
                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Adicionar ao Catálogo')}
                            </button>
                            {editingId && (
                                <button type="button" className="cancel-edit-btn" onClick={() => {
                                    setEditingId(null);
                                    setFormData({
                                        title: '',
                                        description: '',
                                        poster_image: '',
                                        backdrop_image: '',
                                        content_type: 'movie',
                                        main_group: 'Filmes',
                                        genre: '',
                                        is_featured: false,
                                        is_top10: false,
                                        year: new Date().getFullYear(),
                                        rating: 'L',
                                        duration: '',
                                        video_url: '',
                                        trailer_url: '',
                                        logo_url: '',
                                        subtitles: []
                                    });
                                    setStatus({ type: '', message: '' });
                                }}>
                                    Cancelar Edição
                                </button>
                            )}
                        </div>
                    </form>
                )}

                {activeTab === 'episodes' && (
                    <form onSubmit={handleEpisodeSubmit}>
                        {/* ... (episode form logic unchanged) ... */}
                        <div className="form-group">
                            <label>Série</label>
                            <select name="media_id" value={episodeData.media_id} onChange={handleEpisodeChange} required>
                                <option value="">Selecione uma série...</option>
                                {seriesList.map(s => (
                                    <option key={s.id} value={s.id}>{s.title}</option>
                                ))}
                            </select>
                        </div>
                        {/* ... (rest of episode form) ... */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>Temporada nº</label>
                                <input type="number" name="season_number" value={episodeData.season_number} onChange={handleEpisodeChange} required />
                            </div>
                            <div className="form-group">
                                <label>Episódio nº</label>
                                <input type="number" name="episode_number" value={episodeData.episode_number} onChange={handleEpisodeChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Título do Episódio</label>
                            <input name="title" value={episodeData.title} onChange={handleEpisodeChange} placeholder="Ex: O Início" />
                        </div>

                        <div className="form-group">
                            <label>Sinopse do Episódio</label>
                            <textarea name="description" value={episodeData.description} onChange={handleEpisodeChange} rows="2" />
                        </div>

                        <div className="form-group">
                            <label>Thumbnail do Episódio (Horizontal)</label>
                            <input name="thumbnail_image" value={episodeData.thumbnail_image} onChange={handleEpisodeChange} placeholder="https://..." />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Duração</label>
                                <input name="duration" value={episodeData.duration} onChange={handleEpisodeChange} placeholder="Ex: 45m" />
                            </div>
                            <div className="form-group">
                                <label>URL do Vídeo (Episódio)</label>
                                <input name="video_url" value={episodeData.video_url} onChange={handleEpisodeChange} required placeholder="http://meuservidor.com/s01e01.mp4" />
                            </div>
                        </div>

                        <div className="subtitles-section">
                            <label>Legendas do Episódio (.vtt)</label>
                            {episodeData.subtitles.map((sub, index) => (
                                <div key={index} className="subtitle-entry">
                                    <input placeholder="Rótulo" value={sub.label} onChange={(e) => handleSubtitleFieldChange('episode', index, 'label', e.target.value)} />
                                    <input placeholder="Cod." value={sub.lang} onChange={(e) => handleSubtitleFieldChange('episode', index, 'lang', e.target.value)} />
                                    <input placeholder="URL .vtt" value={sub.url} onChange={(e) => handleSubtitleFieldChange('episode', index, 'url', e.target.value)} />
                                    <button type="button" className="remove-sub-btn" onClick={() => handleRemoveSubtitle('episode', index)}>&times;</button>
                                </div>
                            ))}
                            <button type="button" className="add-sub-btn" onClick={() => handleAddSubtitle('episode')}>
                                + Adicionar Legenda
                            </button>
                        </div>

                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Salvando...' : 'Adicionar Episódio'}
                        </button>
                    </form>
                )}

                {activeTab === 'manage' && (
                    <div className="catalog-manager">
                        <div className="catalog-tools">
                            <button className="cleanup-btn" onClick={handleCleanup} disabled={loading}>
                                🧹 Limpar Itens Sem Vídeos/Episódios
                            </button>
                        </div>
                        <div className="catalog-header">
                            <span>Título</span>
                            <span>Tipo</span>
                            <span>Top 10</span>
                            <span style={{ textAlign: 'right' }}>Ações</span>
                        </div>
                        <div className="catalog-list">
                            {catalog.map(item => (
                                <div key={item.id} className="catalog-item">
                                    <div className="item-title">
                                        <img src={item.poster_image} alt="" />
                                        <span>{item.title}</span>
                                    </div>
                                    <span className="item-type">{item.content_type}</span>

                                    {/* Star Toggle Button */}
                                    <button
                                        className={`btn-star-toggle ${item.is_top10 ? 'active' : ''}`}
                                        onClick={() => toggleTop10(item)}
                                        title={item.is_top10 ? "Remover dos Top 10" : "Adicionar aos Top 10"}
                                    >
                                        {item.is_top10 ? '⭐' : '☆'}
                                    </button>

                                    <div className="item-actions">
                                        <button className="btn-edit" onClick={() => handleEdit(item)}>Editar</button>
                                        <button className="btn-delete" onClick={() => handleDelete(item.id)}>Excluir</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {activeTab === 'sync' && (
                    <div className="sync-container">
                        <div className="sync-header">
                            <h3>Itens Recentes no Jellyfin</h3>
                            <button onClick={loadJellyfin} className="refresh-btn">Atualizar Lista</button>
                        </div>
                        {loading ? (
                            <p>Buscando arquivos...</p>
                        ) : (
                            <div className="sync-list">
                                {jellyfinItems.map(item => {
                                    const existsInCatalog = catalog.some(c => c.title.toLowerCase() === item.Name.toLowerCase());
                                    return (
                                        <div key={item.Id} className={`sync-item ${existsInCatalog ? 'in-catalog' : ''}`}>
                                            <div className="sync-item-info">
                                                <div className="sync-title-row">
                                                    <strong>{item.Name}</strong>
                                                </div>
                                                <div className="sync-info-row">
                                                    <span>{item.Type === 'Series' ? '📺 Série' : '🎬 Filme'} • {item.ProductionYear}</span>
                                                    {existsInCatalog && <span className="in-catalog-status"> • NO CATÁLOGO</span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleImportJellyfin(item)}
                                                className={`import-btn ${existsInCatalog ? 're-import' : ''}`}
                                            >
                                                {existsInCatalog ? 'Importar Novamente' : 'Importar'}
                                            </button>
                                        </div>
                                    );
                                })}
                                {jellyfinItems.length === 0 && <p>Nenhum item novo encontrado.</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
