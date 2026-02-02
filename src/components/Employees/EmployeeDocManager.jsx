import React, { useState, useEffect } from 'react';
import { axiosClient } from '../api/axiosClient';
import './EmployeeDocManager.css';

const EmployeeDocManager = () => {
  const [employees, setEmployees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    nationality: '',
    position: '',
    phone: '',
    passportNumber: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    iqamaNumber: '',
    iqamaIssueDate: '',
    iqamaExpiryDate: ''
  });

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees();
    fetchAlerts();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      alert('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axiosClient.get('/employees/alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const calculateDaysUntilExpiry = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDocumentStatus = (expiryDate) => {
    const daysLeft = calculateDaysUntilExpiry(expiryDate);
    if (daysLeft < 0) return 'expired';
    if (daysLeft <= 90) return 'expiring';
    return 'valid';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getFilteredEmployees = () => {
    let filtered = employees;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.nationality.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (currentFilter !== 'all') {
      filtered = filtered.filter(emp => {
        const passportStatus = getDocumentStatus(emp.passport.expiryDate);
        const iqamaStatus = getDocumentStatus(emp.iqama.expiryDate);

        if (currentFilter === 'expired') {
          return passportStatus === 'expired' || iqamaStatus === 'expired';
        }
        if (currentFilter === 'expiring') {
          return passportStatus === 'expiring' || iqamaStatus === 'expiring';
        }
        if (currentFilter === 'valid') {
          return passportStatus === 'valid' && iqamaStatus === 'valid';
        }
        return true;
      });
    }

    return filtered;
  };

  const openAddEmployeeModal = () => {
    setEditingEmployeeId(null);
    setFormData({
      name: '',
      nationality: '',
      position: '',
      phone: '',
      passportNumber: '',
      passportIssueDate: '',
      passportExpiryDate: '',
      iqamaNumber: '',
      iqamaIssueDate: '',
      iqamaExpiryDate: ''
    });
    setUploadedFiles([]);
    setShowModal(true);
  };

  const openEditEmployeeModal = (emp) => {
    setEditingEmployeeId(emp.id);
    setFormData({
      name: emp.name,
      nationality: emp.nationality,
      position: emp.position || '',
      phone: emp.phone || '',
      passportNumber: emp.passport.number || '',
      passportIssueDate: emp.passport.issueDate || '',
      passportExpiryDate: emp.passport.expiryDate || '',
      iqamaNumber: emp.iqama.number || '',
      iqamaIssueDate: emp.iqama.issueDate || '',
      iqamaExpiryDate: emp.iqama.expiryDate || ''
    });
    setUploadedFiles(emp.files || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // ✅ UPDATED: Store actual File objects
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const fileObjects = files.map(file => ({
      file: file, // Store actual File object
      name: file.name,
      type: file.type.includes('pdf') ? 'PDF' : 'Image'
    }));
    setUploadedFiles([...uploadedFiles, ...fileObjects]);
  };

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  // ✅ UPDATED: Upload files separately with FormData
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const employeeData = {
        name: formData.name,
        nationality: formData.nationality,
        position: formData.position,
        phone: formData.phone,
        passportNumber: formData.passportNumber,
        passportIssueDate: formData.passportIssueDate,
        passportExpiryDate: formData.passportExpiryDate,
        iqamaNumber: formData.iqamaNumber,
        iqamaIssueDate: formData.iqamaIssueDate,
        iqamaExpiryDate: formData.iqamaExpiryDate,
        files: [] // Empty for now, will upload separately
      };

      let employeeId;

      if (editingEmployeeId) {
        // Update existing employee
        await axiosClient.patch(`/employees/${editingEmployeeId}`, employeeData);
        employeeId = editingEmployeeId;
      } else {
        // Create new employee
        const response = await axiosClient.post('/employees', employeeData);
        employeeId = response.data.id;
      }

      // ✅ Upload files if any
      if (uploadedFiles.length > 0 && uploadedFiles.some(f => f.file)) {
        const formDataUpload = new FormData();
        uploadedFiles.forEach((fileObj) => {
          if (fileObj.file) {
            formDataUpload.append('files', fileObj.file);
          }
        });

        await axiosClient.post(`/employees/${employeeId}/upload`, formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      closeModal();
      fetchEmployees();
      fetchAlerts();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Failed to save employee: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      setLoading(true);
      try {
        await axiosClient.delete(`/employees/${id}`);
        fetchEmployees();
        fetchAlerts();
      } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Failed to delete employee');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredEmployees = getFilteredEmployees();

  return (
    <div className="employee-doc-manager-container">
      <div className="employee-doc-manager-header">
        <h1>📋 Employee Documentation Manager</h1>
        <p>Manage passports, work permits (إقامة العمل), and important documents for all employees</p>
      </div>

      <div className="employee-doc-manager-alerts-section">
        <h2>⚠️ Upcoming Renewals & Expired Documents</h2>
        <div className="employee-doc-manager-alerts-list">
          {alerts.length === 0 ? (
            <div className="employee-doc-manager-alert-item">
              <div>✅ All documents are valid! No upcoming renewals in the next 90 days.</div>
            </div>
          ) : (
            alerts.map((alert, index) => (
              <div key={index} className={`employee-doc-manager-alert-item ${alert.urgent ? 'urgent' : 'warning'}`}>
                <div>
                  <strong>{alert.employee}</strong> - {alert.document}
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                    {alert.days < 0 ? 
                      `⛔ Expired ${Math.abs(alert.days)} days ago` : 
                      `⏰ Expires in ${alert.days} days`}
                  </div>
                </div>
                <span className={`employee-doc-manager-status-badge ${alert.days < 0 ? 'status-expired' : alert.urgent ? 'status-expired' : 'status-expiring'}`}>
                  {alert.days < 0 ? 'EXPIRED' : alert.urgent ? 'URGENT' : 'ATTENTION'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="employee-doc-manager-controls">
        <div className="employee-doc-manager-search-box">
          <input 
            type="text" 
            placeholder="🔍 Search by name or nationality..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          className="employee-doc-manager-btn employee-doc-manager-btn-primary" 
          onClick={openAddEmployeeModal}
          disabled={loading}
        >
          ➕ Add New Employee
        </button>
      </div>

      <div className="employee-doc-manager-filter-buttons">
        <button 
          className={`employee-doc-manager-filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('all')}
        >
          All Employees
        </button>
        <button 
          className={`employee-doc-manager-filter-btn ${currentFilter === 'valid' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('valid')}
        >
          ✅ Valid Documents
        </button>
        <button 
          className={`employee-doc-manager-filter-btn ${currentFilter === 'expiring' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('expiring')}
        >
          ⚠️ Expiring Soon
        </button>
        <button 
          className={`employee-doc-manager-filter-btn ${currentFilter === 'expired' ? 'active' : ''}`}
          onClick={() => setCurrentFilter('expired')}
        >
          ❌ Expired
        </button>
      </div>

      {loading && !showModal && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}

      <div className="employee-doc-manager-employees-grid">
        {filteredEmployees.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>
            No employees found matching your criteria.
          </div>
        ) : (
          filteredEmployees.map(emp => {
            const passportStatus = getDocumentStatus(emp.passport.expiryDate);
            const iqamaStatus = getDocumentStatus(emp.iqama.expiryDate);
            const passportDays = calculateDaysUntilExpiry(emp.passport.expiryDate);
            const iqamaDays = calculateDaysUntilExpiry(emp.iqama.expiryDate);

            return (
              <div key={emp.id} className="employee-doc-manager-employee-card">
                <div className="employee-doc-manager-employee-header">
                  <div className="employee-doc-manager-employee-avatar">{emp.name.charAt(0)}</div>
                  <div className="employee-doc-manager-employee-info">
                    <h3>{emp.name}</h3>
                    <p>🌍 {emp.nationality} • {emp.position || 'Employee'}</p>
                  </div>
                </div>

                <div className="employee-doc-manager-document-section">
                  <h4>📘 Passport</h4>
                  <div className="employee-doc-manager-document-item">
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Number:</span>
                      <span className="employee-doc-manager-document-value">{emp.passport.number || '-'}</span>
                    </div>
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Expiry Date:</span>
                      <span className="employee-doc-manager-document-value">{formatDate(emp.passport.expiryDate)}</span>
                    </div>
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Status:</span>
                      <span className={`employee-doc-manager-status-badge status-${passportStatus}`}>
                        {passportStatus === 'valid' ? '✅ Valid' : 
                          passportStatus === 'expiring' ? '⚠️ Expiring Soon' : 
                          '❌ Expired'}
                      </span>
                    </div>
                    <div className={`employee-doc-manager-days-left ${passportDays <= 30 ? 'urgent' : ''}`}>
                      {passportDays < 0 ? 
                        `Expired ${Math.abs(passportDays)} days ago` : 
                        `${passportDays} days remaining`}
                    </div>
                  </div>
                </div>

                <div className="employee-doc-manager-document-section">
                  <h4>🏢 Work Permit (إقامة العمل)</h4>
                  <div className="employee-doc-manager-document-item">
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Number:</span>
                      <span className="employee-doc-manager-document-value">{emp.iqama.number || '-'}</span>
                    </div>
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Expiry Date:</span>
                      <span className="employee-doc-manager-document-value">{formatDate(emp.iqama.expiryDate)}</span>
                    </div>
                    <div className="employee-doc-manager-document-row">
                      <span className="employee-doc-manager-document-label">Status:</span>
                      <span className={`employee-doc-manager-status-badge status-${iqamaStatus}`}>
                        {iqamaStatus === 'valid' ? '✅ Valid' : 
                          iqamaStatus === 'expiring' ? '⚠️ Expiring Soon' : 
                          '❌ Expired'}
                      </span>
                    </div>
                    <div className={`employee-doc-manager-days-left ${iqamaDays <= 30 ? 'urgent' : ''}`}>
                      {iqamaDays < 0 ? 
                        `Expired ${Math.abs(iqamaDays)} days ago` : 
                        `${iqamaDays} days remaining`}
                    </div>
                  </div>
                </div>

                {/* ✅ UPDATED: Clickable file links */}
                <div className="employee-doc-manager-files-section">
                  <h5>📎 Uploaded Files</h5>
                  <div className="employee-doc-manager-file-list">
                    {emp.files && emp.files.length > 0 ? (
                      emp.files.map((file, index) => (
                        <div key={index} className="employee-doc-manager-file-item">
                          <a 
                            href={`${axiosClient.defaults.baseURL}${file.url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="employee-doc-manager-file-name"
                            style={{ cursor: 'pointer', textDecoration: 'none', color: '#3498db' }}
                          >
                            📄 {file.name}
                          </a>
                          <span style={{ fontSize: '11px', color: '#7f8c8d' }}>{file.type}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: '#aaa' }}>No files uploaded</div>
                    )}
                  </div>
                </div>

                <div className="employee-doc-manager-action-buttons">
                  <button 
                    className="employee-doc-manager-btn employee-doc-manager-btn-primary employee-doc-manager-btn-small" 
                    onClick={() => openEditEmployeeModal(emp)}
                    disabled={loading}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="employee-doc-manager-btn employee-doc-manager-btn-secondary employee-doc-manager-btn-small" 
                    onClick={() => deleteEmployee(emp.id)}
                    disabled={loading}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="employee-doc-manager-modal active">
          <div className="employee-doc-manager-modal-content">
            <div className="employee-doc-manager-modal-header">
              <h2>{editingEmployeeId ? 'Edit Employee' : 'Add New Employee'}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="employee-doc-manager-form-group">
                <label>Full Name *</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Nationality *</label>
                <select 
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Nationality</option>
                  <option value="Egyptian">Egyptian (مصري)</option>
                  <option value="Sudanese">Sudanese (سوداني)</option>
                  <option value="Nigerian">Nigerian</option>
                  <option value="Ethiopian">Ethiopian</option>
                  <option value="Kenyan">Kenyan</option>
                  <option value="Ghanaian">Ghanaian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Position</label>
                <input 
                  type="text" 
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <hr style={{ margin: '25px 0', border: 'none', borderTop: '2px solid #e0e0e0' }} />

              <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>📘 Passport Information</h3>

              <div className="employee-doc-manager-form-group">
                <label>Passport Number</label>
                <input 
                  type="text" 
                  name="passportNumber"
                  value={formData.passportNumber}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Issue Date</label>
                <input 
                  type="date" 
                  name="passportIssueDate"
                  value={formData.passportIssueDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Expiry Date *</label>
                <input 
                  type="date" 
                  name="passportExpiryDate"
                  value={formData.passportExpiryDate}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <hr style={{ margin: '25px 0', border: 'none', borderTop: '2px solid #e0e0e0' }} />

              <h3 style={{ color: '#2c3e50', marginBottom: '20px' }}>🏢 Work Permit (إقامة العمل)</h3>

              <div className="employee-doc-manager-form-group">
                <label>Work Permit Number</label>
                <input 
                  type="text" 
                  name="iqamaNumber"
                  value={formData.iqamaNumber}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Issue Date</label>
                <input 
                  type="date" 
                  name="iqamaIssueDate"
                  value={formData.iqamaIssueDate}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Expiry Date *</label>
                <input 
                  type="date" 
                  name="iqamaExpiryDate"
                  value={formData.iqamaExpiryDate}
                  onChange={handleInputChange}
                  required 
                />
              </div>

              <hr style={{ margin: '25px 0', border: 'none', borderTop: '2px solid #e0e0e0' }} />

              <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>📎 Upload Documents</h3>
              <p style={{ color: '#7f8c8d', fontSize: '13px', marginBottom: '15px' }}>
                Upload scanned copies of passport, work permit, and other relevant documents
              </p>

              <div 
                className="employee-doc-manager-file-upload-area"
                onClick={() => document.getElementById('employeeDocFileInput').click()}
              >
                <input 
                  type="file" 
                  id="employeeDocFileInput"
                  multiple 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div>📁 Click to upload files</div>
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px' }}>
                  Supported: PDF, JPG, PNG (Max 10MB per file)
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="employee-doc-manager-uploaded-files">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="employee-doc-manager-uploaded-file-item">
                      <span>📄 {file.name}</span>
                      <span className="employee-doc-manager-remove-file" onClick={() => removeFile(index)}>✕</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="employee-doc-manager-modal-actions">
                <button 
                  type="button" 
                  className="employee-doc-manager-btn employee-doc-manager-btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={closeModal}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="employee-doc-manager-btn employee-doc-manager-btn-success" 
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDocManager;