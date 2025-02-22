import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Container, Row, Col, Card, Form, Button, Modal } from 'react-bootstrap';
import { FaChartLine, FaDownload, FaFilter, FaCog, FaPalette } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'animate.css';
import 'bootstrap/dist/css/bootstrap.min.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AnalyticsComponent = () => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [theme, setTheme] = useState('light');
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [chartColors, setChartColors] = useState({
    light: {
      revenue: '#007bff',
      status: ['#dc3545', '#28a745', '#6c757d'],
      background: '#ffffff',
      text: '#333333',
      card: '#f8f9fa',
      gradientStart: '#e6f0fa',
      gradientEnd: '#ffffff'
    },
    dark: {
      revenue: '#1e90ff',
      status: ['#ff4444', '#34c759', '#a9a9a9'],
      background: '#1a1a1a',
      text: '#ffffff',
      card: '#2d2d2d',
      gradientStart: '#2c3e50',
      gradientEnd: '#1a1a1a'
    },
    cosmic: {
      revenue: '#00ffff',
      status: ['#ff00ff', '#00ff9f', '#ffff00'],
      background: '#0a0a23',
      text: '#ffffff',
      card: '#1a1a3d',
      gradientStart: '#1a1a3d',
      gradientEnd: '#0a0a23'
    }
  });

  const themes = {
    light: { name: 'Light', icon: '☀️', description: 'Bright and clean analytics' },
    dark: { name: 'Dark', icon: '🌙', description: 'Sleek dark mode insights' },
    cosmic: { name: 'Cosmic', icon: '✨', description: 'Vibrant sci-fi analytics' }
  };

  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'bershire dental records'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAppointments(data);
      } catch (error) {
        toast.error('Error fetching analytics data');
        console.error(error);
      }
      setIsLoading(false);
    };
    fetchAppointments();
  }, []);

  const filterAppointmentsByTime = (apps) => {
    const now = new Date();
    switch (timeFilter) {
      case 'Today': return apps.filter(a => new Date(a.date).toDateString() === now.toDateString());
      case 'This Week': 
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return apps.filter(a => new Date(a.date) >= weekStart);
      case 'This Month': return apps.filter(a => new Date(a.date).getMonth() === now.getMonth() && new Date(a.date).getFullYear() === now.getFullYear());
      default: return apps;
    }
  };

  const filteredAppointments = filterAppointmentsByTime(appointments)
    .filter(a => serviceFilter === 'All' || a.service === serviceFilter);

  const revenueByService = filteredAppointments.reduce((acc, app) => {
    acc[app.service] = (acc[app.service] || 0) + (app.paymentStatus === 'Completed' ? app.payment : 0);
    return acc;
  }, {});
  const revenueChartData = {
    labels: Object.keys(revenueByService),
    datasets: [{
      label: 'Revenue (KSh)',
      data: Object.values(revenueByService),
      backgroundColor: chartColors[theme].revenue,
      borderRadius: 5,
      barThickness: 30,
      borderColor: `${chartColors[theme].revenue}cc`,
      borderWidth: 1
    }]
  };

  const statusDistribution = {
    Pending: filteredAppointments.filter(a => a.paymentStatus === 'Pending').length,
    Completed: filteredAppointments.filter(a => a.paymentStatus === 'Completed').length,
    'Not Required': filteredAppointments.filter(a => a.paymentStatus === 'Not Required').length
  };
  const pieChartData = {
    labels: Object.keys(statusDistribution),
    datasets: [{
      data: Object.values(statusDistribution),
      backgroundColor: chartColors[theme].status,
      borderColor: chartColors[theme].card,
      borderWidth: 2,
      hoverOffset: 8
    }]
  };

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top', 
        labels: { 
          usePointStyle: true, 
          font: { size: 10, family: "'Poppins', sans-serif" },
          color: chartColors[theme].text 
        } 
      },
      title: { 
        display: true, 
        font: { size: 12, family: "'Poppins', sans-serif" }, 
        color: chartColors[theme].text 
      },
      tooltip: { 
        backgroundColor: `${chartColors[theme].card}cc`, 
        padding: 8, 
        bodyFont: { size: 10 },
        titleColor: chartColors[theme].text,
        bodyColor: chartColors[theme].text 
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeOutElastic',
      delay: (context) => context.dataIndex * 100,
    },
  };

  const barChartOptions = {
    ...baseChartOptions,
    scales: {
      y: { 
        ticks: { font: { size: 10 }, color: chartColors[theme].text },
        grid: { color: `${chartColors[theme].text}22` }
      },
      x: { 
        ticks: { font: { size: 10 }, color: chartColors[theme].text },
        grid: { color: `${chartColors[theme].text}22` }
      },
    },
  };

  const pieChartOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      datalabels: {
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          return `${percentage}%`;
        },
        color: chartColors[theme].text,
        font: { size: 12 }
      }
    }
  };

  const exportToCSV = () => {
    const headers = 'Service,Total Appointments,Revenue (KSh),Status\n';
    const rows = filteredAppointments.map(a => 
      `${a.service},${1},${a.paymentStatus === 'Completed' ? a.payment : 0},${a.paymentStatus}`
    ).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${timeFilter.toLowerCase().replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Analytics exported');
  };

  const totalRevenue = filteredAppointments
    .filter(a => a.paymentStatus === 'Completed')
    .reduce((sum, a) => sum + a.payment, 0);
  const averagePayment = totalRevenue / (filteredAppointments.filter(a => a.paymentStatus === 'Completed').length || 1);

  return (
    <Container 
      fluid 
      className="main-content animate__animated animate__zoomIn" 
      style={{ 
        marginLeft: '280px', 
        padding: '15px', 
        minHeight: '100vh', 
        background: chartColors[theme].background,
        color: chartColors[theme].text,
        transition: 'all 0.3s ease'
      }}
    >
      <ToastContainer position="top-right" autoClose={3000} theme={theme === 'light' ? 'light' : 'dark'} />

      {/* Enhanced Header */}
      <Row 
        className="mb-4 align-items-center animate__animated animate__fadeInDown" 
        style={{ 
          background: `linear-gradient(135deg, ${chartColors[theme].gradientStart}, ${chartColors[theme].gradientEnd})`,
          borderRadius: '20px',
          padding: '15px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 10px 30px ${chartColors[theme].text}22`
        }}
      >
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

        <Col xs={12} style={{ zIndex: 1 }}>
          <h3 
            className="fw-bold d-flex align-items-center mb-3"
            style={{ 
              color: chartColors[theme].text,
              fontSize: '24px',
              textShadow: `0 2px 4px ${chartColors[theme].text}33`,
              letterSpacing: '1px',
              animation: 'pulseText 2s infinite'
            }}
          >
            <FaChartLine className="me-2" style={{ fontSize: '28px' }} /> 
            <span>Analytics Hub</span>
          </h3>
          <div className="d-flex justify-content-between gap-2 flex-wrap">
            <div className="icon-label-wrapper">
              <Form.Select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="rounded-pill shadow-sm futuristic-select"
                style={{ 
                  width: '150px', 
                  fontSize: '12px', 
                  padding: '8px 12px',
                  background: `linear-gradient(45deg, ${chartColors[theme].card}, ${chartColors[theme].gradientStart}88)`,
                  color: chartColors[theme].text,
                  border: 'none',
                  boxShadow: `0 0 10px ${chartColors[theme].text}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
              </Form.Select>
              <span className="icon-label">Time Filter</span>
            </div>
            <div className="icon-label-wrapper">
              <Form.Select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="rounded-pill shadow-sm futuristic-select"
                style={{ 
                  width: '150px', 
                  fontSize: '12px', 
                  padding: '8px 12px',
                  background: `linear-gradient(45deg, ${chartColors[theme].card}, ${chartColors[theme].gradientStart}88)`,
                  color: chartColors[theme].text,
                  border: 'none',
                  boxShadow: `0 0 10px ${chartColors[theme].text}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                <option value="All">All Services</option>
                {[...new Set(appointments.map(a => a.service))].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
              <span className="icon-label">Service Filter</span>
            </div>
            <div className="icon-label-wrapper">
              <Button 
                variant="outline-success" 
                className="rounded-pill shadow-sm futuristic-btn"
                onClick={exportToCSV}
                style={{ 
                  fontSize: '12px', 
                  padding: '8px 15px',
                  borderColor: chartColors[theme].revenue,
                  color: chartColors[theme].revenue,
                  background: `${chartColors[theme].card}aa`,
                  boxShadow: `0 0 10px ${chartColors[theme].revenue}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                <FaDownload />
              </Button>
              <span className="icon-label">Export</span>
            </div>
            <div className="icon-label-wrapper">
              <Button 
                variant="outline-secondary" 
                className="rounded-pill shadow-sm futuristic-btn"
                onClick={() => setShowSettings(true)}
                style={{ 
                  fontSize: '12px', 
                  padding: '8px 15px',
                  borderColor: chartColors[theme].text,
                  color: chartColors[theme].text,
                  background: `${chartColors[theme].card}aa`,
                  boxShadow: `0 0 10px ${chartColors[theme].text}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                <FaCog />
              </Button>
              <span className="icon-label">Settings</span>
            </div>
            <div className="icon-label-wrapper">
              <Button 
                variant="outline-primary" 
                className="rounded-pill shadow-sm futuristic-btn"
                onClick={() => setShowThemeModal(true)}
                style={{ 
                  fontSize: '12px', 
                  padding: '8px 15px',
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
          </div>
        </Col>
      </Row>

      {/* Analytics Content */}
      <Row className="g-4">
        {[
          { title: 'Total Revenue', value: `KSh ${totalRevenue.toLocaleString()}`, color: chartColors[theme].revenue },
          { title: 'Average Payment', value: `KSh ${averagePayment.toLocaleString()}`, color: chartColors[theme].status[1] }
        ].map((insight, index) => (
          <Col md={6} key={index}>
            <Card 
              className="shadow-sm text-center animate__animated animate__zoomIn"
              style={{ 
                background: `linear-gradient(145deg, ${chartColors[theme].card}, ${insight.color}22)`,
                border: 'none',
                borderRadius: '15px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
            >
              <div 
                className="insight-glow"
                style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: `radial-gradient(circle, ${insight.color}33, transparent 70%)`,
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }}
              />
              <Card.Body className="p-3">
                <h5 
                  style={{ 
                    color: chartColors[theme].text, 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px',
                    fontSize: '14px'
                  }}
                >
                  {insight.title}
                </h5>
                <h3 
                  style={{ 
                    color: chartColors[theme].text, 
                    fontWeight: 700, 
                    fontSize: '24px',
                    textShadow: `0 2px 4px ${insight.color}66`
                  }}
                >
                  {insight.value}
                </h3>
              </Card.Body>
            </Card>
          </Col>
        ))}

        <Col md={6}>
          <Card 
            className="shadow-sm" 
            style={{ 
              background: chartColors[theme].card, 
              border: 'none', 
              borderRadius: '15px',
              transition: 'all 0.3s ease'
            }}
          >
            <Card.Body className="p-3">
              <h5 style={{ color: chartColors[theme].text, fontSize: '14px' }}>Revenue by Service</h5>
              {isLoading ? (
                <div className="text-center py-5">
                  <span className="spinner-border spinner-border-lg" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div style={{ height: '300px' }}>
                  <Bar 
                    data={revenueChartData} 
                    options={{ 
                      ...barChartOptions, 
                      plugins: { ...barChartOptions.plugins, title: { text: 'Revenue by Service' } } 
                    }} 
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card 
            className="shadow-sm" 
            style={{ 
              background: chartColors[theme].card, 
              border: 'none', 
              borderRadius: '15px',
              transition: 'all 0.3s ease'
            }}
          >
            <Card.Body className="p-3">
              <h5 style={{ color: chartColors[theme].text, fontSize: '14px' }}>Payment Status Distribution</h5>
              {isLoading ? (
                <div className="text-center py-5">
                  <span className="spinner-border spinner-border-lg" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div style={{ height: '300px' }}>
                  <Pie 
                    data={pieChartData} 
                    options={{ 
                      ...pieChartOptions, 
                      plugins: { ...pieChartOptions.plugins, title: { text: 'Payment Status Distribution' } } 
                    }} 
                  />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Settings Modal */}
      <Modal 
        show={showSettings} 
        onHide={() => setShowSettings(false)} 
        centered 
        size="sm"
        style={{ '--bs-modal-bg': chartColors[theme].card }}
      >
        <Modal.Header closeButton style={{ borderBottom: `1px solid ${chartColors[theme].text}33` }}>
          <Modal.Title style={{ fontSize: '16px', color: chartColors[theme].text }}>Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: chartColors[theme].card }}>
          <Form>
            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12px', color: chartColors[theme].text }}>Revenue Color</Form.Label>
              <Form.Control
                type="color"
                value={chartColors[theme].revenue}
                onChange={(e) => setChartColors({ 
                  ...chartColors, 
                  [theme]: { ...chartColors[theme], revenue: e.target.value } 
                })}
                style={{ width: '80px' }}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12px', color: chartColors[theme].text }}>Status Colors</Form.Label>
              {chartColors[theme].status.map((color, idx) => (
                <Form.Control
                  key={idx}
                  type="color"
                  value={color}
                  onChange={(e) => {
                    const newColors = [...chartColors[theme].status];
                    newColors[idx] = e.target.value;
                    setChartColors({ ...chartColors, [theme]: { ...chartColors[theme], status: newColors } });
                  }}
                  className="mb-1"
                  style={{ width: '80px', display: 'inline-block', marginRight: '5px' }}
                />
              ))}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: `1px solid ${chartColors[theme].text}33` }}>
          <Button 
            variant="secondary" 
            className="rounded-pill" 
            onClick={() => setShowSettings(false)}
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
                    border: theme === key ? `2px solid ${chartColors[key].revenue}` : 'none',
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
                        background: chartColors[key].revenue,
                        borderRadius: '50%',
                        boxShadow: `0 0 5px ${chartColors[key].revenue}`
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
          .main-content { 
            font-family: 'Poppins', sans-serif;
            background: ${chartColors[theme].background};
            transition: all 0.3s ease;
            width: calc(100% - 280px);
          }
          .futuristic-select, .futuristic-btn {
            position: relative;
            overflow: hidden;
          }
          .futuristic-select:hover, .futuristic-btn:hover { 
            transform: scale(1.05); 
            box-shadow: 0 0 15px ${chartColors[theme].text}66;
          }
          .futuristic-btn::after, .futuristic-select::after {
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
          .futuristic-btn:hover::after, .futuristic-select:hover::after {
            width: 200%;
            height: 200%;
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
            letterSpacing: 1px;
          }
          .particles .particle {
            position: absolute;
            width: 10px;
            height: 10px;
            background: ${chartColors[theme].text}33;
            border-radius: 50%;
            opacity: 0.5;
          }
          .particles .particle:nth-child(1) { top: 20%; left: 30%; }
          .particles .particle:nth-child(2) { top: 50%; left: 70%; }
          .particles .particle:nth-child(3) { top: 80%; left: 20%; }
          .card { 
            border-radius: 15px; 
            transition: all 0.3s ease; 
          }
          .card:hover { 
            transform: translateY(-5px); 
            box-shadow: 0 12px 25px ${chartColors[theme].text}33 !important;
          }
          .card:hover .insight-glow {
            opacity: 0.5;
          }
          .theme-card:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 15px ${chartColors[theme].text}33;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
          @keyframes pulseText {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.02); opacity: 0.9; }
          }
          @media (max-width: 768px) {
            .main-content { margin-left: 0; width: 100%; }
          }
        `}
      </style>
    </Container>
  );
};

export default AnalyticsComponent;