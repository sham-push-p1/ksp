import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="analysis-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ color: "var(--text)", marginBottom: "8px" }}>Component Crashed</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px", maxWidth: "600px" }}>
            The application encountered an unexpected error while trying to render this section. 
            You can try refreshing the page or navigating to another tab.
          </p>
          <div style={{ background: "rgba(230, 57, 70, 0.1)", color: "#e63946", padding: "16px", borderRadius: "8px", textAlign: "left", width: "100%", maxWidth: "800px", overflowX: "auto" }}>
            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>{this.state.error && this.state.error.toString()}</div>
            <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap", fontFamily: "monospace", margin: 0 }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} 
            style={{ marginTop: "24px", background: "var(--navy)", color: "white", padding: "10px 24px", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: "600" }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
