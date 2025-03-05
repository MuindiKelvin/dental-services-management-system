import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { FaUserMd, FaSearch, FaDownload, FaPlus, FaEdit, FaTrash, FaHistory } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup, Dropdown, Pagination } from 'react-bootstrap';

const PatientRecordsComponent = () => {
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '', attended: 'Not Attended' });
  const [editingId, setEditingId] = useState(null);
  const [timelinePatient, setTimelinePatient] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(5);

  // Format date to "March 5, 2025 at 2:30:45 PM"
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    if (typeof timestamp === 'string' && /\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2}:\d{2} (AM|PM)/.test(timestamp)) {
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

  // Fetch patient records
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'patient_records'));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          attended: doc.data().attended ?? false, // Default to false for backward compatibility
          createdAt: doc.data().createdAt ? formatDate(doc.data().createdAt) : null,
          updatedAt: doc.data().updatedAt ? formatDate(doc.data().updatedAt) : null,
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
      const attendedBool = formData.attended === 'Attended'; // Convert dropdown value to boolean for storage
      const patientData = { ...formData, attended: attendedBool };

      if (editingId) {
        const patientRef = doc(db, 'patient_records', editingId);
        const oldPatient = patients.find(p => p.id === editingId);
        await updateDoc(patientRef, { ...patientData, updatedAt: currentDate });
        setPatients(patients.map(p => (p.id === editingId ? { ...p, ...patientData, updatedAt: currentDate } : p)));
        toast.success('Patient record updated');
        if (oldPatient.attended !== attendedBool) {
          await addDoc(collection(db, 'notifications'), {
            type: attendedBool ? 'Patient Attended' : 'Patient Unattended',
            patientId: editingId,
            message: `${formData.name} - ${attendedBool ? 'Attended' : 'Unattended'}`,
            timestamp: currentDate,
            read: false,
          });
        }
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'patient_records'), { ...patientData, createdAt: currentDate });
        setPatients([...patients, { id: docRef.id, ...patientData, createdAt: currentDate }]);
        toast.success('Patient record added');
      }
      setFormData({ name: '', phone: '', email: '', notes: '', attended: 'Not Attended' });
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
      attended: patient.attended ? 'Attended' : 'Not Attended' // Convert boolean to dropdown value
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

  // Update attended status via dropdown
  const handleStatusChange = async (id, newStatus) => {
    try {
      const patientRef = doc(db, 'patient_records', id);
      const attendedBool = newStatus === 'Attended';
      const currentDate = formatDate(new Date());
      await updateDoc(patientRef, { attended: attendedBool, updatedAt: currentDate });
      setPatients(patients.map(p => 
        p.id === id ? { ...p, attended: attendedBool, updatedAt: currentDate } : p
      ));
      toast.success(`Patient marked as ${newStatus}`);
      await addDoc(collection(db, 'notifications'), {
        type: attendedBool ? 'Patient Attended' : 'Patient Unattended',
        patientId: id,
        message: `${patients.find(p => p.id === id).name} - ${newStatus}`,
        timestamp: currentDate,
        read: false,
      });
    } catch (error) {
      toast.error('Error updating status');
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

  // Pagination logic
  const totalPages = Math.ceil(filteredPatients.length / recordsPerPage);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
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
          date: formatDate(data.date),
        };
      })
      .filter(a => a.patientName === patient.name)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    setTimelinePatient({ ...patient, appointments });
  };

  return (
    <Container fluid className="main-content" style={{ marginLeft: '280px', padding: '20px' }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h3 className="fw-bold text-primary d-flex align-items-center">
            <FaUserMd className="me-2" />
            Patient Records
          </h3>
        </Col>
        <Col className="d-flex justify-content-end">
          <Button variant="outline-success" className="rounded-pill" onClick={exportToCSV}>
            <FaDownload className="me-2" /> Export CSV
          </Button>
        </Col>
      </Row>

      {/* Innovative Form */}
      <Card className="shadow-sm mb-4 animate__animated animate__fadeIn futuristic-card">
        <Card.Body>
          <h5 className="text-center mb-4">{editingId ? 'Edit Patient Profile' : 'Add New Patient'}</h5>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3 align-items-center">
              <Col md={3}>
                <InputGroup>
                  <InputGroup.Text className="futuristic-input-icon"><FaUserMd /></InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Patient Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="rounded-pill futuristic-input"
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <InputGroup>
                  <InputGroup.Text className="futuristic-input-icon">📞</InputGroup.Text>
                  <Form.Control
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="rounded-pill futuristic-input"
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <InputGroup>
                  <InputGroup.Text className="futuristic-input-icon">✉️</InputGroup.Text>
                  <Form.Control
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="rounded-pill futuristic-input"
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <Form.Select
                  value={formData.attended}
                  onChange={(e) => setFormData({ ...formData, attended: e.target.value })}
                  className="rounded-pill futuristic-select"
                >
                  <option value="Not Attended">Not Attended</option>
                  <option value="Attended">Attended</option>
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Control
                  as="textarea"
                  placeholder="Notes (e.g., medical history, allergies)"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="futuristic-textarea"
                />
              </Col>
            </Row>
            <div className="text-center mt-4">
              <Button
                type="submit"
                variant="primary"
                className="rounded-pill px-4 futuristic-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <FaPlus className="me-2" />
                )}
                {editingId ? 'Update Profile' : 'Add Patient'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Search, Records Per Page, and Table */}
      <Card className="shadow-sm">
        <Card.Body>
          <Row className="mb-3 flex-wrap gap-3 align-items-center">
            <Col md={6} lg={4}>
              <InputGroup>
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-pill"
                />
              </InputGroup>
            </Col>
            <Col md={6} lg={4}>
              <Form.Select
                value={recordsPerPage}
                onChange={(e) => {
                  setRecordsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-pill"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </Form.Select>
            </Col>
          </Row>

          {isLoading ? (
            <div className="text-center py-5">
              <span className="spinner-border spinner-border-lg" />
            </div>
          ) : (
            <>
              <Table responsive hover className="align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map(patient => (
                    <tr key={patient.id} className="animate__animated animate__fadeIn">
                      <td>{patient.name}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.email}</td>
                      <td>{patient.notes || '-'}</td>
                      <td>
                        <Dropdown
                          onSelect={(eventKey) => handleStatusChange(patient.id, eventKey)}
                        >
                          <Dropdown.Toggle
                            variant={patient.attended ? 'success' : 'danger'}
                            size="sm"
                            className="rounded-pill"
                          >
                            {patient.attended ? 'Attended' : 'Not Attended'}
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item eventKey="Attended">Attended</Dropdown.Item>
                            <Dropdown.Item eventKey="Not Attended">Not Attended</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2 rounded-pill"
                          onClick={() => handleEdit(patient)}
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          className="me-2 rounded-pill"
                          onClick={() => handleDelete(patient.id)}
                        >
                          <FaTrash />
                        </Button>
                        <Button
                          variant="outline-info"
                          size="sm"
                          className="rounded-pill"
                          onClick={() => fetchPatientTimeline(patient)}
                        >
                          <FaHistory /> Timeline
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              <Row className="mt-3 align-items-center">
                <Col className="d-flex justify-content-center">
                  <Pagination>
                    <Pagination.Prev
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    />
                    {[...Array(totalPages)].map((_, i) => (
                      <Pagination.Item
                        key={i + 1}
                        active={i + 1 === currentPage}
                        onClick={() => setCurrentPage(i + 1)}
                      >
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    />
                  </Pagination>
                </Col>
                <Col className="text-center">
                  Showing {(currentPage - 1) * recordsPerPage + 1} to{' '}
                  {Math.min(currentPage * recordsPerPage, filteredPatients.length)} of{' '}
                  {filteredPatients.length} patients
                </Col>
              </Row>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Patient Timeline Modal */}
      {timelinePatient && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content futuristic-modal">
              <div className="modal-header">
                <h5 className="modal-title">{timelinePatient.name}'s Timeline</h5>
                <button type="button" className="btn-close" onClick={() => setTimelinePatient(null)}></button>
              </div>
              <div className="modal-body">
                <p><strong>Status:</strong> {timelinePatient.attended ? 'Attended' : 'Not Attended'}</p>
                <div className="timeline">
                  {timelinePatient.appointments.map((appt, index) => (
                    <div key={appt.id} className="timeline-item">
                      <div className="timeline-dot" style={{ backgroundColor: appt.paymentStatus.includes('Fully Paid') ? '#28a745' : '#dc3545' }}></div>
                      <div className="timeline-content">
                        <p><strong>{appt.date}</strong> - {appt.service}</p>
                        <p>Status: {appt.paymentStatus} | Amount: KSh {appt.payment.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <Button className="rounded-pill futuristic-btn" onClick={() => setTimelinePatient(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
};

// Custom CSS with Innovative Styling
const styles = `
  .main-content {
    min-height: 100vh;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    width: calc(100% - 280px);
    transition: all 0.3s;
  }
  .futuristic-card {
    border: none;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .futuristic-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  }
  .futuristic-input, .futuristic-select, .futuristic-textarea {
    border: 1px solid #007bff33;
    background: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.05);
  }
  .futuristic-input:focus, .futuristic-select:focus, .futuristic-textarea:focus {
    border-color: #007bff;
    box-shadow: 0 0 10px #007bff66, inset 0 2px 5px rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 1);
  }
  .futuristic-input-icon {
    background: #007bff22;
    border: none;
    color: #007bff;
  }
  .futuristic-btn {
    position: relative;
    overflow: hidden;
    background: linear-gradient(90deg, #007bff, #0056b3);
    color: white;
    transition: all 0.3s ease;
  }
  .futuristic-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 15px #007bff66;
    background: linear-gradient(90deg, #0056b3, #007bff);
  }
  .futuristic-btn::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease;
  }
  .futuristic-btn:hover::after {
    width: 200%;
    height: 200%;
  }
  .futuristic-modal {
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
    transition: transform 0.2s;
  }
  .timeline-content:hover {
    transform: scale(1.02);
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

export default PatientRecordsComponent;