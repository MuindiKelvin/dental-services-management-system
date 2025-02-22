import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { FaUserMd, FaSearch, FaDownload, FaPlus, FaEdit, FaTrash, FaHistory, FaCheck, FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PatientRecordsComponent = () => {
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '', attended: false });
  const [editingId, setEditingId] = useState(null);
  const [timelinePatient, setTimelinePatient] = useState(null);

  // Format date to "February 21, 2025 at 11:49:58 PM"
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    // If timestamp is already a string in the expected format, return it as-is
    if (typeof timestamp === 'string' && /\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2}:\d{2} (AM|PM)/.test(timestamp)) {
      return timestamp;
    }
    // Handle Firestore Timestamp or other parseable date formats
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date detected: ${timestamp}`);
      return 'Invalid Date'; // Fallback for unparseable dates
    }
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
      timeZone: 'Africa/Nairobi' // UTC+3
    };
    return date.toLocaleString('en-US', options).replace(/,/, ' at');
  };

  // Fetch patient records
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'patient_records'));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          attended: doc.data().attended ?? false, // Default to false if not present
          createdAt: doc.data().createdAt ? formatDate(doc.data().createdAt) : null,
          updatedAt: doc.data().updatedAt ? formatDate(doc.data().updatedAt) : null
        }));
        setPatients(data);
      } catch (error) {
        toast.error('Error fetching patient records');
        console.error(error);
      }
      setIsLoading(false);
    };
    fetchPatients();
  }, []);

  // Handle form submission (Create/Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const currentDate = formatDate(new Date());
      if (editingId) {
        const patientRef = doc(db, 'patient_records', editingId);
        const oldPatient = patients.find(p => p.id === editingId);
        await updateDoc(patientRef, { ...formData, updatedAt: currentDate });
        setPatients(patients.map(p => (p.id === editingId ? { ...p, ...formData, updatedAt: currentDate } : p)));
        toast.success('Patient record updated');
        // Trigger notification if attended status changed
        if (oldPatient.attended !== formData.attended) {
          await addDoc(collection(db, 'notifications'), {
            type: formData.attended ? 'Patient Attended' : 'Patient Unattended',
            patientId: editingId,
            message: `${formData.name} - ${formData.attended ? 'Attended' : 'Unattended'}`,
            timestamp: currentDate,
            read: false
          });
        }
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'patient_records'), { ...formData, createdAt: currentDate });
        setPatients([...patients, { id: docRef.id, ...formData, createdAt: currentDate }]);
        toast.success('Patient record added');
      }
      setFormData({ name: '', phone: '', email: '', notes: '', attended: false });
    } catch (error) {
      toast.error('Error saving patient record');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Handle edit
  const handleEdit = (patient) => {
    setFormData({ 
      name: patient.name, 
      phone: patient.phone, 
      email: patient.email, 
      notes: patient.notes, 
      attended: patient.attended 
    });
    setEditingId(patient.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this patient record?')) {
      try {
        await deleteDoc(doc(db, 'patient_records', id));
        setPatients(patients.filter(p => p.id !== id));
        toast.success('Patient record deleted');
      } catch (error) {
        toast.error('Error deleting patient record');
        console.error(error);
      }
    }
  };

  // Toggle attended status
  const handleToggleAttended = async (patient) => {
    try {
      const patientRef = doc(db, 'patient_records', patient.id);
      const newAttendedStatus = !patient.attended;
      const currentDate = formatDate(new Date());
      await updateDoc(patientRef, { attended: newAttendedStatus, updatedAt: currentDate });
      setPatients(patients.map(p => 
        p.id === patient.id ? { ...p, attended: newAttendedStatus, updatedAt: currentDate } : p
      ));
      toast.success(`Patient marked as ${newAttendedStatus ? 'Attended' : 'Unattended'}`);
      // Trigger notification
      await addDoc(collection(db, 'notifications'), {
        type: newAttendedStatus ? 'Patient Attended' : 'Patient Unattended',
        patientId: patient.id,
        message: `${patient.name} - ${newAttendedStatus ? 'Attended' : 'Unattended'}`,
        timestamp: currentDate,
        read: false
      });
    } catch (error) {
      toast.error('Error updating attended status');
      console.error(error);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'Name,Phone,Email,Notes,Attended,Created At\n';
    const rows = filteredPatients.map(p => 
      `${p.name},${p.phone},${p.email},${p.notes || '-'},${p.attended ? 'Yes' : 'No'},${p.createdAt || '-'}`
    ).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patient_records.csv';
    a.click();
    toast.success('Patient records exported');
  };

  // Filter patients
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Patient Timeline
  const fetchPatientTimeline = async (patient) => {
    const appointmentsSnapshot = await getDocs(collection(db, 'bershire dental records'));
    const appointments = appointmentsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: formatDate(data.date) // Format appointment date
        };
      })
      .filter(a => a.patientName === patient.name)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setTimelinePatient({ ...patient, appointments });
  };

  return (
    <div className="main-content" style={{ marginLeft: '280px', padding: '20px' }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <h3 className="fw-bold text-primary">
          <FaUserMd className="me-2" />
          Patient Records
        </h3>
        <button className="btn btn-outline-success rounded-pill" onClick={exportToCSV}>
          <FaDownload className="me-2" /> Export CSV
        </button>
      </div>

      {/* Form */}
      <div className="card shadow-sm mb-4 animate__animated animate__fadeIn">
        <div className="card-body">
          <h5>{editingId ? 'Edit Patient' : 'Add New Patient'}</h5>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-3">
                <input
                  type="text"
                  className="form-control rounded-pill"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-3">
                <input
                  type="tel"
                  className="form-control rounded-pill"
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-3">
                <input
                  type="email"
                  className="form-control rounded-pill"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-3">
                <div className="form-check mt-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="attendedCheck"
                    checked={formData.attended}
                    onChange={(e) => setFormData({ ...formData, attended: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="attendedCheck">
                    Attended
                  </label>
                </div>
              </div>
              <div className="col-12">
                <textarea
                  className="form-control"
                  placeholder="Notes (e.g., medical history)"
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3 rounded-pill px-4" disabled={isLoading}>
              {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : <FaPlus className="me-2" />}
              {editingId ? 'Update' : 'Add'} Patient
            </button>
          </form>
        </div>
      </div>

      {/* Search and Table */}
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="input-group mb-3" style={{ maxWidth: '400px' }}>
            <span className="input-group-text"><FaSearch /></span>
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isLoading ? (
            <div className="text-center py-5">
              <span className="spinner-border spinner-border-lg" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Notes</th>
                    <th>Attended</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(patient => (
                    <tr key={patient.id} className="animate__animated animate__fadeIn">
                      <td>{patient.name}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.email}</td>
                      <td>{patient.notes || '-'}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${patient.attended ? 'btn-success' : 'btn-danger'} rounded-pill`}
                          onClick={() => handleToggleAttended(patient)}
                        >
                          {patient.attended ? <FaCheck /> : <FaTimes />}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-2 rounded-pill" onClick={() => handleEdit(patient)}>
                          <FaEdit />
                        </button>
                        <button className="btn btn-sm btn-outline-danger me-2 rounded-pill" onClick={() => handleDelete(patient.id)}>
                          <FaTrash />
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-info rounded-pill" 
                          onClick={() => fetchPatientTimeline(patient)}
                        >
                          <FaHistory /> Timeline
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Patient Timeline Modal */}
      {timelinePatient && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{timelinePatient.name}'s Timeline</h5>
                <button type="button" className="btn-close" onClick={() => setTimelinePatient(null)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Attended:</strong> {timelinePatient.attended ? 'Yes' : 'No'}</p>
                <div className="timeline">
                  {timelinePatient.appointments.map((appt, index) => (
                    <div key={appt.id} className="timeline-item">
                      <div className="timeline-dot" style={{ backgroundColor: appt.paymentStatus === 'Attended' ? '#28a745' : '#dc3545' }}></div>
                      <div className="timeline-content">
                        <p><strong>{appt.date}</strong> - {appt.service}</p>
                        <p>Status: {appt.paymentStatus} | Amount: KSh {appt.payment.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary rounded-pill" onClick={() => setTimelinePatient(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom CSS
const styles = `
  .main-content {
    min-height: 100vh;
    background-color: #f8f9fa;
    width: calc(100% - 280px);
    transition: all 0.3s;
  }
  .card { border: none; border-radius: 15px; transition: transform 0.2s; }
  .card:hover { transform: translateY(-5px); }
  .form-control, .btn { transition: all 0.3s; }
  .form-control:focus { box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25); }
  .rounded-pill { border-radius: 50rem !important; }
  .table-hover tbody tr:hover { background-color: rgba(0, 0, 0, 0.05); }
  .modal-content { border-radius: 15px; }
  .timeline {
    position: relative;
    padding: 20px 0;
  }
  .timeline-item {
    position: relative;
    margin-bottom: 20px;
  }
  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    position: absolute;
    left: -30px;
    top: 5px;
  }
  .timeline-content {
    background: #fff;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  }
  @media (max-width: 768px) {
    .main-content { margin-left: 0; width: 100%; }
  }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default PatientRecordsComponent;