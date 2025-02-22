import React, { useState, useEffect } from 'react';
import { Pie, Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Container, Row, Col, Card, Form, Button, Modal, Dropdown } from 'react-bootstrap';
import { FaTachometerAlt, FaDownload, FaChartBar, FaMoneyBillWave, FaCalendarCheck, FaUserMd, FaChartLine, FaCog, FaMapMarkerAlt, FaStar, FaClock, FaDesktop, FaPalette } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'animate.css';
import 'bootstrap/dist/css/bootstrap.min.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, annotationPlugin);

const DashboardComponent = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('This Month');
  const [locationFilter, setLocationFilter] = useState('All');
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [theme, setTheme] = useState('light');

  const [chartColors, setChartColors] = useState({
    light: {
      status: { attended: '#28a745', unattended: '#dc3545' },
      location: ['#007bff', '#28a745', '#dc3545', '#ffc107'],
      revenue: '#28a745',
      background: '#ffffff',
      text: '#333333',
      card: '#f8f9fa',
      gradientStart: '#e6f0fa',
      gradientEnd: '#ffffff'
    },
    dark: {
      status: { attended: '#34c759', unattended: '#ff4444' },
      location: ['#1e90ff', '#34c759', '#ff4444', '#ffd700'],
      revenue: '#34c759',
      background: '#1a1a1a',
      text: '#ffffff',
      card: '#2d2d2d',
      gradientStart: '#2c3e50',
      gradientEnd: '#1a1a1a'
    },
    cosmic: {
      status: { attended: '#00ff9f', unattended: '#ff00ff' },
      location: ['#00ffff', '#00ff9f', '#ff00ff', '#ffff00'],
      revenue: '#00ff9f',
      background: '#0a0a23',
      text: '#ffffff',
      card: '#1a1a3d',
      gradientStart: '#1a1a3d',
      gradientEnd: '#0a0a23'
    }
  });

  const themes = {
    light: { name: 'Light', icon: '☀️', description: 'Bright and clean interface' },
    dark: { name: 'Dark', icon: '🌙', description: 'Sleek and modern dark mode' },
    cosmic: { name: 'Cosmic', icon: '✨', description: 'Vibrant sci-fi aesthetic' }
  };

  const locations = ['All', 'Tassia-Magic Square', 'Machakos', 'Tassia-Hill'];

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    if (typeof timestamp === 'string' && timestamp.includes(' at ')) {
      return timestamp;
    }
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date detected: ${timestamp}`);
      return 'Invalid Date';
    }
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    };
    return date.toLocaleString('en-US', options).replace(/,/, ' at');
  };

  const formatDateForChart = (dateString) => {
    const [datePart] = dateString.split(' at ');
    return datePart;
  };

  useEffect(() => {
    setIsLoading(true);
    const unsubscribeAppointments = onSnapshot(collection(db, 'bershire dental records'), (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const docData = doc.data();
        const paymentStatus = docData.paymentStatus === 'Attended' ? 'Attended' : 'Unattended';
        return {
          id: doc.id,
          ...docData,
          date: formatDate(docData.date),
          paymentDate: docData.paymentDate ? formatDate(docData.paymentDate) : null,
          paymentStatus,
        };
      });
      setAppointments(data);
    });

    const unsubscribePatients = onSnapshot(collection(db, 'patient_records'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPatients(data);
    });

    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(5));
    const unsubscribeActivities = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: formatDate(doc.data().timestamp),
      }));
      setSystemActivities(data);
      setIsLoading(false);
    });

    return () => {
      unsubscribeAppointments();
      unsubscribePatients();
      unsubscribeActivities();
    };
  }, []);

  const filterAppointments = (apps) => {
    const now = new Date();
    let filtered = apps;
    switch (timeFilter) {
      case 'Today':
        filtered = apps.filter((a) => new Date(a.date).toDateString() === now.toDateString());
        break;
      case 'This Week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        filtered = apps.filter((a) => new Date(a.date) >= weekStart);
        break;
      case 'This Month':
        filtered = apps.filter(
          (a) => new Date(a.date).getMonth() === now.getMonth() && new Date(a.date).getFullYear() === now.getFullYear()
        );
        break;
      default:
        break;
    }
    return locationFilter === 'All' ? filtered : filtered.filter((a) => a.location === locationFilter);
  };

  const filteredAppointments = filterAppointments(appointments);

  const totalAppointments = filteredAppointments.length;
  const totalRevenue = filteredAppointments
    .filter((a) => a.paymentStatus === 'Attended')
    .reduce((sum, a) => sum + a.payment, 0);
  const unattendedAppointments = filteredAppointments.filter((a) => a.paymentStatus === 'Unattended').length;
  const attendedPatients = patients.filter((p) => p.attended).length;
  const totalPatients = patients.length;

  const topServices = Object.entries(
    filteredAppointments.reduce((acc, a) => {
      acc[a.service] = (acc[a.service] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const statusChartData = () => {
    const attendedCount = filteredAppointments.filter(a => a.paymentStatus === 'Attended').length;
    const unattendedCount = filteredAppointments.filter(a => a.paymentStatus === 'Unattended').length;
    const total = attendedCount + unattendedCount;

    return {
      labels: ['Attended', 'Unattended'],
      datasets: [{
        data: [attendedCount, unattendedCount],
        backgroundColor: [
          chartColors[theme].status.attended,
          chartColors[theme].status.unattended
        ],
        borderColor: chartColors[theme].card,
        borderWidth: 2,
      }],
    };
  };

  const revenueTrendData = () => {
    const dailyRevenue = {};
    filteredAppointments.forEach((a) => {
      if (a.paymentStatus === 'Attended') {
        const fullDate = a.paymentDate || a.date;
        const datePart = formatDateForChart(fullDate);
        dailyRevenue[datePart] = (dailyRevenue[datePart] || 0) + a.payment;
      }
    });
    const dates = Object.keys(dailyRevenue).sort((a, b) => new Date(a) - new Date(b));
    const values = dates.map(date => dailyRevenue[date]);
    const maxRevenue = Math.max(...values);
    const maxDate = dates[values.indexOf(maxRevenue)];

    return {
      labels: dates,
      datasets: [{
        label: 'Revenue (KSh)',
        data: values,
        borderColor: chartColors[theme].revenue,
        backgroundColor: `${chartColors[theme].revenue}33`,
        fill: true,
        tension: 0.4,
        pointStyle: 'star',
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 2,
      }],
      plugins: {
        annotation: {
          annotations: {
            peakPoint: {
              type: 'point',
              xValue: maxDate,
              yValue: maxRevenue,
              backgroundColor: '#ff4500',
              radius: 8,
              label: {
                content: `Peak: KSh ${maxRevenue.toLocaleString()}`,
                enabled: true,
                position: 'top',
                font: { size: 10, style: 'italic' },
                color: chartColors[theme].text,
              },
            },
          },
        },
      },
    };
  };

  const locationChartData = () => {
    const dailyData = {};
    filteredAppointments.forEach((a) => {
      const fullDate = a.date;
      const datePart = formatDateForChart(fullDate);
      dailyData[datePart] = dailyData[datePart] || {};
      dailyData[datePart][a.location] = (dailyData[datePart][a.location] || 0) + 1;
    });
    const dates = Object.keys(dailyData).sort((a, b) => new Date(a) - new Date(b));

    return {
      labels: dates,
      datasets: locations.slice(1).map((loc, idx) => ({
        label: loc,
        data: dates.map(date => dailyData[date][loc] || 0),
        backgroundColor: chartColors[theme].location[idx],
        borderColor: `${chartColors[theme].location[idx]}cc`,
        borderWidth: 1,
      })),
    };
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

  const lineChartOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      annotation: { annotations: revenueTrendData().plugins?.annotation?.annotations || {} },
    },
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

  const barChartOptions = {
    ...baseChartOptions,
    scales: {
      y: { 
        ticks: { font: { size: 10 }, color: chartColors[theme].text },
        grid: { color: `${chartColors[theme].text}22` },
        stacked: true
      },
      x: { 
        ticks: { font: { size: 10 }, color: chartColors[theme].text },
        grid: { color: `${chartColors[theme].text}22` },
        stacked: true
      },
    },
  };

  const exportToCSV = () => {
    const headers = 'Patient,Date,Service,Amount (KSh),Status,Location,Attended\n';
    const rows = filteredAppointments
      .map((a) => {
        const patient = patients.find((p) => p.name === a.patientName);
        return `${a.patientName},${a.date},${a.service},${a.payment},${a.paymentStatus},${a.location || '-'},${
          patient ? (patient.attended ? 'Yes' : 'No') : 'Unknown'
        }`;
      })
      .join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_${timeFilter.toLowerCase().replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Dashboard data exported successfully');
  };

  const recentActivity = filteredAppointments
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)
    .map((a) => ({
      time: a.date,
      action: `${a.patientName} - ${a.service}`,
    }));

  return (
    <Container 
      fluid 
      className="main-content animate__animated animate__zoomIn" 
      style={{ 
        marginLeft: '280px', 
        padding: '15px', 
        height: '100vh', 
        overflow: 'hidden',
        background: chartColors[theme].background,
        color: chartColors[theme].text,
        transition: 'all 0.3s ease'
      }}
    >
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        theme={theme === 'light' ? 'light' : 'dark'}
      />

      {/* Enhanced Header and KPI Section */}
      <Row 
        className="mb-2 align-items-center animate__animated animate__fadeInDown" 
        style={{ 
          height: '30%', 
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

        <Col xs={12} className="mb-2" style={{ zIndex: 1 }}>
          <h4 
            className="fw-bold text-primary d-flex align-items-center mb-3"
            style={{ 
              color: chartColors[theme].text,
              fontSize: '24px',
              textShadow: `0 2px 4px ${chartColors[theme].text}33`,
              letterSpacing: '1px',
              animation: 'pulseText 2s infinite'
            }}
          >
            <FaTachometerAlt className="me-2" style={{ fontSize: '28px' }} /> 
            <span>Berkshire Dental Clinic Dashboard</span>
          </h4>
          <div className="d-flex justify-content-between gap-2 flex-wrap">
            <div className="icon-label-wrapper">
              <Form.Select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="rounded-pill shadow-sm futuristic-select"
                style={{ 
                  width: '120px', 
                  fontSize: '12px', 
                  padding: '8px 12px',
                  background: `linear-gradient(45deg, ${chartColors[theme].card}, ${chartColors[theme].gradientStart}88)`,
                  color: chartColors[theme].text,
                  border: 'none',
                  boxShadow: `0 0 10px ${chartColors[theme].text}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                <option value="All">All</option>
                <option value="Today">Today</option>
                <option value="This Week">Week</option>
                <option value="This Month">Month</option>
              </Form.Select>
              <span className="icon-label">Time Filter</span>
            </div>
            <div className="icon-label-wrapper">
              <Form.Select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-pill shadow-sm futuristic-select"
                style={{ 
                  width: '120px', 
                  fontSize: '12px', 
                  padding: '8px 12px',
                  background: `linear-gradient(45deg, ${chartColors[theme].card}, ${chartColors[theme].gradientStart}88)`,
                  color: chartColors[theme].text,
                  border: 'none',
                  boxShadow: `0 0 10px ${chartColors[theme].text}33`,
                  transition: 'all 0.3s ease'
                }}
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </Form.Select>
              <span className="icon-label">Location</span>
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
        {[
          { icon: FaChartBar, title: 'Appointments', value: totalAppointments, color: chartColors[theme].location[0] },
          { icon: FaMoneyBillWave, title: 'Revenue', value: `KSh ${totalRevenue.toLocaleString()}`, color: chartColors[theme].revenue },
          { icon: FaCalendarCheck, title: 'Unattended', value: unattendedAppointments, color: chartColors[theme].status.unattended },
          { icon: FaUserMd, title: 'Patients', value: `${attendedPatients}/${totalPatients}`, color: chartColors[theme].location[1] }
        ].map((kpi, index) => (
          <Col xs={3} key={index}>
            <Card 
              className="shadow-sm text-center kpi-card animate__animated animate__zoomIn"
              style={{ 
                height: '80%', 
                background: `linear-gradient(145deg, ${chartColors[theme].card}, ${kpi.color}22)`,
                border: 'none',
                borderRadius: '15px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                zIndex: 1
              }}
            >
              <div 
                className="kpi-glow"
                style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: `radial-gradient(circle, ${kpi.color}33, transparent 70%)`,
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }}
              />
              <Card.Body className="p-2 d-flex flex-column justify-content-center">
                <kpi.icon 
                  className="fs-3 mb-2 animate__animated animate__rotateIn"
                  style={{ 
                    color: kpi.color,
                    filter: `drop-shadow(0 0 5px ${kpi.color}66)`
                  }} 
                />
                <Card.Text 
                  style={{ 
                    fontSize: '12px', 
                    marginBottom: '5px', 
                    color: chartColors[theme].text,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  {kpi.title}
                </Card.Text>
                <Card.Text 
                  className="kpi-value"
                  style={{ 
                    fontSize: '20px', 
                    fontWeight: 700, 
                    color: chartColors[theme].text,
                    textShadow: `0 2px 4px ${kpi.color}66`
                  }}
                >
                  {kpi.value}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-2 mb-2" style={{ height: '20%' }}>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title className="d-flex align-items-center" style={{ fontSize: '14px', color: chartColors[theme].text }}>
                <FaStar className="me-1" style={{ color: chartColors[theme].status.attended }} /> Top Services
              </Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <ul className="list-unstyled" style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '12px', color: chartColors[theme].text }}>
                  {topServices.map(([service, count], idx) => (
                    <li key={service} className="d-flex justify-content-between mb-1 animate__animated animate__fadeIn">
                      <span>{idx + 1}. {service.slice(0, 15)}{service.length > 15 ? '...' : ''}</span>
                      <span className="badge rounded-pill" style={{ background: chartColors[theme].location[idx % 4] }}>{count}</span>
                    </li>
                  ))}
                  {topServices.length === 0 && <p>No services</p>}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title className="d-flex align-items-center" style={{ fontSize: '14px', color: chartColors[theme].text }}>
                <FaClock className="me-1" style={{ color: chartColors[theme].status.unattended }} /> Recent Activity
              </Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <ul className="list-unstyled" style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '12px', color: chartColors[theme].text }}>
                  {recentActivity.map((activity, idx) => (
                    <li key={idx} className="mb-1 animate__animated animate__fadeIn">
                      <small style={{ color: `${chartColors[theme].text}99` }}>{activity.time.split(' at ')[0]}</small>
                      <p style={{ margin: '0' }}>{activity.action.slice(0, 20)}{activity.action.length > 20 ? '...' : ''}</p>
                    </li>
                  ))}
                  {recentActivity.length === 0 && <p>No activity</p>}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title className="d-flex align-items-center" style={{ fontSize: '14px', color: chartColors[theme].text }}>
                <FaDesktop className="me-1" style={{ color: chartColors[theme].location[2] }} /> System Activities
              </Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div 
                  className="scrolling-container" 
                  style={{ 
                    maxHeight: '80px', 
                    overflow: 'hidden', 
                    position: 'relative',
                    fontSize: '12px',
                    color: chartColors[theme].text 
                  }}
                >
                  <ul 
                    className="list-unstyled scrolling-list"
                    style={{ 
                      margin: 0, 
                      padding: 0,
                      animation: 'scrollUp 10s linear infinite'
                    }}
                  >
                    {systemActivities.map((activity) => (
                      <li key={activity.id} className="mb-1">
                        <small style={{ color: `${chartColors[theme].text}99` }}>{activity.timestamp.split(' at ')[0]}</small>
                        <p style={{ margin: '0' }}>{activity.message.slice(0, 20)}{activity.message.length > 20 ? '...' : ''}</p>
                      </li>
                    ))}
                    {systemActivities.length === 0 && <li>No activities</li>}
                  </ul>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-2" style={{ height: '50%' }}>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title style={{ fontSize: '14px', color: chartColors[theme].text }}>Appointment Status</Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div style={{ height: '200px' }}>
                  <Pie data={statusChartData()} options={pieChartOptions} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title style={{ fontSize: '14px', color: chartColors[theme].text }}>Location Distribution</Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div style={{ height: '200px' }}>
                  <Bar data={locationChartData()} options={barChartOptions} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xs={4}>
          <Card className="shadow-sm" style={{ height: '100%', background: chartColors[theme].card, border: 'none' }}>
            <Card.Body className="p-2">
              <Card.Title style={{ fontSize: '14px', color: chartColors[theme].text }}>Revenue Trend</Card.Title>
              {isLoading ? (
                <div className="text-center">
                  <span className="spinner-border spinner-border-sm" style={{ color: chartColors[theme].text }} />
                </div>
              ) : (
                <div style={{ height: '200px' }}>
                  <Line data={revenueTrendData()} options={lineChartOptions} />
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
              <Form.Label style={{ fontSize: '12px', color: chartColors[theme].text }}>Status Colors</Form.Label>
              <Form.Control
                type="color"
                value={chartColors[theme].status.attended}
                onChange={(e) => setChartColors({ 
                  ...chartColors, 
                  [theme]: { 
                    ...chartColors[theme], 
                    status: { ...chartColors[theme].status, attended: e.target.value } 
                  } 
                })}
                style={{ width: '80px', display: 'inline-block', marginRight: '5px' }}
              />
              <Form.Control
                type="color"
                value={chartColors[theme].status.unattended}
                onChange={(e) => setChartColors({ 
                  ...chartColors, 
                  [theme]: { 
                    ...chartColors[theme], 
                    status: { ...chartColors[theme].status, unattended: e.target.value } 
                  } 
                })}
                style={{ width: '80px', display: 'inline-block' }}
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12px', color: chartColors[theme].text }}>Location Colors</Form.Label>
              {chartColors[theme].location.map((color, idx) => (
                <Form.Control
                  key={idx}
                  type="color"
                  value={color}
                  onChange={(e) => {
                    const newColors = [...chartColors[theme].location];
                    newColors[idx] = e.target.value;
                    setChartColors({ ...chartColors, [theme]: { ...chartColors[theme], location: newColors } });
                  }}
                  className="mb-1"
                  style={{ width: '80px', display: 'inline-block', marginRight: '5px' }}
                />
              ))}
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12px', color: chartColors[theme].text }}>Revenue Color</Form.Label>
              <Form.Control
                type="color"
                value={chartColors[theme].revenue}
                onChange={(e) => setChartColors({ ...chartColors, [theme]: { ...chartColors[theme], revenue: e.target.value } })}
                style={{ width: '80px' }}
              />
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
            display: flex; 
            flex-direction: column; 
            font-family: 'Poppins', sans-serif;
            background: ${chartColors[theme].background};
            transition: all 0.3s ease;
          }
          .kpi-card { 
            border-radius: 15px;
            overflow: hidden;
            position: relative;
            cursor: pointer;
          }
          .kpi-card:hover { 
            transform: translateY(-8px) scale(1.03); 
            box-shadow: 0 12px 25px ${chartColors[theme].text}33 !important;
            transition: all 0.3s ease;
          }
          .kpi-card:hover .kpi-glow {
            opacity: 0.5;
          }
          .kpi-value { 
            font-size: 20px; 
            font-weight: 700; 
            color: ${chartColors[theme].text}; 
            transition: all 0.3s ease;
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
            letter-spacing: 1px;
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
          .scrolling-container {
            position: relative;
            height: 80px;
            overflow: hidden;
          }
          .scrolling-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          @keyframes scrollUp {
            0% { transform: translateY(100%); }
            100% { transform: translateY(-100%); }
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
          ul { padding-left: 0; margin: 0; }
          .card { border-radius: 15px; transition: all 0.3s ease; }
          .card-body { padding: 10px !important; }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: ${chartColors[theme].text}66; border-radius: 5px; }
          .badge { transition: transform 0.2s ease; }
          .badge:hover { transform: scale(1.1); }
        `}
      </style>
    </Container>
  );
};

export default DashboardComponent;