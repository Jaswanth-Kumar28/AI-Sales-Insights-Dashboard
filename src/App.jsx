import { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';
import {
  Upload,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  BarChart3,
  Globe,
  Sparkles,
  Brain,
  MessageSquare,
  Send,
  Key,
  RefreshCw,
  FileText,
  Download,
  Copy,
  Check,
  Sun,
  Moon,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ChevronRight
} from 'lucide-react';
import './App.css';

import { generateSampleCSV } from './utils/sampleDataGenerator';
import { processSalesData } from './utils/dataProcessor';
import { generateSalesAuditReport, chatWithConsultant } from './utils/geminiService';

// Color palette for charts
const CHART_COLORS = [
  '#6366f1', // Indigo
  '#3b82f6', // Sapphire Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
];

// Helper to compile a clean visual presentation of markdown text
function renderMarkdownToHTML(markdownText) {
  if (!markdownText) return '';
  
  let html = markdownText
    // Escaping simple HTML to prevent security problems
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Handle table blocks
  const lines = html.split('\n');
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  let finalLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|')) {
      inTable = true;
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip alignment rows e.g. |---|---|
      if (line.includes('---')) {
        continue;
      }
      
      if (tableHeaders.length === 0) {
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
    } else {
      if (inTable) {
        // Output compiled table
        let tableHtml = '<table><thead><tr>';
        tableHeaders.forEach(h => { tableHtml += `<th>${h}</th>`; });
        tableHtml += '</tr></thead><tbody>';
        tableRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach(c => { tableHtml += `<td>${c}</td>`; });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        finalLines.push(tableHtml);
        
        // Reset states
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
      
      // Handle blockquotes
      if (line.startsWith('&gt;')) {
        const cleanQuote = line.replace(/^&gt;\s*/, '');
        finalLines.push(`<blockquote>${cleanQuote}</blockquote>`);
      }
      // Handle Headers
      else if (line.startsWith('###')) {
        finalLines.push(`<h3>${line.replace(/^###\s*/, '')}</h3>`);
      } else if (line.startsWith('##')) {
        finalLines.push(`<h2>${line.replace(/^##\s*/, '')}</h2>`);
      } else if (line.startsWith('#')) {
        finalLines.push(`<h1>${line.replace(/^#\s*/, '')}</h1>`);
      }
      // Handle lists
      else if (line.startsWith('-') || line.startsWith('*')) {
        finalLines.push(`<li>${line.replace(/^[-*]\s*/, '')}</li>`);
      } else if (/^\d+\./.test(line)) {
        finalLines.push(`<li>${line.replace(/^\d+\.\s*/, '')}</li>`);
      }
      // Regular paragraph
      else if (line.length > 0) {
        finalLines.push(`<p>${line}</p>`);
      } else {
        finalLines.push('<br/>');
      }
    }
  }

  // Final flush of table if it's at the end of text
  if (inTable) {
    let tableHtml = '<table><thead><tr>';
    tableHeaders.forEach(h => { tableHtml += `<th>${h}</th>`; });
    tableHtml += '</tr></thead><tbody>';
    tableRows.forEach(row => {
      tableHtml += '<tr>';
      row.forEach(c => { tableHtml += `<td>${c}</td>`; });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    finalLines.push(tableHtml);
  }

  // Post process list elements to group them under <ul>
  let groupedHtml = '';
  let inList = false;

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i];
    if (line.startsWith('<li>')) {
      if (!inList) {
        groupedHtml += '<ul>';
        inList = true;
      }
      groupedHtml += line;
    } else {
      if (inList) {
        groupedHtml += '</ul>';
        inList = false;
      }
      groupedHtml += line;
    }
  }
  if (inList) groupedHtml += '</ul>';

  return groupedHtml;
}

function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dashboard_theme') || 'dark';
  });

  // API Key State
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  const [showKey, setShowKey] = useState(false);

  // Sales Data State
  const [fileName, setFileName] = useState('');
  const [processedData, setProcessedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Tab State
  const [activeTab, setActiveTab] = useState('overview');

  // Executive AI Report States
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [reportCopied, setReportCopied] = useState(false);

  // AI CFO Consultant Chat States
  const [chatHistory, setChatHistory] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Synchronize visual application theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dashboard_theme', theme);
  }, [theme]);

  // Synchronize chat bottom anchor
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Save API key securely
  const handleSaveApiKey = (e) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
  };

  // CSV Parsing Engine
  const parseCSV = (csvSource, name = 'uploaded_data.csv') => {
    Papa.parse(csvSource, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const processed = processSalesData(results.data);
        if (processed) {
          setProcessedData(processed);
          setFileName(name);
          // Auto-scroll or focus to main dashboard
          setActiveTab('overview');
        } else {
          alert('Could not parse any valid sales rows from this CSV file. Please make sure it has standard sales headers (Date, Product, Quantity, Unit Price, Region).');
        }
      },
      error: (err) => {
        alert(`CSV parse error: ${err.message}`);
      }
    });
  };

  // Trigger file uploads manually
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        parseCSV(event.target.result, file.name);
      };
      reader.readAsText(file);
    }
  };

  // HTML5 Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        parseCSV(event.target.result, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Instantly load pre-built seasonal sample
  const handleLoadSample = () => {
    const csv = generateSampleCSV();
    parseCSV(csv, 'sample_sales_trends.csv');
  };

  // Clear data
  const handleClearData = () => {
    setProcessedData(null);
    setFileName('');
    setReportMarkdown('');
    setChatHistory([]);
  };

  // Generate Executive Audit Report using Gemini
  const handleGenerateReport = async () => {
    if (!apiKey) {
      alert('Please configure your Google Gemini API Key at the top of the page to generate AI audit reports.');
      return;
    }
    setReportLoading(true);
    setReportMarkdown('');
    try {
      const report = await generateSalesAuditReport(apiKey, processedData);
      setReportMarkdown(report);
      setActiveTab('report');
    } catch (err) {
      alert(`Report Generation Error: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (reportMarkdown) {
      navigator.clipboard.writeText(reportMarkdown);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    }
  };

  const handleDownloadReport = () => {
    if (reportMarkdown) {
      const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CFO_Sales_Audit_${fileName.split('.')[0]}.md`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Chat Consultant Engine
  const handleSendMessage = async (customText = '') => {
    const textToSend = customText || chatMessage;
    if (!textToSend.trim()) return;
    if (!apiKey) {
      alert('Please configure your Google Gemini API Key to chat with the Virtual CFO Consultant.');
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend
    };

    setChatHistory(prev => [...prev, userMessage]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await chatWithConsultant(apiKey, processedData, chatHistory, textToSend);
      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'model',
        text: response
      }]);
    } catch (err) {
      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'model',
        text: `⚠️ **Consultation Error**: ${err.message}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Ambient rule alert icons
  const getAlertIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} className="text-success" />;
      case 'warning': return <AlertTriangle size={16} className="text-warning" />;
      case 'danger': return <XCircle size={16} className="text-danger" />;
      default: return <Info size={16} className="text-info" />;
    }
  };

  // Memoized top categories and product rank tables to ensure smooth renders
  const renderedProductRows = useMemo(() => {
    if (!processedData) return [];
    const maxRev = processedData.rankedProducts[0]?.revenue || 1;
    return processedData.rankedProducts.slice(0, 5).map((p, idx) => {
      const percentage = Math.min(100, Math.round((p.revenue / maxRev) * 100));
      return (
        <tr key={p.product}>
          <td>#{idx + 1} {p.product}</td>
          <td>{p.category}</td>
          <td>{p.quantity} units</td>
          <td>
            <strong>${p.revenue.toLocaleString()}</strong>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${percentage}%` }} />
            </div>
          </td>
        </tr>
      );
    });
  }, [processedData]);

  return (
    <div className="app-container">
      
      {/* 1. Header & Secure Controls */}
      <header className="dashboard-header glass">
        <div className="brand-section">
          <div className="brand-logo">
            <TrendingUp size={24} />
          </div>
          <div className="brand-title">
            <h1>NIAT Sales Insight Engine</h1>
            <p>Smart CSV Analytics &amp; Virtual CFO Consulting</p>
          </div>
        </div>

        <div className="header-controls">
          <div className="api-key-container">
            <Key size={16} className="text-muted" />
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="Paste Gemini API Key..."
              value={apiKey}
              onChange={handleSaveApiKey}
              className="api-key-input"
            />
            {apiKey && (
              <button onClick={handleClearApiKey} className="icon-btn" title="Clear key">
                <XCircle size={14} />
              </button>
            )}
            <button onClick={() => setShowKey(!showKey)} className="icon-btn" title={showKey ? "Hide key" : "Show key"}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="theme-toggle"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* 2. Upload Panel */}
      {!processedData ? (
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <div className="upload-icon-wrapper">
            <Upload size={32} />
          </div>
          <div className="upload-text">
            <h3>Upload your sales sheet (.csv)</h3>
            <p>Drag and drop your transaction records, or browse local files.</p>
          </div>
          <div className="upload-actions" onClick={e => e.stopPropagation()}>
            <button onClick={handleLoadSample} className="glow-btn">
              <Sparkles size={16} /> Load Demo Sales Data
            </button>
          </div>
        </div>
      ) : (
        /* Upload Status Indicator when loaded */
        <div className="upload-zone" style={{ padding: '16px 24px', flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div className="upload-icon-wrapper" style={{ width: '40px', height: '40px' }}>
              <FileText size={20} className="text-primary" />
            </div>
            <div>
              <h4 style={{ fontSize: '15px' }}>{fileName}</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Successfully processed {processedData.metrics.transactionsCount} transaction records.
              </p>
            </div>
          </div>
          <div className="upload-actions">
            <button onClick={handleGenerateReport} disabled={reportLoading} className="glow-btn">
              {reportLoading ? <div className="spinner" /> : <Brain size={16} />}
              Generate CFO Report
            </button>
            <button onClick={handleClearData} className="secondary-btn">
              <RefreshCw size={16} /> Reset Dashboard
            </button>
          </div>
        </div>
      )}

      {/* 3. Dashboard Body (Only displays when data loaded) */}
      {processedData && (
        <div className="dashboard-body">
          <main className="main-content">
            
            {/* KPI Cards Grid */}
            <section className="kpi-grid">
              <div className="kpi-card glass">
                <div className="kpi-icon-container">
                  <DollarSign size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Revenue</span>
                  <span className="kpi-value">${processedData.metrics.totalRevenue.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card glass">
                <div className="kpi-icon-container">
                  <ShoppingBag size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Units Sold</span>
                  <span className="kpi-value">{processedData.metrics.totalUnits.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card glass">
                <div className="kpi-icon-container">
                  <BarChart3 size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Transactions</span>
                  <span className="kpi-value">{processedData.metrics.transactionsCount.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card glass">
                <div className="kpi-icon-container">
                  <Globe size={24} />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">AOV (Ticket)</span>
                  <span className="kpi-value">${processedData.metrics.averageOrderValue.toLocaleString()}</span>
                </div>
              </div>
            </section>

            {/* Ambient Rules Insights */}
            <section className="insights-panel glass">
              <div className="insights-header">
                <Brain size={20} className="text-primary" />
                <h3>Rule-Based Diagnostic Insights</h3>
              </div>
              <div className="insights-grid">
                {processedData.ambientInsights.map((insight, idx) => (
                  <div key={idx} className={`insight-card ${insight.type}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getAlertIcon(insight.type)}
                      <span className="insight-title">{insight.title}</span>
                    </div>
                    <p className="insight-message">{insight.message}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Tab navigation */}
            <nav className="tabs-navigation">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview Trends
              </button>
              <button
                className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
                onClick={() => setActiveTab('breakdown')}
              >
                Segment analysis
              </button>
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                Executive CFO Audit
              </button>
            </nav>

            {/* Render dynamic tabs */}
            {activeTab === 'overview' && (
              <section className="charts-grid">
                {/* 1. Area Chart Trend */}
                <div className="chart-card glass">
                  <div className="chart-header">
                    <h3 className="chart-title">Revenue &amp; Orders Trend</h3>
                    <p className="chart-subtitle">Monthly transaction performance history</p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '8px',
                            color: 'var(--text-heading)'
                          }}
                        />
                        <Area type="monotone" dataKey="Revenue" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Pie Chart distribution */}
                <div className="chart-card glass">
                  <div className="chart-header">
                    <h3 className="chart-title">Category Revenue Contribution</h3>
                    <p className="chart-subtitle">Sales share across product departments</p>
                  </div>
                  <div className="chart-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '220px', height: '220px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={processedData.categoryPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {processedData.categoryPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => `$${value.toLocaleString()}`}
                            contentStyle={{
                              background: 'var(--surface)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '8px',
                              color: 'var(--text-heading)'
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Render customized legend sidebar to look extremely clean */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '16px', fontSize: '13px' }}>
                      {processedData.categoryPieData.map((item, index) => (
                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <span style={{ color: 'var(--text-heading)', fontWeight: '500' }}>{item.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({((item.value / processedData.metrics.totalRevenue) * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'breakdown' && (
              <section className="charts-grid">
                {/* 1. Region Bar charts */}
                <div className="chart-card glass">
                  <div className="chart-header">
                    <h3 className="chart-title">Regional Performance</h3>
                    <p className="chart-subtitle">Revenue and Average Ticket sizes by territory</p>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.regionalMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                        <XAxis dataKey="region" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '8px',
                            color: 'var(--text-heading)'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="Revenue" name="Revenue ($)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="AOV" name="Avg Ticket ($)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Top Products Leaderboard */}
                <div className="chart-card glass" style={{ minHeight: '380px' }}>
                  <div className="chart-header">
                    <h3 className="chart-title">Product Performance Leaderboard</h3>
                    <p className="chart-subtitle">Top revenue generators in our catalog</p>
                  </div>
                  <div className="product-table-wrapper">
                    <table className="product-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Volume</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {renderedProductRows}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'report' && (
              <section className="report-section glass">
                {!reportMarkdown ? (
                  <div className="report-empty-state">
                    <Brain size={48} className="text-primary" style={{ opacity: 0.6 }} />
                    <div>
                      <h3>Generate Executive Sales Audit</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '400px', margin: '6px auto 0' }}>
                        Generate a professional consulting report featuring core drivers, vulnerabilities, and an actionable 3-month turnaround roadmap.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateReport}
                      disabled={reportLoading || !apiKey}
                      className="glow-btn"
                    >
                      {reportLoading ? (
                        <>
                          <div className="spinner" /> Generating with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> Write Report with Gemini
                        </>
                      )}
                    </button>
                    {!apiKey && (
                      <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
                        ⚠️ Gemini API Key is required (configure in header)
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="report-header">
                      <div>
                        <h3>AI Sales Audit &amp; Performance Review</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Powered by Google Gemini AI CFO</p>
                      </div>
                      <div className="report-actions">
                        <button onClick={handleCopyReport} className="secondary-btn" style={{ padding: '8px 12px', fontSize: '13px' }}>
                          {reportCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          {reportCopied ? 'Copied' : 'Copy'}
                        </button>
                        <button onClick={handleDownloadReport} className="secondary-btn" style={{ padding: '8px 12px', fontSize: '13px' }}>
                          <Download size={14} /> Download
                        </button>
                      </div>
                    </div>
                    {/* Render simulated executive text beautifully */}
                    <div
                      className="report-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(reportMarkdown) }}
                    />
                  </>
                )}
              </section>
            )}
          </main>

          {/* 4. Interactive Virtual CFO Chat Consultant */}
          <aside className="chat-drawer glass">
            <div className="chat-header-pane">
              <div className="cfo-avatar">
                <Brain size={20} />
              </div>
              <div className="cfo-title">
                <h3>Virtual CFO Consultant</h3>
                <p>Interactive Analyst</p>
              </div>
            </div>

            <div className="chat-messages">
              {chatHistory.length === 0 ? (
                <div className="chat-empty-state">
                  <MessageSquare size={36} style={{ opacity: 0.3 }} />
                  <p style={{ fontSize: '13px', padding: '0 20px', lineHeight: '145%' }}>
                    Ask specific questions about regional turnarounds, declining product lines, or general business advice!
                  </p>
                  
                  <div className="preset-queries">
                    <button
                      className="preset-query-btn"
                      onClick={() => handleSendMessage("How can we turnaround the South region performance?")}
                    >
                      <span>South region turnaround plan</span>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      className="preset-query-btn"
                      onClick={() => handleSendMessage("Analyze the decline in Wireless Earbuds.")}
                    >
                      <span>Wireless Earbuds deep-dive</span>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      className="preset-query-btn"
                      onClick={() => handleSendMessage("What should be our pricing adjustments for underperforming items?")}
                    >
                      <span>Pricing & inventory remediation</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble ${msg.sender}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.text) }}
                  />
                ))
              )}

              {chatLoading && (
                <div className="message-bubble model" style={{ minWidth: '80px' }}>
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="chat-input-pane">
              <input
                type="text"
                placeholder="Ask your AI Analyst..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="chat-text-input"
                disabled={chatLoading}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={chatLoading || !chatMessage.trim()}
                className="glow-btn"
                style={{ padding: '10px' }}
              >
                <Send size={16} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;
