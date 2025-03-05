import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup, Dropdown, Pagination, FormControl } from 'react-bootstrap';
import { FaCalendarPlus, FaSearch, FaFilter, FaDownload, FaEdit, FaTrash } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const AppointmentBookingComponent = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [formData, setFormData] = useState({
    patientName: '',
    date: '',
    service: '',
    payment: 0,
    paymentHistory: [], // Added to track payments
    notes: '',
    location: 'Tassia-Magic Square',
  });
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(5);

  const services = {
    'Dental Cleaning': 5000,
    'Tooth Filling': 10000,
    'Tooth Extraction': 15000,
    'Root Canal': 30000,
    'Teeth Whitening': 20000,
    'Dental Checkup': 3000,
    'Crown Installation': 25000,
    'Orthodontic Consultation': 8000,
  };

  const locations = ['Tassia-Magic Square', 'Machakos', 'Tassia-Hill'];

  // Format date to match PaymentManagerComponent
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
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

  // Fetch appointments and patients
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch appointments
        const appointmentSnapshot = await getDocs(collection(db, 'bershire dental records'));
        const appointmentData = appointmentSnapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            paymentHistory: (docData.paymentHistory || []).map((payment) => ({
              ...payment,
              date: formatDate(payment.date),
            })),
            timestamp: docData.timestamp ? formatDate(docData.timestamp) : null,
          };
        });

        // Fetch patient records for attendance status
        const patientSnapshot = await getDocs(collection(db, 'patient_records'));
        const patientData = patientSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          attended: doc.data().attended || false,
        }));
        setPatients(patientData);

        // Combine appointment and patient data to determine status
        const enrichedAppointments = appointmentData.map((appointment) => {
          const patient = patientData.find((p) => p.name === appointment.patientName);
          const paidSoFar = (appointment.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0) || 0;
          const totalAmount = appointment.payment || 0;
          const attendanceStatus = patient ? (patient.attended ? 'Fully Attended' : 'Not Attended') : 'Not Attended';
          let paymentStatus;

          if (totalAmount === 0) {
            paymentStatus = 'No Payment Required';
          } else if (paidSoFar === 0) {
            paymentStatus = 'Unpaid';
          } else if (paidSoFar < totalAmount) {
            paymentStatus = 'Partially Paid';
          } else {
            paymentStatus = 'Fully Paid';
          }

          const combinedStatus =
            paymentStatus === 'No Payment Required'
              ? attendanceStatus
              : `${attendanceStatus} - ${paymentStatus}`;

          return {
            ...appointment,
            paymentStatus: combinedStatus,
          };
        });

        setAppointments(enrichedAppointments);
      } catch (error) {
        toast.error('Error fetching data');
        console.error(error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Handle patient selection and clear search
  const handlePatientSelect = (patientName) => {
    const patient = patients.find((p) => p.name === patientName);
    const attendanceStatus = patient?.attended ? 'Fully Attended' : 'Not Attended';
    setFormData({
      ...formData,
      patientName,
      paymentStatus: `${attendanceStatus} - Unpaid`, // Default new appointment to Unpaid
    });
    setPatientSearch('');
  };

  // Filter patients based on search
  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.patientName) {
      toast.error('Please select a patient');
      return;
    }
    setIsLoading(true);
    try {
      const appointmentData = {
        ...formData,
        timestamp: formatDate(new Date()),
        paymentHistory: formData.paymentHistory || [],
        paymentStatus: editingId ? formData.paymentStatus : formData.paymentStatus || 'Not Attended - Unpaid',
      };
      if (editingId) {
        const appointmentRef = doc(db, 'bershire dental records', editingId);
        await updateDoc(appointmentRef, appointmentData);
        setAppointments(appointments.map((app) =>
          app.id === editingId ? { ...app, ...appointmentData } : app
        ));
        toast.success('Appointment updated successfully');
        setEditingId(null);
      } else {
        const docRef = await addDoc(collection(db, 'bershire dental records'), appointmentData);
        setAppointments([...appointments, { id: docRef.id, ...appointmentData }]);
        toast.success('Appointment booked successfully');
      }
      setFormData({
        patientName: '',
        date: '',
        service: '',
        payment: 0,
        paymentHistory: [],
        notes: '',
        location: 'Tassia-Magic Square',
      });
      setPatientSearch('');
    } catch (error) {
      toast.error('Error saving appointment');
      console.error(error);
    }
    setIsLoading(false);
  };

  // Edit handler
  const handleEdit = (appointment) => {
    setFormData(appointment);
    setPatientSearch('');
    setEditingId(appointment.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete handler
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await deleteDoc(doc(db, 'bershire dental records', id));
        setAppointments(appointments.filter((app) => app.id !== id));
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
      setAppointments(appointments.map((app) =>
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
    const rows = filteredAppointments
      .map((app, index) =>
        `${index + 1},${app.patientName},${new Date(app.date).toLocaleString()},${app.service},${app.payment},${app.paymentStatus},${app.location || '-'},${app.notes || ''}`
      )
      .join('\n');
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
    .filter((app) =>
      app.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.service.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((app) => filterStatus === 'All' || app.paymentStatus.includes(filterStatus.split(' - ')[1] || filterStatus));

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
                <InputGroup>
                  <InputGroup.Text><FaSearch /></InputGroup.Text>
                  <FormControl
                    type="text"
                    placeholder="Search Patient Name"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="rounded-pill"
                  />
                </InputGroup>
                {patientSearch && (
                  <div
                    className="border rounded mt-2"
                    style={{ maxHeight: '150px', overflowY: 'auto', position: 'absolute', zIndex: 1000, backgroundColor: 'white' }}
                  >
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <div
                          key={patient.id}
                          className="p-2 hover:bg-light cursor-pointer"
                          onClick={() => handlePatientSelect(patient.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          {patient.name}
                        </div>
                      ))
                    ) : (
                      <div className="p-2 text-muted">No patients found</div>
                    )}
                  </div>
                )}
                {formData.patientName && !patientSearch && (
                  <div className="mt-2 text-primary fw-bold">Selected: {formData.patientName}</div>
                )}
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
                    payment: services[e.target.value] || 0,
                  })}
                  required
                  className="rounded-pill"
                >
                  <option value="">Select Service</option>
                  {Object.keys(services).map((service) => (
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
                  {locations.map((location) => (
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
              {isLoading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
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
                  <option value="Fully Attended">Fully Attended</option>
                  <option value="Not Attended">Not Attended</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Fully Paid">Fully Paid</option>
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
                  {paginatedAppointments.map((appointment, index) => {
                    const statusParts = appointment.paymentStatus.split(' - ');
                    const paymentStatus = statusParts[1] || '';
                    return (
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
                                paymentStatus === 'Fully Paid'
                                  ? 'success'
                                  : paymentStatus === 'Partially Paid'
                                  ? 'info'
                                  : paymentStatus === 'Unpaid'
                                  ? 'warning'
                                  : 'secondary'
                              }
                              size="sm"
                              className="rounded-pill"
                            >
                              {appointment.paymentStatus}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item eventKey="Fully Attended - Unpaid">
                                Fully Attended - Unpaid
                              </Dropdown.Item>
                              <Dropdown.Item eventKey="Fully Attended - Partially Paid">
                                Fully Attended - Partially Paid
                              </Dropdown.Item>
                              <Dropdown.Item eventKey="Fully Attended - Fully Paid">
                                Fully Attended - Fully Paid
                              </Dropdown.Item>
                              <Dropdown.Item eventKey="Not Attended - Unpaid">
                                Not Attended - Unpaid
                              </Dropdown.Item>
                              <Dropdown.Item eventKey="Not Attended - Partially Paid">
                                Not Attended - Partially Paid
                              </Dropdown.Item>
                              <Dropdown.Item eventKey="Not Attended - Fully Paid">
                                Not Attended - Fully Paid
                              </Dropdown.Item>
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
                    );
                  })}
                </tbody>
              </Table>

              {/* Pagination */}
              <Pagination className="justify-content-center mt-3">
                <Pagination.Prev
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
              <div className="text-center mt-2">
                Showing {(currentPage - 1) * recordsPerPage + 1} to{' '}
                {Math.min(currentPage * recordsPerPage, filteredAppointments.length)} of{' '}
                {filteredAppointments.length} appointments
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AppointmentBookingComponent;