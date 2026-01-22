import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AVATARS } from '../constants/avatars';
import './ProfileModal.css';

const ProfileModal = ({ session, onClose, onUpdate }) => {
    const [fullName, setFullName] = useState(session?.user?.user_metadata?.full_name || '');
    const [selectedAvatar, setSelectedAvatar] = useState(session?.user?.user_metadata?.avatar_url || AVATARS[0].url);
    const [showAvatarGrid, setShowAvatarGrid] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const validateName = (name) => {
        if (name.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
        const regex = /^[a-zA-Záàâãéèêíïóôõöúçñ\s]+$/;
        if (!regex.test(name)) return 'O nome não deve conter números ou caracteres especiais.';
        return null;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError(null);

        const nameError = validateName(fullName);
        if (nameError) {
            setError(nameError);
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    avatar_url: selectedAvatar
                }
            });

            if (updateError) throw updateError;

            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            setError('Erro ao atualizar perfil: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                <div className="profile-modal-header">
                    <h2>Editar Perfil</h2>
                    <button className="close-profile-btn" onClick={onClose}>&times;</button>
                </div>

                {error && <div className="profile-error-msg">{error}</div>}

                <div className="current-profile-section">
                    <div className="avatar-edit-wrapper" onClick={() => setShowAvatarGrid(true)}>
                        <img src={selectedAvatar} alt="Atual" className="current-avatar" />
                        <div className="avatar-edit-badge">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <form className="profile-form" onSubmit={handleSave}>
                    <div className="profile-input-group">
                        <label>Nome</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Seu nome"
                            required
                        />
                    </div>

                    <div className="profile-input-group">
                        <label>E-mail (Não editável)</label>
                        <input
                            type="email"
                            value={session?.user?.email}
                            disabled
                            style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        />
                    </div>

                    <button type="submit" className="profile-save-btn" disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </form>
            </div>

            {/* Avatar Selection Modal Overlay */}
            {showAvatarGrid && (
                <div className="avatar-modal-overlay" onClick={() => setShowAvatarGrid(false)}>
                    <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Escolha seu Avatar</h2>
                            <button className="close-modal-btn" onClick={() => setShowAvatarGrid(false)}>&times;</button>
                        </div>
                        <div className="avatars-grid-full">
                            {AVATARS.map((avatar) => (
                                <div
                                    key={avatar.id}
                                    className={`avatar-item ${selectedAvatar === avatar.url ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedAvatar(avatar.url);
                                        setShowAvatarGrid(false);
                                    }}
                                >
                                    <img src={avatar.url} alt="Opção" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileModal;
