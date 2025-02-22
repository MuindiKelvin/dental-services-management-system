import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, updateDoc, getDocs, collection, addDoc, deleteField } from 'firebase/firestore';
import { FaMoneyCheckAlt, FaSearch, FaFilter, FaPrint, FaDownload, FaCheckCircle, FaPlus, FaEye, FaEdit, FaTrash, FaAngleLeft, FaAngleRight } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PaymentManagerComponent = () => {
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [installmentModal, setInstallmentModal] = useState(null);
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [viewModal, setViewModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editPaymentIndex, setEditPaymentIndex] = useState(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Format date to "February 22, 2025 at 1:17:44 PM"
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    // Handle custom string format from database: "February 22 at 2025 at 1:17:44 PM"
    if (typeof timestamp === 'string' && timestamp.includes(' at ')) {
      const parts = timestamp.split(' at ');
      if (parts.length === 3) {
        const [monthDay, year, time] = parts;
        return `${monthDay}, ${year} at ${time}`; // Normalize to "February 22, 2025 at 1:17:44 PM"
      }
      return timestamp; // Return as-is if not matching expected format
    }
    // Handle Firestore Timestamp or ISO string
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
      timeZone: 'Africa/Nairobi', // UTC+3
    };
    return date.toLocaleString('en-US', options).replace(/,/, ' at');
  };

  // Fetch appointments and convert timestamps
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'bershire dental records'));
        const data = querySnapshot.docs.map((doc) => {
          const docData = doc.data();
          const paymentStatus = docData.paymentStatus === 'Attended' ? 'Attended' : 'Unattended';
          return {
            id: doc.id,
            ...docData,
            paymentHistory: (docData.paymentHistory || []).map((payment) => ({
              ...payment,
              date: formatDate(payment.date), // Format payment history dates
            })),
            paymentDate: docData.paymentDate ? formatDate(docData.paymentDate) : null, // Format payment date
            paymentStatus,
          };
        });
        setAppointments(data);
      } catch (error) {
        toast.error('Error fetching payments');
        console.error(error);
      }
      setIsLoading(false);
    };
    fetchAppointments();
  }, []);

  // Handle full payment processing
  const handleProcessPayment = async (appointment) => {
    setIsLoading(true);
    try {
      const appointmentRef = doc(db, 'bershire dental records', appointment.id);
      const paidSoFar = appointment.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;
      const remainingAmount = appointment.payment - paidSoFar;
      const currentDate = formatDate(new Date());
      const paymentHistory = [...appointment.paymentHistory, { amount: remainingAmount, date: currentDate }];
      await updateDoc(appointmentRef, {
        paymentStatus: 'Attended',
        paymentDate: currentDate,
        paymentHistory,
      });
      setAppointments(appointments.map((app) =>
        app.id === appointment.id ? { ...app, paymentStatus: 'Attended', paymentDate: currentDate, paymentHistory } : app
      ));
      await createNotification(appointment, 'Payment Completed');
      toast.success(`Full payment processed for ${appointment.patientName}`);
    } catch (error) {
      toast.error('Error processing payment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Handle installment payment
  const handleInstallmentPayment = async (appointment) => {
    if (!installmentAmount || isNaN(installmentAmount) || installmentAmount <= 0) {
      toast.error('Please enter a valid installment amount');
      return;
    }
    setIsLoading(true);
    try {
      const appointmentRef = doc(db, 'bershire dental records', appointment.id);
      const paidSoFar = appointment.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;
      const newPayment = parseFloat(installmentAmount);
      const totalPaid = paidSoFar + newPayment;
      const currentDate = formatDate(new Date());
      const paymentHistory = [...appointment.paymentHistory, { amount: newPayment, date: currentDate }];
      const paymentStatus = totalPaid >= appointment.payment ? 'Attended' : 'Unattended';

      await updateDoc(appointmentRef, {
        paymentHistory,
        paymentStatus,
        ...(paymentStatus === 'Attended' && { paymentDate: currentDate }),
      });
      setAppointments(appointments.map((app) =>
        app.id === appointment.id
          ? {
              ...app,
              paymentHistory,
              paymentStatus,
              ...(paymentStatus === 'Attended' && { paymentDate: currentDate }),
            }
          : app
      ));
      if (paymentStatus === 'Attended') {
        await createNotification(appointment, 'Payment Completed');
      }
      toast.success(`Installment of KSh ${newPayment.toLocaleString()} processed for ${appointment.patientName}`);
      setInstallmentModal(null);
      setInstallmentAmount('');
    } catch (error) {
      toast.error('Error processing installment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Handle edit payment
  const handleEditPayment = async (appointment) => {
    if (!editPaymentAmount || isNaN(editPaymentAmount) || editPaymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setIsLoading(true);
    try {
      const appointmentRef = doc(db, 'bershire dental records', appointment.id);
      const newPaymentHistory = [...appointment.paymentHistory];
      newPaymentHistory[editPaymentIndex] = {
        ...newPaymentHistory[editPaymentIndex],
        amount: parseFloat(editPaymentAmount),
      };
      const totalPaid = newPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
      const paymentStatus = totalPaid >= appointment.payment ? 'Attended' : 'Unattended';
      const currentDate = formatDate(new Date());

      await updateDoc(appointmentRef, {
        paymentHistory: newPaymentHistory,
        paymentStatus,
        ...(paymentStatus === 'Attended' && !appointment.paymentDate && { paymentDate: currentDate }),
      });
      setAppointments(appointments.map((app) =>
        app.id === appointment.id ? { ...app, paymentHistory: newPaymentHistory, paymentStatus } : app
      ));
      toast.success(`Payment updated for ${appointment.patientName}`);
      setEditModal(null);
      setEditPaymentAmount('');
      setEditPaymentIndex(null);
    } catch (error) {
      toast.error('Error updating payment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Handle delete payment
  const handleDeletePayment = async (appointment, index) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    setIsLoading(true);
    try {
      const appointmentRef = doc(db, 'bershire dental records', appointment.id);
      const newPaymentHistory = appointment.paymentHistory.filter((_, i) => i !== index);
      const totalPaid = newPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
      const paymentStatus = totalPaid >= appointment.payment ? 'Attended' : 'Unattended';

      await updateDoc(appointmentRef, {
        paymentHistory: newPaymentHistory,
        paymentStatus,
        ...(newPaymentHistory.length === 0 && { paymentDate: deleteField() }),
      });
      setAppointments(appointments.map((app) =>
        app.id === appointment.id
          ? {
              ...app,
              paymentHistory: newPaymentHistory,
              paymentStatus,
              ...(newPaymentHistory.length === 0 && { paymentDate: null }),
            }
          : app
      ));
      toast.success(`Payment deleted for ${appointment.patientName}`);
    } catch (error) {
      toast.error('Error deleting payment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Create notification
  const createNotification = async (appointment, type) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        type,
        appointmentId: appointment.id,
        message: `${appointment.patientName} - KSh ${appointment.payment.toLocaleString()} (${appointment.service})`,
        timestamp: formatDate(new Date()), // Use formatted date for notifications
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  // Handle print receipt
  const handlePrintReceipt = (appointment) => {
    const logo = '🦷'; // Replace with your logo URL or base64 if available
    const paymentHistoryDetails = appointment.paymentHistory
      .map((p) => `Installment: KSh ${p.amount.toLocaleString()} - ${p.date}`)
      .join('\n');
    const totalPaid = appointment.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;

    const receipt = `
      <div style="text-align: center;">
        <h1 style="font-size: 2rem;">${logo}</h1>
        <h2>Berkshire Dental Clinic</h2>
        <hr style="border: 1px solid #000; width: 80%; margin: 10px auto;">
      </div>
      <div style="text-align: left;">
        <strong>Receipt</strong><br>
        Patient: ${appointment.patientName}<br>
        Service: ${appointment.service}<br>
        Total Amount: KSh ${appointment.payment.toLocaleString()}<br>
        Paid Amount: KSh ${totalPaid.toLocaleString()}<br>
        Remaining: KSh ${(appointment.payment - totalPaid).toLocaleString()}<br>
        Payment History:<br>${paymentHistoryDetails || 'Full Payment'}<br>
        Status: ${appointment.paymentStatus}<br>
        ${appointment.paymentDate ? `Payment Completed: ${appointment.paymentDate}` : ''}<br>
        Issued: ${formatDate(new Date())}<br>
      </div>
      <hr style="border: 1px solid #000; width: 80%; margin: 10px auto;">
      <div style="text-align: center;">Thank you for your payment!</div>
    `;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.5; }
          </style>
        </head>
        <body>${receipt}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Bulk process payments
  const handleBulkProcess = async () => {
    if (selectedAppointments.length === 0) {
      toast.warn('No appointments selected');
      return;
    }
    setIsLoading(true);
    try {
      await Promise.all(
        selectedAppointments.map(async (id) => {
          const appointment = appointments.find((app) => app.id === id);
          const appointmentRef = doc(db, 'bershire dental records', id);
          const paidSoFar = appointment.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;
          const remainingAmount = appointment.payment - paidSoFar;
          const currentDate = formatDate(new Date());
          const paymentHistory = [...appointment.paymentHistory, { amount: remainingAmount, date: currentDate }];
          await updateDoc(appointmentRef, {
            paymentStatus: 'Attended',
            paymentDate: currentDate,
            paymentHistory,
          });
          await createNotification(appointment, 'Payment Completed');
        })
      );
      setAppointments(appointments.map((app) =>
        selectedAppointments.includes(app.id)
          ? {
              ...app,
              paymentStatus: 'Attended',
              paymentDate: formatDate(new Date()),
              paymentHistory: [
                ...app.paymentHistory,
                {
                  amount: app.payment - (app.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0),
                  date: formatDate(new Date()),
                },
              ],
            }
          : app
      ));
      toast.success(`Processed ${selectedAppointments.length} payments`);
      setSelectedAppointments([]);
    } catch (error) {
      toast.error('Error processing bulk payments');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'Patient,Service,Total Amount (KSh),Paid Amount (KSh),Remaining (KSh),Status,Payment History,Payment Date\n';
    const rows = filteredAppointments
      .map((app) => {
        const paidAmount = app.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;
        const remaining = app.payment - paidAmount;
        const paymentHistory = app.paymentHistory
          .map((p) => `KSh ${p.amount.toLocaleString()} (${p.date})`)
          .join('; ') || '-';
        return `${app.patientName},${app.service},${app.payment},${paidAmount},${remaining},${app.paymentStatus},${paymentHistory},${app.paymentDate || '-'}`;
      })
      .join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payments.csv';
    a.click();
    toast.success('Payments exported');
  };

  // Filter appointments
  const filteredAppointments = appointments
    .filter((app) =>
      app.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.service.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((app) => filterStatus === 'All' || app.paymentStatus === filterStatus);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAppointments = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Toggle selection
  const toggleSelection = (id) => {
    setSelectedAppointments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="main-content" style={{ marginLeft: '280px', padding: '20px' }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <h3 className="fw-bold text-primary">
          <FaMoneyCheckAlt className="me-2" />
          Payment Management
        </h3>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary rounded-pill"
            onClick={handleBulkProcess}
            disabled={isLoading || selectedAppointments.length === 0}
          >
            <FaCheckCircle className="me-2" />
            Process Selected ({selectedAppointments.length})
          </button>
          <button className="btn btn-outline-success rounded-pill" onClick={exportToCSV}>
            <FaDownload className="me-2" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body d-flex justify-content-between flex-wrap gap-3">
          <div className="input-group" style={{ maxWidth: '400px' }}>
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ maxWidth: '200px' }}>
            <span className="input-group-text"><FaFilter /></span>
            <select
              className="form-control rounded-pill"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Attended">Attended</option>
              <option value="Unattended">Unattended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <div className="text-center py-5">
              <span className="spinner-border spinner-border-lg" />
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAppointments(
                                currentAppointments
                                  .filter((app) => app.paymentStatus === 'Unattended')
                                  .map((app) => app.id)
                              );
                            } else {
                              setSelectedAppointments([]);
                            }
                          }}
                          checked={
                            selectedAppointments.length ===
                              currentAppointments.filter((app) => app.paymentStatus === 'Unattended').length &&
                            selectedAppointments.length > 0
                          }
                        />
                      </th>
                      <th>Patient</th>
                      <th>Service</th>
                      <th>Total (KSh)</th>
                      <th>Paid (KSh)</th>
                      <th>Remaining (KSh)</th>
                      <th>Status</th>
                      <th>Payment History</th>
                      <th>Payment Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAppointments.map((appointment) => {
                      const paidAmount = appointment.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0;
                      const remainingAmount = appointment.payment - paidAmount;
                      return (
                        <tr key={appointment.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedAppointments.includes(appointment.id)}
                              onChange={() => toggleSelection(appointment.id)}
                              disabled={appointment.paymentStatus !== 'Unattended'}
                            />
                          </td>
                          <td>{appointment.patientName}</td>
                          <td>{appointment.service}</td>
                          <td>{appointment.payment.toLocaleString()}</td>
                          <td>{paidAmount.toLocaleString()}</td>
                          <td>{remainingAmount.toLocaleString()}</td>
                          <td>
                            <span
                              className={`badge ${
                                appointment.paymentStatus === 'Attended' ? 'bg-success' : 'bg-warning'
                              }`}
                            >
                              {appointment.paymentStatus}
                            </span>
                          </td>
                          <td>
                            {appointment.paymentHistory.length > 0 ? (
                              appointment.paymentHistory.map((p, i) => (
                                <div key={i}>
                                  KSh {p.amount.toLocaleString()} - {p.date}
                                  <FaEdit
                                    className="ms-2 text-primary cursor-pointer"
                                    onClick={() => {
                                      setEditModal(appointment);
                                      setEditPaymentIndex(i);
                                      setEditPaymentAmount(p.amount);
                                    }}
                                  />
                                  <FaTrash
                                    className="ms-2 text-danger cursor-pointer"
                                    onClick={() => handleDeletePayment(appointment, i)}
                                  />
                                </div>
                              ))
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{appointment.paymentDate || '-'}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-info rounded-pill px-3 me-2"
                              onClick={() => setViewModal(appointment)}
                            >
                              <FaEye /> View
                            </button>
                            {appointment.paymentStatus === 'Unattended' && remainingAmount > 0 ? (
                              <>
                                <button
                                  className="btn btn-sm btn-warning rounded-pill px-3 me-2"
                                  onClick={() => setInstallmentModal(appointment)}
                                  disabled={isLoading}
                                >
                                  <FaPlus /> Installment
                                </button>
                                <button
                                  className="btn btn-sm btn-primary rounded-pill px-3 me-2"
                                  onClick={() => handleProcessPayment(appointment)}
                                  disabled={isLoading}
                                >
                                  Full Payment
                                </button>
                              </>
                            ) : null}
                            <button
                              className="btn btn-sm btn-success rounded-pill px-3"
                              onClick={() => handlePrintReceipt(appointment)}
                            >
                              <FaPrint /> Receipt
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredAppointments.length > itemsPerPage && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <button
                    className="btn btn-outline-primary rounded-pill"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <FaAngleLeft /> Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn btn-outline-primary rounded-pill"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next <FaAngleRight />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Installment Modal */}
      {installmentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Installment Payment</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setInstallmentModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Patient: {installmentModal.patientName}</p>
                <p>Service: {installmentModal.service}</p>
                <p>Total Amount: KSh {installmentModal.payment.toLocaleString()}</p>
                <p>
                  Paid So Far: KSh{' '}
                  {(installmentModal.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0).toLocaleString()}
                </p>
                <p>
                  Remaining: KSh{' '}
                  {(installmentModal.payment -
                    (installmentModal.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0)).toLocaleString()}
                </p>
                <div className="mb-3">
                  <label className="form-label">Installment Amount (KSh)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    min="1"
                    max={
                      installmentModal.payment -
                      (installmentModal.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0)
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill"
                  onClick={() => setInstallmentModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-pill"
                  onClick={() => handleInstallmentPayment(installmentModal)}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                  Process Installment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Payment Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setViewModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p><strong>Patient:</strong> {viewModal.patientName}</p>
                <p><strong>Service:</strong> {viewModal.service}</p>
                <p><strong>Total Amount:</strong> KSh {viewModal.payment.toLocaleString()}</p>
                <p>
                  <strong>Paid Amount:</strong> KSh{' '}
                  {(viewModal.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0).toLocaleString()}
                </p>
                <p>
                  <strong>Remaining:</strong> KSh{' '}
                  {(viewModal.payment - (viewModal.paymentHistory.reduce((sum, p) => sum + p.amount, 0) || 0)).toLocaleString()}
                </p>
                <p><strong>Status:</strong> {viewModal.paymentStatus}</p>
                <p><strong>Payment History:</strong></p>
                {viewModal.paymentHistory.length > 0 ? (
                  <ul>
                    {viewModal.paymentHistory.map((p, i) => (
                      <li key={i}>
                        KSh {p.amount.toLocaleString()} - {p.date}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No payment history</p>
                )}
                {viewModal.paymentDate && (
                  <p><strong>Payment Completed:</strong> {viewModal.paymentDate}</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill"
                  onClick={() => setViewModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Payment</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setEditModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>Patient: {editModal.patientName}</p>
                <p>Service: {editModal.service}</p>
                <p>Date: {editModal.paymentHistory[editPaymentIndex].date}</p>
                <div className="mb-3">
                  <label className="form-label">Payment Amount (KSh)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary rounded-pill"
                  onClick={() => setEditModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary rounded-pill"
                  onClick={() => handleEditPayment(editModal)}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  .table-hover tbody tr:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  .rounded-pill {
    border-radius: 50rem !important;
  }
  .badge {
    padding: 0.5em 1em;
  }
  .modal-content {
    border-radius: 15px;
  }
  .cursor-pointer {
    cursor: pointer;
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

export default PaymentManagerComponent;