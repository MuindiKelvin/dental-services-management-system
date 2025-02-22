import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup, Dropdown, Pagination } from 'react-bootstrap';
import { FaCalendarPlus, FaSearch, FaFilter, FaDownload, FaEdit, FaTrash } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const AppointmentBookingComponent = () => {
  const [appointments, setAppointments] = useState([]);
  const [formData, setFormData] = useState({
    patientName: '',
    date: '',
    service: '',
    payment: 0,
    notes: '',
    location: 'Tassia-Magic Square' // Default location
  });
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(5); // Fixed records per page, can be made configurable

  // Services in KShs
  const services = {
    'Dental Cleaning': 5000,
    'Tooth Filling': 10000,
    'Tooth Extraction': 15000,
    'Root Canal': 30000,
    'Teeth Whitening': 20000,
    'Dental Checkup': 3000,
    'Crown Installation': 25000,
    'Orthodontic Consultation': 8000
  };

  const locations = ['Tassia-Magic Square', 'Machakos', 'Tassia-Hill'];

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'bershire dental records'));
        const data = querySnapshot.docs.map(doc => {
          const docData = doc.data();
          // Ensure status is either "Attended" or "Unattended" (default to "Unattended" if invalid)
          const status = docData.paymentStatus === 'Attended' ? 'Attended' : 'Unattended';
          return { id: doc.id, ...docData, paymentStatus: status };
        });
        setAppointments(data);
      } catch (error) {
        toast.error('Error fetching appointments');
        console.error(error);
      }
      setIsLoading(false);
    };
    fetchAppointments();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const appointmentData = {
        ...formData,
        timestamp: new Date().toISOString(),
        paymentStatus: editingId ? formData.paymentStatus : 'Unattended' // Default to "Unattended" for new appointments
      };
      if (editingId) {
        const appointmentRef = doc(db, 'bershire dental records', editingId);
        await updateDoc(appointmentRef, appointmentData);
        setAppointments(appointments.map(app => 
          app.id === editingId ? { ...app, ...appointmentData } : app
        ));
        toast.success('Appointment updated successfully');
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'bershire dental records'), appointmentData);
        setAppointments([...appointments, { id: docRef.id, ...appointmentData }]);
        toast.success('Appointment booked successfully');
      }
      setFormData({ patientName: '', date: '', service: '', payment: 0, notes: '', location: 'Tassia-Magic Square' });
    } catch (error) {
      toast.error('Error saving appointment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Edit and Delete handlers
  const handleEdit = (appointment) => {
    setFormData(appointment);
    setEditingId(appointment.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await deleteDoc(doc(db, 'bershire dental records', id));
        setAppointments(appointments.filter(app => app.id !== id));
        toast.success('Appointment deleted successfully');
      } catch (error) {
        toast.error('Error deleting appointment');
        console.error(error);
      }
    }
  };

  // Update Status
  const handleStatusChange = async (id, newStatus) => {
    try {
      const appointmentRef = doc(db, 'bershire dental records', id);
      await updateDoc(appointmentRef, { paymentStatus: newStatus });
      setAppointments(appointments.map(app => 
        app.id === id ? { ...app, paymentStatus: newStatus } : app
      ));
      toast.success('Status updated successfully');
    } catch (error) {
      toast.error('Error updating status');
      console.error(error);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = 'ID,Patient,Date,Service,Amount (KSh),Status,Location,Notes\n';
    const rows = filteredAppointments.map((app, index) => 
      `${index + 1},${app.patientName},${new Date(app.date).toLocaleString()},${app.service},${app.payment},${app.paymentStatus},${app.location || '-'},${app.notes || ''}`
    ).join('\n');
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments.csv';
    a.click();
    toast.success('Appointments exported');
  };

  // Filter and paginate appointments
  const filteredAppointments = appointments
    .filter(app => 
      app.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.service.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(app => filterStatus === 'All' || app.paymentStatus === filterStatus);

  const totalPages = Math.ceil(filteredAppointments.length / recordsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  return (
    <Container fluid className="main-content" style={{ marginLeft: '280px', padding: '20px' }}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Section */}
      <Row className="mb-4 align-items-center">
        <Col>
          <h3 className="fw-bold text-primary d-flex align-items-center">
            <FaCalendarPlus className="me-2" />
            {editingId ? 'Edit Appointment' : 'Book New Appointment'}
          </h3>
        </Col>
        <Col className="d-flex justify-content-end">
          <Button variant="outline-success" className="rounded-pill" onClick={exportToCSV}>
            <FaDownload className="me-2" /> Export CSV
          </Button>
        </Col>
      </Row>

      {/* Form Section */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Control
                  type="text"
                  placeholder="Patient Name"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  required
                  className="rounded-pill"
                />
              </Col>
              <Col md={6}>
                <Form.Control
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="rounded-pill"
                />
              </Col>
              <Col md={6}>
                <Form.Select
                  value={formData.service}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    service: e.target.value,
                    payment: services[e.target.value] || 0
                  })}
                  required
                  className="rounded-pill"
                >
                  <option value="">Select Service</option>
                  {Object.keys(services).map(service => (
                    <option key={service} value={service}>
                      {service} (KSh {services[service].toLocaleString()})
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Control
                  type="text"
                  placeholder="Amount (KSh)"
                  value={formData.payment}
                  readOnly
                  className="rounded-pill"
                />
              </Col>
              <Col md={6}>
                <Form.Select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                  className="rounded-pill"
                >
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Control
                  as="textarea"
                  placeholder="Additional Notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Col>
            </Row>
            <Button 
              type="submit" 
              variant="primary" 
              className="mt-3 rounded-pill px-4" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : null}
              {editingId ? 'Update' : 'Book'} Appointment
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {/* Appointments Table */}
      <Card className="shadow-sm">
        <Card.Body>
          <Row className="mb-3 flex-wrap gap-3">
            <Col md={6} lg={4}>
              <InputGroup>
                <InputGroup.Text><FaSearch /></InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search appointments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6} lg={4}>
              <InputGroup>
                <InputGroup.Text><FaFilter /></InputGroup.Text>
                <Form.Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Attended">Attended</option>
                  <option value="Unattended">Unattended</option>
                </Form.Select>
              </InputGroup>
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
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Amount (KSh)</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppointments.map((appointment, index) => (
                    <tr key={appointment.id}>
                      <td>{(currentPage - 1) * recordsPerPage + index + 1}</td>
                      <td>{appointment.patientName}</td>
                      <td>{new Date(appointment.date).toLocaleString()}</td>
                      <td>{appointment.service}</td>
                      <td>{appointment.payment.toLocaleString()}</td>
                      <td>
                        <Dropdown
                          onSelect={(eventKey) => handleStatusChange(appointment.id, eventKey)}
                        >
                          <Dropdown.Toggle
                            variant={
                              appointment.paymentStatus === 'Attended' ? 'success' : 'warning'
                            }
                            size="sm"
                            className="rounded-pill"
                          >
                            {appointment.paymentStatus}
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item eventKey="Attended">Attended</Dropdown.Item>
                            <Dropdown.Item eventKey="Unattended">Unattended</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                      <td>{appointment.location || '-'}</td>
                      <td>{appointment.notes || '-'}</td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2" 
                          onClick={() => handleEdit(appointment)}
                        >
                          <FaEdit />
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm" 
                          onClick={() => handleDelete(appointment.id)}
                        >
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              <Pagination className="justify-content-center mt-3">
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
              <div className="text-center mt-2">
                Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, filteredAppointments.length)} of {filteredAppointments.length} appointments
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AppointmentBookingComponent;