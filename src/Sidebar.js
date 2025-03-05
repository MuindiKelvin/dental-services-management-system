import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaCalendar, 
  FaWallet, 
  FaBell, 
  FaSearch, 
  FaChevronDown,
  FaChevronUp,
  FaUserMd,
  FaSignOutAlt,
  FaPalette,
  FaCog
} from 'react-icons/fa';
import { Modal, Button, Card, Col, Row } from 'react-bootstrap';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const Sidebar = () => {
  const [theme, setTheme] = useState('light');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [isPatientsOpen, setIsPatientsOpen] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [chartColors, setChartColors] = useState({
    light: {
      background: '#ffffff',
      text: '#333333',
      card: '#f8f9fa',
      gradientStart: '#e6f0fa',
      gradientEnd: '#ffffff',
      active: '#007bff'
    },
    dark: {
      background: '#1a1a1a',
      text: '#ffffff',
      card: '#2d2d2d',
      gradientStart: '#2c3e50',
      gradientEnd: '#1a1a1a',
      active: '#1e90ff'
    },
    cosmic: {
      background: '#0a0a23',
      text: '#ffffff',
      card: '#1a1a3d',
      gradientStart: '#1a1a3d',
      gradientEnd: '#0a0a23',
      active: '#00ffff'
    }
  });

  const themes = {
    light: { name: 'Light', icon: '☀️', description: 'Bright and clean interface' },
    dark: { name: 'Dark', icon: '🌙', description: 'Sleek and modern dark mode' },
    cosmic: { name: 'Cosmic', icon: '✨', description: 'Vibrant sci-fi aesthetic' }
  };

  // Real-time listener for unread notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const unreadCount = snapshot.docs.filter(doc => !doc.data().read).length;
      setNotificationsCount(unreadCount);
      console.log(`Unread Notifications Count: ${unreadCount}`); // Debug log
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setNotificationsCount(0); // Fallback to 0 on error
    });

    return () => unsubscribe();
  }, []);

  // Apply theme changes
  useEffect(() => {
    document.body.style.backgroundColor = chartColors[theme].background;
    document.body.style.color = chartColors[theme].text;
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const mainMenu = [
    { path: '/dashboard', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { path: '/appointments', icon: <FaCalendar />, label: 'Appointments' },
    { path: '/payments', icon: <FaWallet />, label: 'Payments' },
    { 
      path: '/notifications', 
      icon: <FaBell />, 
      label: 'Notifications',
      badge: notificationsCount > 0 ? notificationsCount : null // Show badge only if > 0
    },
  ];

  const patientMenu = [
    { path: '/patients/records', icon: <FaUserMd />, label: 'Patient Records' },
  ];

  const filteredMainMenu = mainMenu.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="sidebar animate__animated animate__fadeInLeft"
      style={{ 
        width: '280px',
        transition: 'all 0.3s',
        position: 'fixed',
        boxShadow: `2px 0 10px ${chartColors[theme].text}11`,
        zIndex: 1000,
        background: chartColors[theme].card,
        color: chartColors[theme].text,
        height: '100vh'
      }}
    >
      <div className="p-4">
        <h4 
          className="d-flex align-items-center gap-2"
          style={{ animation: 'pulseText 2s infinite' }}
        >
          <span className="brand-logo">🦷</span>
          Berkshire Dental
        </h4>

        <div className="position-relative my-3">
          <FaSearch className="position-absolute top-50 start-0 translate-middle-y ms-3" style={{ color: chartColors[theme].text }} />
          <input
            type="text"
            className="form-control futuristic-input ps-5"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              borderRadius: '25px',
              background: `${chartColors[theme].background}aa`,
              color: chartColors[theme].text,
              border: `1px solid ${chartColors[theme].text}33`,
              boxShadow: `0 0 10px ${chartColors[theme].text}22`
            }}
          />
        </div>

        <ul className="nav flex-column gap-2">
          {filteredMainMenu.map((item) => (
            <li className="nav-item" key={item.path}>
              <NavLink
                className={({ isActive }) => `
                  nav-link d-flex align-items-center gap-2
                  ${isActive ? 'active' : ''}
                  py-2 px-3
                `}
                to={item.path}
                style={{
                  color: chartColors[theme].text,
                  background: location.pathname === item.path ? `${chartColors[theme].active}33` : 'transparent',
                  borderRadius: '25px',
                  transition: 'all 0.3s ease'
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="badge bg-danger ms-auto rounded-pill">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}

          <li className="nav-item mt-2">
            <button
              className="nav-link d-flex align-items-center justify-content-between w-100 py-2 px-3 hover-bg"
              onClick={() => setIsPatientsOpen(!isPatientsOpen)}
              style={{ color: chartColors[theme].text }}
            >
              <div className="d-flex align-items-center gap-2">
                <FaUserMd />
                Patients
              </div>
              {isPatientsOpen ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {isPatientsOpen && (
              <ul className="nav flex-column ms-3 mt-1 animate__animated animate__fadeIn">
                {patientMenu.map((item) => (
                  <li className="nav-item" key={item.path}>
                    <NavLink
                      className={({ isActive }) => `
                        nav-link d-flex align-items-center gap-2
                        ${isActive ? 'active' : ''}
                        py-1 px-3
                      `}
                      to={item.path}
                      style={{
                        color: chartColors[theme].text,
                        background: location.pathname === item.path ? `${chartColors[theme].active}33` : 'transparent',
                        borderRadius: '25px',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>

      <div 
        className="position-absolute bottom-0 w-100 p-3 border-top"
        style={{ background: chartColors[theme].card, borderColor: `${chartColors[theme].text}33` }}
      >
        <div className="icon-label-wrapper">
          <Button
            className="btn w-100 d-flex align-items-center justify-content-center gap-2 futuristic-btn mb-2"
            onClick={() => setShowThemeModal(true)}
            style={{ 
              borderColor: chartColors[theme].text,
              color: chartColors[theme].text,
              background: `${chartColors[theme].card}aa`,
              boxShadow: `0 0 10px ${chartColors[theme].text}33`,
              transition: 'all 0.3s ease'
            }}
          >
            <FaPalette /> {themes[theme].icon}
          </Button>
          <span className="icon-label">Themes</span>
        </div>
        <div className="icon-label-wrapper">
          <Button
            className="btn w-100 d-flex align-items-center justify-content-center gap-2 futuristic-btn mb-2"
            onClick={handleLogout}
            style={{ 
              borderColor: chartColors[theme].text,
              color: chartColors[theme].text,
              background: `${chartColors[theme].card}aa`,
              boxShadow: `0 0 10px ${chartColors[theme].text}33`,
              transition: 'all 0.3s ease'
            }}
          >
            <FaSignOutAlt />
            Logout
          </Button>
          <span className="icon-label">Sign Out</span>
        </div>
        <div className="text-center" style={{ fontSize: '0.8rem', opacity: 0.7, color: chartColors[theme].text }}>
          © {new Date().getFullYear()} Kelvin Muindi for Berkshire Dental Clinic
        </div>
      </div>

      {/* Theme Selection Modal */}
      <Modal 
        show={showThemeModal} 
        onHide={() => setShowThemeModal(false)} 
        centered 
        style={{ '--bs-modal-bg': chartColors[theme].card }}
      >
        <Modal.Header closeButton style={{ borderBottom: `1px solid ${chartColors[theme].text}33` }}>
          <Modal.Title style={{ fontSize: '18px', color: chartColors[theme].text }}>Select Theme</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: chartColors[theme].card, padding: '20px' }}>
          <Row>
            {Object.entries(themes).map(([key, { name, icon, description }]) => (
              <Col xs={12} className="mb-3" key={key}>
                <Card 
                  className="theme-card animate__animated animate__fadeIn"
                  style={{ 
                    background: `linear-gradient(135deg, ${chartColors[key].gradientStart}, ${chartColors[key].gradientEnd})`,
                    border: theme === key ? `2px solid ${chartColors[key].active}` : 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => setTheme(key)}
                >
                  <Card.Body className="d-flex align-items-center p-3">
                    <div 
                      className="theme-preview"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: chartColors[key].card,
                        marginRight: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        boxShadow: `0 0 10px ${chartColors[key].text}33`
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <h5 style={{ color: chartColors[key].text, margin: 0 }}>{name}</h5>
                      <p style={{ color: `${chartColors[key].text}cc`, fontSize: '12px', margin: 0 }}>{description}</p>
                    </div>
                  </Card.Body>
                  {theme === key && (
                    <div 
                      className="active-indicator"
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        width: '10px',
                        height: '10px',
                        background: chartColors[key].active,
                        borderRadius: '50%',
                        boxShadow: `0 0 5px ${chartColors[key].active}`
                      }}
                    />
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: `1px solid ${chartColors[theme].text}33` }}>
          <Button 
            variant="secondary" 
            className="rounded-pill" 
            onClick={() => setShowThemeModal(false)}
            style={{ 
              fontSize: '12px', 
              padding: '5px 10px',
              background: `${chartColors[theme].text}33`,
              border: 'none',
              color: chartColors[theme].text
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <style>
        {`
          .sidebar {
            overflow-y: auto;
            scrollbar-width: thin;
          }
          .hover-bg:hover {
            background-color: ${chartColors[theme].text}11;
            border-radius: 25px;
            transition: all 0.2s;
          }
          .nav-link.active {
            background-color: ${chartColors[theme].active}33;
            color: ${chartColors[theme].text} !important;
            font-weight: 600;
          }
          .futuristic-input:focus, .futuristic-btn:hover {
            box-shadow: 0 0 15px ${chartColors[theme].text}66;
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
          .futuristic-btn:hover {
            transform: scale(1.05);
          }
          .icon-label-wrapper {
            position: relative;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
          }
          .icon-label {
            font-size: 10px;
            color: ${chartColors[theme].text}cc;
            margin-top: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .brand-logo {
            transition: transform 0.3s;
          }
          .brand-logo:hover {
            transform: rotate(360deg);
          }
          .theme-card:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px ${chartColors[theme].text}33;
          }
          @keyframes pulseText {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.02); opacity: 0.9; }
          }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { 
            background: ${chartColors[theme].text}66; 
            border-radius: 5px; 
          }
        `}
      </style>
    </div>
  );
};

export default Sidebar;