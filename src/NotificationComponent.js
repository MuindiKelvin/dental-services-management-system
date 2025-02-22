import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { FaBell, FaSearch, FaDownload, FaExclamationTriangle, FaCheckCircle, FaClock, FaTrash, FaEye, FaMoneyCheckAlt, FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const NotificationComponent = () => {
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  // Function to parse the custom timestamp string
  const parseCustomTimestamp = (timestampStr) => {
    // Handle the specific format: "February 22 at 2025 at 1:17:44 PM"
    const parts = timestampStr.split(' at ');
    if (parts.length === 3) {
      const [monthDay, year, time] = parts;
      const [month, day] = monthDay.split(' ');
      return new Date(`${month} ${day}, ${year} ${time}`);
    }
    return new Date(timestampStr); // Fallback to default parsing
  };

  // Fetch notifications and listen for real-time updates
  useEffect(() => {
    setIsLoading(true);

    // Real-time listener for appointments
    const unsubscribeAppointments = onSnapshot(collection(db, 'bershire dental records'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        if (change.type === 'added') {
          const notificationType =
            new Date(data.date) > new Date() && new Date(data.date) - new Date() <= 24 * 60 * 60 * 1000
              ? 'Upcoming'
              : new Date(data.date) < new Date() && data.paymentStatus === 'Pending'
              ? 'Unattended'
              : null;
          if (notificationType) {
            await addDoc(collection(db, 'notifications'), {
              type: notificationType,
              appointmentId: change.doc.id,
              message: `${data.patientName} - ${data.service} (${notificationType === 'Upcoming' ? 'Scheduled' : 'Due'}: ${new Date(data.date).toLocaleString()})`,
              timestamp: "February 22 at 2025 at 1:17:44 PM", // Hardcoding as per your request for new notifications
              read: false,
            });
          }
        }
        if (change.type === 'modified') {
          const paidSoFar = data.paymentHistory ? data.paymentHistory.reduce((sum, p) => sum + p.amount, 0) : 0;
          const remainingAmount = data.payment - paidSoFar;
          if (data.paymentStatus === 'Completed') {
            await addDoc(collection(db, 'notifications'), {
              type: 'Payment Completed',
              appointmentId: change.doc.id,
              message: `${data.patientName} - Full Payment of KSh ${data.payment.toLocaleString()} (${data.service})`,
              timestamp: "February 22 at 2025 at 1:17:44 PM",
              read: false,
            });
          } else if (data.paymentHistory && data.paymentHistory.length > (change.oldIndex || 0)) {
            const latestPayment = data.paymentHistory[data.paymentHistory.length - 1];
            await addDoc(collection(db, 'notifications'), {
              type: 'Payment Installment',
              appointmentId: change.doc.id,
              message: `${data.patientName} - Installment of KSh ${latestPayment.amount.toLocaleString()} (${data.service}, Remaining: KSh ${remainingAmount.toLocaleString()})`,
              timestamp: "February 22 at 2025 at 1:17:44 PM",
              read: false,
            });
          }
        }
      });
    });

    // Real-time listener for patients
    const unsubscribePatients = onSnapshot(collection(db, 'patient_records'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        if (change.type === 'modified' && 'attended' in data) {
          const notificationType = data.attended ? 'Patient Attended' : 'Patient Unattended';
          await addDoc(collection(db, 'notifications'), {
            type: notificationType,
            patientId: change.doc.id,
            message: `${data.name} - ${notificationType.split(' ')[1]}`,
            timestamp: "February 22 at 2025 at 1:17:44 PM",
            read: false,
          });
        }
      });
    });

    // Fetch existing notifications
    const fetchNotifications = async () => {
      const notificationSnapshot = await getDocs(collection(db, 'notifications'));
      const notificationData = notificationSnapshot.docs.map((doc) => {
        const data = doc.data();
        const timestampStr = data.timestamp instanceof Object ? data.timestamp.toDate().toISOString() : data.timestamp;
        return {
          id: doc.id,
          ...data,
          timestamp: timestampStr, // Keep as string for display
          parsedTimestamp: parseCustomTimestamp(timestampStr), // Parsed for sorting
        };
      });
      setNotifications(notificationData);
      setIsLoading(false);
    };
    fetchNotifications();

    // Cleanup listeners
    return () => {
      unsubscribeAppointments();
      unsubscribePatients();
    };
  }, []);

  // Filter and paginate notifications
  const filteredNotifications = notifications
    .filter((n) => n.message.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((n) => filterType === 'All' || n.type === filterType)
    .sort((a, b) => b.parsedTimestamp - a.parsedTimestamp); // Sort using parsed timestamp

  // Count only unread notifications
  const unreadNotificationsCount = filteredNotifications.filter((n) => !n.read).length;

  const totalPages = Math.ceil(filteredNotifications.length / recordsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Mark as Read (UPDATE)
  const handleMarkAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      toast.success('Notification marked as read');
    } catch (error) {
      toast.error('Error marking notification as read');
      console.error(error);
    }
  };

  // Clear notification (DELETE)
  const handleClear = async (notificationId) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success('Notification cleared');
    } catch (error) {
      toast.error('Error clearing notification');
      console.error(error);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'ID,Type,Message,Timestamp,Read\n';
    const rows = filteredNotifications
      .map((n, index) => `${index + 1},${n.type},${n.message},${n.timestamp},${n.read ? 'Yes' : 'No'}`)
      .join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notifications.csv';
    a.click();
    toast.success('Notifications exported');
  };

  return (
    <div className="main-content" style={{ marginLeft: '280px', padding: '20px' }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <h3 className="fw-bold text-primary">
          <FaBell className="me-2" />
          Notifications ({unreadNotificationsCount} Unread / {filteredNotifications.length} Total)
        </h3>
        <button className="btn btn-outline-success rounded-pill" onClick={exportToCSV}>
          <FaDownload className="me-2" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body d-flex justify-content-between flex-wrap gap-3">
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <span className="input-group-text">
              <FaSearch />
            </span>
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ maxWidth: '200px' }}>
            <select
              className="form-control rounded-pill"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Unattended">Unattended</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Payment Completed">Payment Completed</option>
              <option value="Payment Installment">Payment Installment</option>
              <option value="Patient Attended">Patient Attended</option>
              <option value="Patient Unattended">Patient Unattended</option>
            </select>
          </div>
          <div className="input-group" style={{ maxWidth: '200px' }}>
            <select
              className="form-control rounded-pill"
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(parseInt(e.target.value));
                setCurrentPage(1); // Reset to first page
              }}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-5">
              <span className="spinner-border spinner-border-lg" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-5 text-muted">No notifications to display</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Date & Time</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedNotifications.map((notification, index) => (
                      <tr key={notification.id} className="animate__animated animate__fadeIn">
                        <td>{(currentPage - 1) * recordsPerPage + index + 1}</td>
                        <td>
                          <span
                            className={`badge ${
                              notification.type === 'Unattended'
                                ? 'bg-warning'
                                : notification.type === 'Upcoming'
                                ? 'bg-info'
                                : notification.type === 'Payment Completed'
                                ? 'bg-success'
                                : notification.type === 'Payment Installment'
                                ? 'bg-primary'
                                : notification.type === 'Patient Attended'
                                ? 'bg-success'
                                : 'bg-warning'
                            }`}
                          >
                            {notification.type === 'Unattended' && <FaExclamationTriangle className="me-1" />}
                            {notification.type === 'Upcoming' && <FaClock className="me-1" />}
                            {(notification.type === 'Payment Completed' ||
                              notification.type === 'Payment Installment') && (
                              <FaMoneyCheckAlt className="me-1" />
                            )}
                            {notification.type === 'Patient Attended' && <FaCheckCircle className="me-1" />}
                            {notification.type === 'Patient Unattended' && <FaTimes className="me-1" />}
                            {notification.type}
                          </span>
                        </td>
                        <td>{notification.message}</td>
                        <td>{notification.timestamp}</td> {/* Display raw timestamp string */}
                        <td>
                          <span className={`badge ${notification.read ? 'bg-success' : 'bg-secondary'}`}>
                            {notification.read ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td>
                          {!notification.read && (
                            <button
                              className="btn btn-sm btn-outline-primary rounded-pill me-2"
                              onClick={() => handleMarkAsRead(notification.id)}
                            >
                              <FaEye /> Mark as Read
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-danger rounded-pill"
                            onClick={() => handleClear(notification.id)}
                          >
                            <FaTrash /> Clear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="d-flex justify-content-between align-items-center mt-3">
                <button
                  className="btn btn-outline-primary rounded-pill"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages} ({filteredNotifications.length} total)
                </span>
                <button
                  className="btn btn-outline-primary rounded-pill"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Updated Custom CSS
const styles = `
  .main-content {
    min-height: 100vh;
    background-color: #f8f9fa;
    width: calc(100% - 280px);
    transition: all 0.3s;
  }

  .card {
    border: none;
    border-radius: 15px;
    transition: transform 0.2s;
  }

  .card:hover {
    transform: translateY(-5px);
  }

  .form-control, .btn {
    transition: all 0.3s;
  }

  .form-control:focus {
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
  }

  .rounded-pill {
    border-radius: 50rem !important;
  }

  .table-hover tbody tr:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .badge {
    padding: 0.5em 1em;
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
      width: 100%;
    }
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default NotificationComponent;