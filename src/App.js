import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthComponent from './AuthComponent';
import DashboardComponent from './DashboardComponent';
import AppointmentBookingComponent from './AppointmentBookingComponent';
import PaymentManagerComponent from './PaymentManagerComponent';
import NotificationComponent from './NotificationComponent';
import PatientRecordsComponent from './PatientRecordsComponent';
import AnalyticsComponent from './AnalyticsComponent';
import PrivateRoute from './PrivateRoute';
import Sidebar from './Sidebar';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'animate.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// AppContent component to handle conditional rendering
const AppContent = () => {
  const { currentUser } = useAuth(); // Access currentUser from AuthContext

  return (
    <>
      {currentUser ? (
        <div className="d-flex">
          <Sidebar />
          <div className="flex-grow-1">
            <Routes>
              <Route 
                path="/" 
                element={
                  <PrivateRoute>
                    <DashboardComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <DashboardComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/appointments" 
                element={
                  <PrivateRoute>
                    <AppointmentBookingComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/payments" 
                element={
                  <PrivateRoute>
                    <PaymentManagerComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/notifications" 
                element={
                  <PrivateRoute>
                    <NotificationComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/patients/records" 
                element={
                  <PrivateRoute>
                    <PatientRecordsComponent />
                  </PrivateRoute>
                } 
              />
              <Route 
                path="/patients/analytics" 
                element={
                  <PrivateRoute>
                    <AnalyticsComponent />
                  </PrivateRoute>
                } 
              />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<AuthComponent />} />
          <Route path="*" element={<AuthComponent />} /> {/* Redirect all other paths to login */}
        </Routes>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;