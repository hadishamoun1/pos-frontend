import React, { useState, useEffect } from 'react';
import './EmployeeDocManager.css';

const EmployeeDocManager = () => {
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: "Ahmed Mohamed",
      nationality: "Egyptian",
      position: "Accountant",
      phone: "+961 71 123 456",
      passport: {
        number: "A12345678",
        issueDate: "2020-03-15",
        expiryDate: "2025-03-15"
      },
      iqama: {
        number: "IQ987654",
        issueDate: "2023-06-01",
        expiryDate: "2025-05-31"
      },
      files: [
        { name: "passport_scan.pdf", type: "Passport" },
        { name: "iqama_copy.pdf", type: "Work Permit" }
      ]
    },
    {
      id: 2,
      name: "Fatima Hassan",
      nationality: "Sudanese",
      position: "Sales Manager",
      phone: "+961 76 234 567",
      passport: {
        number: "S98765432",
        issueDate: "2019-08-20",
        expiryDate: "2024-08-20"
      },
      iqama: {
        number: "IQ456789",
        issueDate: "2023-01-15",
        expiryDate: "2024-12-31"
      },
      files: [
        { name: "fatima_passport.pdf", type: "Passport" },
        { name: "work_permit.pdf", type: "Work Permit" }
      ]
    },
    {
      id: 3,
      name: "Kwame Osei",
      nationality: "Ghanaian",
      position: "IT Specialist",
      phone: "+961 78 345 678",
      passport: {
        number: "G55667788",
        issueDate: "2021-02-10",
        expiryDate: "2026-02-10"
      },
      iqama: {
        number: "IQ123456",
        issueDate: "2023-09-01",
        expiryDate: "2025-08-31"
      },
      files: [
        { name: "kwame_documents.pdf", type: "All Documents" }
      ]
    }
  ]);

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
    passportIssue: '',
    passportExpiry: '',
    iqamaNumber: '',
    iqamaIssue: '',
    iqamaExpiry: ''
  });

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

  const getAlerts = () => {
    const alerts = [];
    employees.forEach(emp => {
      const passportDays = calculateDaysUntilExpiry(emp.passport.expiryDate);
      const iqamaDays = calculateDaysUntilExpiry(emp.iqama.expiryDate);

      if (passportDays <= 90) {
        alerts.push({
          employee: emp.name,
          document: 'Passport',
          days: passportDays,
          urgent: passportDays <= 30
        });
      }

      if (iqamaDays <= 90) {
        alerts.push({
          employee: emp.name,
          document: 'Work Permit (إقامة)',
          days: iqamaDays,
          urgent: iqamaDays <= 30
        });
      }
    });
    return alerts;
  };

  const getFilteredEmployees = () => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.nationality.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (currentFilter === 'all') return true;

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
  };

  const openAddEmployeeModal = () => {
    setEditingEmployeeId(null);
    setFormData({
      name: '',
      nationality: '',
      position: '',
      phone: '',
      passportNumber: '',
      passportIssue: '',
      passportExpiry: '',
      iqamaNumber: '',
      iqamaIssue: '',
      iqamaExpiry: ''
    });
    setUploadedFiles([]);
    setShowModal(true);
  };

  const openEditEmployeeModal = (id) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    setEditingEmployeeId(id);
    setFormData({
      name: emp.name,
      nationality: emp.nationality,
      position: emp.position || '',
      phone: emp.phone || '',
      passportNumber: emp.passport.number,
      passportIssue: emp.passport.issueDate,
      passportExpiry: emp.passport.expiryDate,
      iqamaNumber: emp.iqama.number,
      iqamaIssue: emp.iqama.issueDate,
      iqamaExpiry: emp.iqama.expiryDate
    });
    setUploadedFiles([...emp.files]);
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(file => ({
      name: file.name,
      type: 'Document'
    }));
    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (index) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const employeeData = {
      id: editingEmployeeId || Date.now(),
      name: formData.name,
      nationality: formData.nationality,
      position: formData.position,
      phone: formData.phone,
      passport: {
        number: formData.passportNumber,
        issueDate: formData.passportIssue,
        expiryDate: formData.passportExpiry
      },
      iqama: {
        number: formData.iqamaNumber,
        issueDate: formData.iqamaIssue,
        expiryDate: formData.iqamaExpiry
      },
      files: uploadedFiles
    };

    if (editingEmployeeId) {
      setEmployees(employees.map(e => 
        e.id === editingEmployeeId ? employeeData : e
      ));
    } else {
      setEmployees([...employees, employeeData]);
    }

    closeModal();
  };

  const deleteEmployee = (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };

  const alerts = getAlerts();
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
        <button className="employee-doc-manager-btn employee-doc-manager-btn-primary" onClick={openAddEmployeeModal}>
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
                      <span className="employee-doc-manager-document-value">{emp.passport.number}</span>
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
                      <span className="employee-doc-manager-document-value">{emp.iqama.number}</span>
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

                <div className="employee-doc-manager-files-section">
                  <h5>📎 Uploaded Files</h5>
                  <div className="employee-doc-manager-file-list">
                    {emp.files.map((file, index) => (
                      <div key={index} className="employee-doc-manager-file-item">
                        <span className="employee-doc-manager-file-name">📄 {file.name}</span>
                        <span style={{ fontSize: '11px', color: '#7f8c8d' }}>{file.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="employee-doc-manager-action-buttons">
                  <button className="employee-doc-manager-btn employee-doc-manager-btn-primary employee-doc-manager-btn-small" onClick={() => openEditEmployeeModal(emp.id)}>
                    ✏️ Edit
                  </button>
                  <button className="employee-doc-manager-btn employee-doc-manager-btn-secondary employee-doc-manager-btn-small" onClick={() => deleteEmployee(emp.id)}>
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
                  name="passportIssue"
                  value={formData.passportIssue}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Expiry Date *</label>
                <input 
                  type="date" 
                  name="passportExpiry"
                  value={formData.passportExpiry}
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
                  name="iqamaIssue"
                  value={formData.iqamaIssue}
                  onChange={handleInputChange}
                />
              </div>

              <div className="employee-doc-manager-form-group">
                <label>Expiry Date *</label>
                <input 
                  type="date" 
                  name="iqamaExpiry"
                  value={formData.iqamaExpiry}
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
                  Supported: PDF, JPG, PNG
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
                <button type="button" className="employee-doc-manager-btn employee-doc-manager-btn-secondary" style={{ flex: 1 }} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="employee-doc-manager-btn employee-doc-manager-btn-success" style={{ flex: 1 }}>
                  Save Employee
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