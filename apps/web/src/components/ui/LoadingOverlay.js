export default function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 9999,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        padding: '20px', background: 'white', borderRadius: '8px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '15px'
      }}>
        <div className="spinner" style={{
          width: '24px', height: '24px', border: '3px solid var(--border-color)', 
          borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontWeight: 500, color: 'var(--primary)' }}>Processing...</span>
      </div>
      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
