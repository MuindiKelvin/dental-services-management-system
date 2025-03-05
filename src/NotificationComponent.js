import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { FaBell, FaSearch, FaDownload, FaExclamationTriangle, FaCheckCircle, FaClock, FaTrash, FaEye, FaMoneyCheckAlt, FaTimes, FaTrashAlt, FaEnvelopeOpen } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const NotificationComponent = () => {
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  // Format timestamp to reflect current system time
  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    }).replace(/,/, ' at');
  };

  // Fetch notifications and listen for real-time updates
  useEffect(() => {
    setIsLoading(true);

    // Listener for appointments (including payment and status changes)
    const unsubscribeAppointments = onSnapshot(collection(db, 'bershire dental records'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        const currentTime = formatTimestamp();
        const prevData = change.type === 'modified' ? change.doc._document.version.snapshot.data.value.mapValue.fields : null;

        if (change.type === 'added') {
          const notificationType =
            new Date(data.date) > new Date() && new Date(data.date) - new Date() <= 24 * 60 * 60 * 1000
              ? 'Upcoming Appointment'
              : null;
          if (notificationType) {
            await addDoc(collection(db, 'notifications'), {
              type: notificationType,
              appointmentId: change.doc.id,
              message: `${data.patientName} - ${data.service} (Scheduled: ${new Date(data.date).toLocaleString()})`,
              timestamp: currentTime,
              read: false,
            });
            console.log(`Added Notification: ${notificationType} for ${data.patientName}`);
          }
        }

        if (change.type === 'modified') {
          const paidSoFar = data.paymentHistory ? data.paymentHistory.reduce((sum, p) => sum + p.amount, 0) : 0;
          const remainingAmount = data.payment - paidSoFar;
          const prevPaidSoFar = prevData?.paymentHistory?.arrayValue?.values
            ? prevData.paymentHistory.arrayValue.values.reduce((sum, p) => sum + (p.mapValue?.fields?.amount?.integerValue || p.mapValue?.fields?.amount?.doubleValue || 0), 0)
            : 0;

          // Payment Installment Notification
          if (data.paymentHistory && data.paymentHistory.length > (prevData?.paymentHistory?.arrayValue?.values?.length || 0)) {
            const latestPayment = data.paymentHistory[data.paymentHistory.length - 1];
            await addDoc(collection(db, 'notifications'), {
              type: 'Payment Installment',
              appointmentId: change.doc.id,
              message: `${data.patientName} - Installment of KSh ${latestPayment.amount.toLocaleString()} (${data.service}, Remaining: KSh ${remainingAmount.toLocaleString()})`,
              timestamp: currentTime,
              read: false,
            });
            console.log(`Added Notification: Payment Installment for ${data.patientName} - KSh ${latestPayment.amount}`);
          }

          // Payment Completed Notification
          if (paidSoFar >= data.payment && prevPaidSoFar < data.payment) {
            await addDoc(collection(db, 'notifications'), {
              type: 'Payment Completed',
              appointmentId: change.doc.id,
              message: `${data.patientName} - Full Payment of KSh ${data.payment.toLocaleString()} (${data.service})`,
              timestamp: currentTime,
              read: false,
            });
            console.log(`Added Notification: Payment Completed for ${data.patientName} - KSh ${data.payment}`);
          }

          // Status Changed Notification
          if (data.paymentStatus && prevData?.paymentStatus?.stringValue && data.paymentStatus !== prevData.paymentStatus.stringValue) {
            await addDoc(collection(db, 'notifications'), {
              type: 'Status Changed',
              appointmentId: change.doc.id,
              message: `${data.patientName} - Status updated to "${data.paymentStatus}" (${data.service})`,
              timestamp: currentTime,
              read: false,
            });
            console.log(`Added Notification: Status Changed for ${data.patientName} to ${data.paymentStatus}`);
          }
        }
      });
    });

    // Listener for patient records (attendance changes)
    const unsubscribePatients = onSnapshot(collection(db, 'patient_records'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        const prevData = change.type === 'modified' ? change.doc._document.version.snapshot.data.value.mapValue.fields : null;
        if (change.type === 'modified' && 'attended' in data) {
          const notificationType = data.attended ? 'Patient Attended' : 'Patient Unattended';
          if (prevData && prevData.attended?.booleanValue !== data.attended) {
            await addDoc(collection(db, 'notifications'), {
              type: notificationType,
              patientId: change.doc.id,
              message: `${data.name} - ${notificationType.split(' ')[1]}`,
              timestamp: formatTimestamp(),
              read: false,
            });
            console.log(`Added Notification: ${notificationType} for ${data.name}`);
          }
        }
      });
    });

    // Initial fetch of existing notifications
    const fetchNotifications = async () => {
      const notificationSnapshot = await getDocs(collection(db, 'notifications'));
      const notificationData = notificationSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp,
      }));
      setNotifications(notificationData);
      console.log('Fetched Notifications:', notificationData);
      setIsLoading(false);
    };
    fetchNotifications();

    return () => {
      unsubscribeAppointments();
      unsubscribePatients();
    };
  }, []);

  // Filter and paginate notifications
  const filteredNotifications = notifications
    .filter((n) => {
      const matchesSearch = n.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'All' || n.type === filterType;
      if (!matchesSearch || !matchesType) {
        console.log(`Filtered out: ${n.type} - ${n.message}`);
      }
      return matchesSearch && matchesType;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const unreadNotificationsCount = filteredNotifications.filter((n) => !n.read).length;

  const totalPages = Math.ceil(filteredNotifications.length / recordsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Mark as Read
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

  // Mark as Unread
  const handleMarkAsUnread = async (notificationId) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: false });
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: false } : n)));
      toast.success('Notification marked as unread');
    } catch (error) {
      toast.error('Error marking notification as unread');
      console.error(error);
    }
  };

  // Clear notification
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

  // Delete all notifications
  const handleDeleteAll = async () => {
    if (window.confirm('Are you sure you want to delete all notifications?')) {
      try {
        const batch = [];
        notifications.forEach((n) => {
          batch.push(deleteDoc(doc(db, 'notifications', n.id)));
        });
        await Promise.all(batch);
        setNotifications([]);
        toast.success('All notifications deleted');
      } catch (error) {
        toast.error('Error deleting all notifications');
        console.error(error);
      }
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'ID,Type,Message,System Time,Read\n';
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

  // Bulk Actions
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const handleSelectNotification = (id) => {
    setSelectedNotifications((prev) =>
      prev.includes(id) ? prev.filter((nId) => nId !== id) : [...prev, id]
    );
  };

  const handleBulkMarkAsRead = async () => {
    try {
      const batch = selectedNotifications.map((id) =>
        updateDoc(doc(db, 'notifications', id), { read: true })
      );
      await Promise.all(batch);
      setNotifications((prev) =>
        prev.map((n) => (selectedNotifications.includes(n.id) ? { ...n, read: true } : n))
      );
      setSelectedNotifications([]);
      toast.success('Selected notifications marked as read');
    } catch (error) {
      toast.error('Error in bulk marking as read');
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm('Are you sure you want to delete selected notifications?')) {
      try {
        const batch = selectedNotifications.map((id) => deleteDoc(doc(db, 'notifications', id)));
        await Promise.all(batch);
        setNotifications((prev) => prev.filter((n) => !selectedNotifications.includes(n.id)));
        setSelectedNotifications([]);
        toast.success('Selected notifications deleted');
      } catch (error) {
        toast.error('Error in bulk deletion');
        console.error(error);
      }
    }
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
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success rounded-pill" onClick={exportToCSV}>
            <FaDownload className="me-2" /> Export CSV
          </button>
          <button className="btn btn-outline-danger rounded-pill" onClick={handleDeleteAll}>
            <FaTrashAlt className="me-2" /> Delete All
          </button>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="card shadow-sm mb-4">
        <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2 align-items-center">
            <select
              className="form-control rounded-pill"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ maxWidth: '200px' }}
            >
              <option value="All">All Types</option>
              <option value="Upcoming Appointment">Upcoming Appointment</option>
              <option value="Payment Installment">Payment Installment</option>
              <option value="Payment Completed">Payment Completed</option>
              <option value="Status Changed">Status Changed</option>
              <option value="Patient Attended">Patient Attended</option>
              <option value="Patient Unattended">Patient Unattended</option>
            </select>
            <select
              className="form-control rounded-pill"
              value={recordsPerPage}
              onChange={(e) => {
                setRecordsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              style={{ maxWidth: '150px' }}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
            {selectedNotifications.length > 0 && (
              <div className="d-flex gap-2">
                <button className="btn btn-outline-primary rounded-pill" onClick={handleBulkMarkAsRead}>
                  <FaEye className="me-1" /> Mark Selected as Read
                </button>
                <button className="btn btn-outline-danger rounded-pill" onClick={handleBulkDelete}>
                  <FaTrash className="me-1" /> Delete Selected
                </button>
              </div>
            )}
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
            <div className="text-center py-5 text-muted">No notifications to display for filter: {filterType}</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedNotifications.length === paginatedNotifications.length && paginatedNotifications.length > 0}
                          onChange={(e) =>
                            setSelectedNotifications(
                              e.target.checked ? paginatedNotifications.map((n) => n.id) : []
                            )
                          }
                        />
                      </th>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Message</th>
                      <th>System Time</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedNotifications.map((notification, index) => (
                      <tr key={notification.id} className="animate__animated animate__fadeIn">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedNotifications.includes(notification.id)}
                            onChange={() => handleSelectNotification(notification.id)}
                          />
                        </td>
                        <td>{(currentPage - 1) * recordsPerPage + index + 1}</td>
                        <td>
                          <span
                            className={`badge ${
                              notification.type === 'Upcoming Appointment'
                                ? 'bg-info'
                                : notification.type === 'Payment Installment'
                                ? 'bg-primary'
                                : notification.type === 'Payment Completed'
                                ? 'bg-success'
                                : notification.type === 'Status Changed'
                                ? 'bg-warning'
                                : notification.type === 'Patient Attended'
                                ? 'bg-success'
                                : notification.type === 'Patient Unattended'
                                ? 'bg-danger'
                                : 'bg-secondary'
                            }`}
                          >
                            {notification.type === 'Upcoming Appointment' && <FaClock className="me-1" />}
                            {notification.type === 'Payment Installment' && <FaMoneyCheckAlt className="me-1" />}
                            {notification.type === 'Payment Completed' && <FaCheckCircle className="me-1" />}
                            {notification.type === 'Status Changed' && <FaExclamationTriangle className="me-1" />}
                            {notification.type === 'Patient Attended' && <FaCheckCircle className="me-1" />}
                            {notification.type === 'Patient Unattended' && <FaTimes className="me-1" />}
                            {notification.type}
                          </span>
                        </td>
                        <td>{notification.message}</td>
                        <td>{notification.timestamp}</td>
                        <td>
                          <span className={`badge ${notification.read ? 'bg-success' : 'bg-secondary'}`}>
                            {notification.read ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td>
                          {!notification.read ? (
                            <button
                              className="btn btn-sm btn-outline-primary rounded-pill me-2"
                              onClick={() => handleMarkAsRead(notification.id)}
                            >
                              <FaEye /> Mark as Read
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-secondary rounded-pill me-2"
                              onClick={() => handleMarkAsUnread(notification.id)}
                            >
                              <FaEnvelopeOpen /> Mark as Unread
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

// Updated Custom CSS (unchanged)
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
  .notification-highlight {
    background-color: #e9f7ef;
    border-left: 4px solid #28a745;
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