import { useState, useRef } from 'react'
import './App.css'

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export default function App() {
  const [files, setFiles] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = (incoming) => {
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !names.has(f.name))]
    })
    setResults(null)
    setError(null)
  }

  const removeFile = (name) => {
    setFiles(prev => prev.filter(f => f.name !== name))
    setResults(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!files.length) return
    setLoading(true)
    setError(null)
    setResults(null)

    const formData = new FormData()
    files.forEach(f => formData.append('syllabi', f))

    try {
      const res = await fetch('/api/document/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const days = results ? daysUntil(results.latest) : null

  return (
    <div className="app">
      <div className="bg-grid" />

      <header className="header">
        <div className="logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Syllago</span>
        </div>
        <p className="tagline">Drop your syllabi. Find out when you're free.</p>
      </header>

      <main className="main">
        <section className="upload-section">
          <div
            className={`dropzone ${dragging ? 'dragging' : ''} ${files.length ? 'has-files' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
            {files.length === 0 ? (
              <div className="dropzone-empty">
                <div className="drop-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="drop-primary">Drop your syllabi here</p>
                <p className="drop-secondary">or click to browse — PDF files only</p>
              </div>
            ) : (
              <div className="file-list" onClick={e => e.stopPropagation()}>
                {files.map(f => (
                  <div key={f.name} className="file-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="file-icon">
                      <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="file-name">{f.name}</span>
                    <button className="file-remove" onClick={() => removeFile(f.name)}>×</button>
                  </div>
                ))}
                <button className="add-more" onClick={() => inputRef.current.click()}>
                  + Add more
                </button>
              </div>
            )}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            className={`submit-btn ${loading ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={!files.length || loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              'Find My Last Exam'
            )}
          </button>
        </section>

        {results && (
          <section className="results-section">
            <div className="latest-card">
              <p className="latest-label">Your last exam is</p>
              <h2 className="latest-date">{formatDate(results.latest)}</h2>
              {(() => {
                const match = results.syllabi
                  .flatMap(s => s.examDates)
                  .find(e => e.date.slice(0, 10) === results.latest.slice(0, 10));
                return match?.time ? <p className="latest-time">{match.time}</p> : null
              })()}
              <div className="days-badge">
                {days === 0
                  ? 'Today'
                  : days < 0
                    ? `${Math.abs(days)} days ago`
                    : `${days} days from now`}
              </div>
            </div>

            <div className="syllabi-list">
              {results.syllabi.map(syllabus => (
                <div key={syllabus.file} className="syllabus-card">
                  <h3 className="syllabus-name">{syllabus.file.replace(/\.pdf$/i, '')}</h3>
                  <div className="exam-rows">
                    {syllabus.examDates.length === 0 ? (
                      <p className="no-exams">No exam dates found</p>
                    ) : (
                      syllabus.examDates.map((exam, idx) => (
                        <div key={idx} className="exam-row">
                          <span className="exam-name">{exam.name}</span>
                          <span className="exam-date">{formatDate(exam.date)}{exam.time ? `, ${exam.time}` : ''}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
