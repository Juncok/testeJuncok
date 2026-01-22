import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AVATARS } from '../constants/avatars';
import logo from '../assets/logo.png';
import './Login.css';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].url);
    const [error, setError] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    const translateError = (err) => {
        const msg = err.message || '';
        const lowercaseMsg = msg.toLowerCase();

        if (lowercaseMsg.includes('invalid login credentials')) return 'Email ou senha incorretos.';
        if (lowercaseMsg.includes('user already registered')) return 'Este email já está cadastrado.';
        if (lowercaseMsg.includes('password should be at least 6 characters')) return 'A senha deve ter pelo menos 6 caracteres.';
        if (lowercaseMsg.includes('email not confirmed')) return 'Por favor, confirme seu email antes de entrar.';
        if (lowercaseMsg.includes('signups not allowed')) return 'Novos cadastros estão desabilitados no momento.';
        if (lowercaseMsg.includes('invalid format')) return 'Formato de e-mail inválido.';
        if (lowercaseMsg.includes('too many requests')) return 'Muitas tentativas. Tente novamente mais tarde.';

        return 'Ocorreu um erro: ' + msg;
    };

    const validateName = (name) => {
        if (name.length < 2) return 'O nome deve ter pelo menos 2 caracteres.';
        const regex = /^[a-zA-Záàâãéèêíïóôõöúçñ\s]+$/;
        if (!regex.test(name)) return 'O nome não deve conter números ou caracteres especiais.';
        return null;
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const nameError = validateName(fullName);
                if (nameError) {
                    setError(nameError);
                    setLoading(false);
                    return;
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            avatar_url: selectedAvatar,
                        },
                        emailRedirectTo: window.location.origin,
                    },
                });
                if (error) throw error;
                setShowSuccess(true);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            setError(translateError(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                {!isSignUp && (
                    <div className="login-logo-container">
                        <img src={logo} alt="Juncok Logo" className="login-logo" />
                    </div>
                )}

                {isSignUp && (
                    <div className="profile-preview-card horizontal">
                        <div
                            className="preview-avatar-wrapper small"
                            onClick={() => setShowAvatarModal(true)}
                            title="Clique para mudar o avatar"
                        >
                            <img src={selectedAvatar} alt="Sua Foto" />
                            <div className="preview-avatar-badge small">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </div>
                        </div>
                        <div className="preview-info text-left">
                            <span className="preview-name small">{fullName || 'Seu Nome'}</span>
                            <span className="preview-label small">{email || 'seu@email.com'}</span>
                        </div>
                        <img src={logo} alt="Juncok Logo" className="preview-logo" />
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleAuth}>
                    {isSignUp && (
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Nome Completo"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                    )}
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group password-group">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Senha"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex="-1"
                        >
                            {showPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            )}
                        </button>
                    </div>

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Carregando...' : isSignUp ? 'Cadastrar' : 'Entrar'}
                    </button>
                </form>

                <p className="toggle-auth">
                    {isSignUp ? 'Já tem uma conta?' : 'Novo por aqui?'}
                    <span onClick={() => setIsSignUp(!isSignUp)}>
                        {isSignUp ? ' Fazer Login' : ' Cadastre-se agora'}
                    </span>
                </p>
            </div>

            {/* Modal de Seleção de Avatar */}
            {showAvatarModal && (
                <div className="avatar-modal-overlay" onClick={() => setShowAvatarModal(false)}>
                    <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Escolha seu Avatar</h2>
                            <button className="close-modal-btn" onClick={() => setShowAvatarModal(false)}>&times;</button>
                        </div>
                        <div className="avatars-grid-full">
                            {AVATARS.map((avatar) => (
                                <div
                                    key={avatar.id}
                                    className={`avatar-item ${selectedAvatar === avatar.url ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedAvatar(avatar.url);
                                        setShowAvatarModal(false);
                                    }}
                                >
                                    <img src={avatar.url} alt="Avatar Option" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showSuccess && (
                <div className="success-modal-overlay">
                    <div className="success-modal">
                        <div className="success-icon">✔️</div>
                        <h2>Conta Criada!</h2>
                        <p>
                            Enviamos um e-mail de confirmação para <strong>{email}</strong>.
                        </p>
                        <p className="email-hint">
                            <strong>Aviso:</strong> O remetente do e-mail será <strong>noreply@mail.supabase.co</strong> (pode cair no Spam). Você pode alterar isso nas configurações do Supabase.
                        </p>
                        <button onClick={() => setShowSuccess(false)} className="auth-button">
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
