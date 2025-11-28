import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiUpload, FiImage, FiSave } from 'react-icons/fi';
import './Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      setSettings(response.data);
      setCompanyName(response.data.companyName || 'GIC Projects');
      if (response.data.companyLogo && response.data.companyLogo.path) {
        setLogoPreview(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${response.data.companyLogo.path}`);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      alert('Please select a logo file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await axios.post('/api/settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.logo) {
        setLogoPreview(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${response.data.logo.path}`);
        setLogoFile(null);
        alert('Company logo uploaded successfully!');
      }
    } catch (error) {
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Error uploading logo');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCompanyName = async () => {
    setSaving(true);
    try {
      await axios.put('/api/settings', { companyName });
      alert('Company name updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating company name');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="settings-page">
        <div className="error-message">Access denied. Only administrators can access settings.</div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2>Company Information</h2>
          <div className="form-group">
            <label>Company Name</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSaveCompanyName}
                disabled={saving}
                className="save-btn"
              >
                <FiSave /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Company Logo</h2>
          <p className="section-description">
            Upload your company logo to display it on the login page, sidebar, and other relevant pages.
          </p>
          
          <div className="logo-upload-area">
            {logoPreview ? (
              <div className="logo-preview-container">
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="logo-preview"
                />
                <div className="logo-preview-info">
                  <p>Current logo</p>
                  <p className="logo-hint">Upload a new image to replace</p>
                </div>
              </div>
            ) : (
              <div className="logo-placeholder">
                <FiImage size={48} />
                <p>No logo uploaded</p>
              </div>
            )}

            <div className="logo-upload-controls">
              <label className="file-upload-label">
                <FiUpload />
                {logoFile ? 'Change Logo' : 'Select Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ display: 'none' }}
                />
              </label>
              
              {logoFile && (
                <button
                  onClick={handleLogoUpload}
                  disabled={uploading}
                  className="upload-btn"
                >
                  {uploading ? 'Uploading...' : 'Upload Logo'}
                </button>
              )}
            </div>

            <div className="logo-requirements">
              <p><strong>Requirements:</strong></p>
              <ul>
                <li>Recommended: Square image (1:1 ratio)</li>
                <li>Maximum file size: 5MB</li>
                <li>Supported formats: PNG, JPG, GIF, SVG, WEBP</li>
                <li>Recommended dimensions: 200x200px to 500x500px</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

