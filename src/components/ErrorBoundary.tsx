import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Nunito', sans-serif",
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>😵</div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#2f2a22', marginBottom: '8px' }}>
            อุ๊ปส์! เกิดข้อผิดพลาด
          </h2>
          <p style={{ fontSize: '14px', color: '#8a7e6a', marginBottom: '16px', maxWidth: '340px' }}>
            มีบางอย่างผิดพลาด ลองรีเฟรชหน้านี้อีกครั้งนะ
          </p>
          {this.state.error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#b91c1c',
              marginBottom: '20px',
              maxWidth: '360px',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
            }}>
              {this.state.error.toString()}
            </div>
          )}
          <button
            onClick={() => { localStorage.removeItem('partyhub_session'); window.location.reload(); }}
            style={{
              padding: '14px 28px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(160deg, #6a9e5a 0%, #4d7a3f 100%)',
              color: 'white',
              fontWeight: 800,
              fontSize: '16px',
              fontFamily: "'Nunito', sans-serif",
              cursor: 'pointer',
              boxShadow: '0 4px 0 #3d6333, 0 6px 20px rgba(77,122,63,0.2)',
            }}
          >
            🔄 รีเฟรชหน้า
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
