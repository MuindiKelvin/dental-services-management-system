import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaEye, FaEyeSlash } from 'react-icons/fa';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { Container, Row, Col, Card, Form, Button, Modal } from 'react-bootstrap';

const AuthComponent = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [theme, setTheme] = useState('light');
  const { signup, login } = useAuth();
  const navigate = useNavigate();

  const chartColors = {
    light: {
      background: '#ffffff',
      text: '#333333',
      card: '#f8f9fa',
      gradientStart: '#e6f0fa',
      gradientEnd: '#ffffff',
      primary: '#007bff'
    },
    dark: {
      background: '#1a1a1a',
      text: '#ffffff',
      card: '#2d2d2d',
      gradientStart: '#2c3e50',
      gradientEnd: '#1a1a1a',
      primary: '#1e90ff'
    },
    cosmic: {
      background: '#0a0a23',
      text: '#ffffff',
      card: '#1a1a3d',
      gradientStart: '#1a1a3d',
      gradientEnd: '#0a0a23',
      primary: '#00ffff'
    }
  };

  useEffect(() => {
    // Sync with sidebar theme if present
    const bodyTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(bodyTheme);
  }, []);

  const getErrorMessage = (error) => {
    if (error.code === 'auth/user-not-found') return 'No user found with this email address.';
    if (error.code === 'auth/wrong-password') return 'Incorrect password. Please try again.';
    if (error.code === 'auth/email-already-in-use') return 'An account with this email already exists.';
    if (error.code === 'auth/weak-password') return 'Password should be at least 6 characters long.';
    if (error.code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (error.code === 'auth/too-many-requests') return 'Too many attempts. Please try again later.';
    return 'An error occurred. Please try again.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Auth error:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    setError('');
    setResetMessage('');
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Password reset error:', error);
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container 
      fluid 
      className="auth-container animate__animated animate__zoomIn" 
      style={{ 
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${chartColors[theme].gradientStart}, ${chartColors[theme].gradientEnd})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Dynamic Background Particles */}
      <div className="particles" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0
      }}>
        <div className="particle" style={{ animation: 'float 5s ease-in-out infinite' }}></div>
        <div className="particle" style={{ animation: 'float 6s ease-in-out infinite 1s' }}></div>
        <div className="particle" style={{ animation: 'float 7s ease-in-out infinite 2s' }}></div>
      </div>

      <Row className="justify-content-center w-100">
        <Col md={6} lg={4}>
          <Card 
            className="shadow-lg border-0 animate__animated animate__pulse"
            style={{ 
              background: chartColors[theme].card,
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: `0 10px 30px ${chartColors[theme].text}22`,
              zIndex: 1
            }}
          >
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <h1 
                  className="h3 mb-3 d-flex align-items-center justify-content-center"
                  style={{ 
                    color: chartColors[theme].text,
                    textShadow: `0 2px 4px ${chartColors[theme].text}33`,
                    animation: 'pulseText 2s infinite'
                  }}
                >
                  <span className="logo me-2" style={{ fontSize: '2rem', color: chartColors[theme].primary }}>🦷</span>
                  Berkshire Dental Clinic
                </h1>
                <p 
                  className="text-muted"
                  style={{ 
                    color: `${chartColors[theme].text}99`,
                    fontSize: '1.1rem',
                    letterSpacing: '1px'
                  }}
                >
                  {isLogin ? 'Welcome Back' : 'Join Our Team'}
                </p>
              </div>

              {error && (
                <div 
                  className="alert alert-danger animate__animated animate__shakeX" 
                  role="alert"
                  style={{ borderRadius: '10px', background: `${chartColors[theme].status?.[0] || '#dc3545'}33`, color: chartColors[theme].text }}
                >
                  {error}
                </div>
              )}
              {resetMessage && (
                <div 
                  className="alert alert-success animate__animated animate__bounceIn" 
                  role="alert"
                  style={{ borderRadius: '10px', background: `${chartColors[theme].status?.[1] || '#28a745'}33`, color: chartColors[theme].text }}
                >
                  {resetMessage}
                </div>
              )}

              <Form onSubmit={handleSubmit} className="needs-validation">
                <Form.Group className="mb-4">
                  <Form.Label style={{ color: chartColors[theme].text }}>Email Address</Form.Label>
                  <Form.Control
                    id="email"
                    type="email"
                    className={`futuristic-input ${error && error.includes('email') ? 'is-invalid' : ''}`}
                    placeholder="name@berkshire.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    style={{
                      background: `${chartColors[theme].background}aa`,
                      color: chartColors[theme].text,
                      border: `1px solid ${chartColors[theme].text}33`,
                      borderRadius: '15px',
                      padding: '0.75rem 1rem',
                      boxShadow: `0 0 10px ${chartColors[theme].text}22`,
                      transition: 'all 0.3s ease'
                    }}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ color: chartColors[theme].text }}>Password</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`futuristic-input ${error && error.includes('password') ? 'is-invalid' : ''}`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      style={{
                        background: `${chartColors[theme].background}aa`,
                        color: chartColors[theme].text,
                        border: `1px solid ${chartColors[theme].text}33`,
                        borderRadius: '15px 0 0 15px',
                        padding: '0.75rem 1rem',
                        boxShadow: `0 0 10px ${chartColors[theme].text}22`,
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={togglePasswordVisibility}
                      disabled={isLoading}
                      style={{
                        borderRadius: '0 15px 15px 0',
                        border: `1px solid ${chartColors[theme].text}33`,
                        background: chartColors[theme].card,
                        color: chartColors[theme].text,
                        padding: '0.75rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </Button>
                  </div>
                </Form.Group>

                {isLogin && (
                  <div className="mb-4 text-center">
                    <Button
                      variant="link"
                      className="text-decoration-none futuristic-btn"
                      onClick={handleForgotPassword}
                      disabled={isLoading}
                      style={{ 
                        color: chartColors[theme].primary,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Forgot Password?
                    </Button>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="btn futuristic-btn w-100"
                  disabled={isLoading}
                  style={{ 
                    background: `linear-gradient(45deg, ${chartColors[theme].primary}, ${chartColors[theme].primary}aa)`,
                    border: 'none',
                    borderRadius: '25px',
                    padding: '0.75rem 1rem',
                    color: chartColors[theme].text,
                    boxShadow: `0 0 15px ${chartColors[theme].primary}66`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isLoading ? (
                    <>
                      <FaSpinner className="me-2 spin" />
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    isLogin ? 'Sign In' : 'Sign Up'
                  )}
                </Button>

                <p className="text-center mt-4">
                  <Button
                    variant="link"
                    className="text-decoration-none futuristic-btn"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                      setResetMessage('');
                    }}
                    disabled={isLoading}
                    style={{ 
                      color: chartColors[theme].primary,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {isLogin 
                      ? "Don't have an account? Sign Up" 
                      : 'Already have an account? Sign In'}
                  </Button>
                </p>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <style>
        {`
          .auth-container {
            font-family: 'Poppins', sans-serif;
            position: relative;
            overflow: hidden;
          }
          .particles .particle {
            position: absolute;
            width: 12px;
            height: 12px;
            background: ${chartColors[theme].text}33;
            border-radius: 50%;
            opacity: 0.5;
          }
          .particles .particle:nth-child(1) { top: 20%; left: 30%; }
          .particles .particle:nth-child(2) { top: 50%; left: 70%; }
          .particles .particle:nth-child(3) { top: 80%; left: 20%; }
          .futuristic-input:focus, .futuristic-btn:hover {
            box-shadow: 0 0 20px ${chartColors[theme].primary}66;
            transform: scale(1.02);
          }
          .futuristic-btn {
            position: relative;
            overflow: hidden;
          }
          .futuristic-btn::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: width 0.6s ease, height 0.6s ease;
          }
          .futuristic-btn:hover::after {
            width: 200%;
            height: 200%;
          }
          .card {
            transition: all 0.3s ease;
          }
          .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px ${chartColors[theme].text}33;
          }
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
          @keyframes pulseText {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.02); opacity: 0.9; }
          }
          .logo {
            display: inline-block;
            transition: transform 0.3s ease;
          }
          .logo:hover {
            transform: scale(1.2) rotate(360deg);
          }
          @media (max-width: 768px) {
            .auth-container { padding: 10px; }
            .card { margin: 0 10px; }
          }
        `}
      </style>
    </Container>
  );
};

export default AuthComponent;