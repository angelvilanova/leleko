import { useState } from 'react';

export function UsageLimitPage({ onBypass }: { onBypass: () => void }) {
  const [clicks, setClicks] = useState(0);

  const handleLogoClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 5) {
      onBypass();
    }
  };

  return (
    <div style={{ margin: 0, padding: 0, background: '#000', color: '#ededed', minHeight: '100vh', fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        .ul-header { border-bottom: 1px solid #1f1f1f; background: #000; position: sticky; top: 0; z-index: 50; }
        .ul-header-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; max-width: 1400px; margin: 0 auto; }
        .ul-header-left { display: flex; align-items: center; gap: 12px; }
        .ul-logo { display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .ul-logo svg { width: 22px; height: 22px; }
        .ul-breadcrumb-sep { color: #2e2e2e; font-size: 18px; margin: 0 2px; }
        .ul-team-pill { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; transition: background 0.15s; cursor: pointer; }
        .ul-team-pill:hover { background: #0a0a0a; }
        .ul-team-avatar { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #f5a623, #ee6464); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #000; }
        .ul-team-name { font-size: 14px; font-weight: 500; }
        .ul-plan-badge { font-size: 10px; padding: 2px 6px; background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 4px; color: #a1a1a1; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }
        .ul-header-right { display: flex; align-items: center; gap: 16px; }
        .ul-header-link { font-size: 14px; color: #a1a1a1; text-decoration: none; transition: color 0.15s; }
        .ul-header-link:hover { color: #ededed; }
        .ul-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; cursor: pointer; }
        .ul-header-tabs { display: flex; gap: 4px; padding: 0 24px; max-width: 1400px; margin: 0 auto; overflow-x: auto; }
        .ul-tab { padding: 10px 12px; font-size: 14px; color: #a1a1a1; border-bottom: 2px solid transparent; cursor: pointer; transition: color 0.15s; white-space: nowrap; text-decoration: none; }
        .ul-tab:hover { color: #ededed; }
        .ul-tab.active { color: #ededed; border-bottom-color: #ededed; }
        .ul-main { max-width: 1400px; margin: 0 auto; padding: 32px 24px 64px; }
        .ul-page-title { font-size: 32px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
        .ul-page-subtitle { color: #a1a1a1; font-size: 14px; margin-bottom: 32px; }
        .ul-warning-banner { background: #2a0a0a; border: 1px solid #5a1d1d; border-radius: 8px; padding: 20px 24px; margin-bottom: 32px; display: flex; gap: 16px; align-items: flex-start; animation: ulFadeIn 0.5s ease-out; }
        .ul-warning-icon-box { flex-shrink: 0; width: 32px; height: 32px; border-radius: 6px; background: rgba(238,100,100,0.15); display: flex; align-items: center; justify-content: center; }
        .ul-warning-icon-box svg { width: 18px; height: 18px; color: #ee6464; }
        .ul-warning-title { font-size: 16px; font-weight: 600; color: #ededed; margin-bottom: 4px; }
        .ul-warning-text { font-size: 14px; color: #a1a1a1; line-height: 1.5; margin-bottom: 16px; }
        .ul-warning-text strong { color: #ededed; font-weight: 500; }
        .ul-warning-actions { display: flex; gap: 8px; align-items: center; }
        .ul-btn { font-family: inherit; font-size: 14px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
        .ul-btn-primary { background: #fff; color: #000; border-color: #fff; }
        .ul-btn-primary:hover { background: #e5e5e5; }
        .ul-btn-ghost { background: transparent; color: #a1a1a1; border-color: transparent; }
        .ul-btn-ghost:hover { color: #ededed; }
        .ul-btn-secondary { background: transparent; color: #ededed; border-color: #2e2e2e; }
        .ul-btn-secondary:hover { background: #0a0a0a; }
        .ul-usage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .ul-usage-card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 8px; padding: 20px; transition: border-color 0.15s; }
        .ul-usage-card:hover { border-color: #2e2e2e; }
        .ul-usage-card.over-limit { border-color: #5a1d1d; }
        .ul-usage-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .ul-usage-card-title { font-size: 13px; color: #a1a1a1; font-weight: 500; margin-bottom: 4px; }
        .ul-usage-card-value { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
        .ul-usage-card-value.over { color: #ee6464; }
        .ul-usage-card-limit { font-size: 13px; color: #707070; font-weight: 400; }
        .ul-usage-icon { width: 16px; height: 16px; color: #707070; }
        .ul-progress-bar { width: 100%; height: 6px; background: #1f1f1f; border-radius: 3px; overflow: hidden; margin-top: 12px; }
        .ul-progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease-out; }
        .ul-progress-fill.over { background: #ee6464; }
        .ul-progress-fill.warn { background: #f5a623; }
        .ul-usage-percent { margin-top: 8px; font-size: 12px; color: #707070; display: flex; justify-content: space-between; }
        .ul-usage-percent .pct.over { color: #ee6464; font-weight: 500; }
        .ul-upgrade-card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 32px; margin-bottom: 24px; position: relative; overflow: hidden; animation: ulFadeIn 0.5s ease-out; }
        .ul-upgrade-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #ededed, transparent); opacity: 0.3; }
        .ul-upgrade-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 48px; align-items: center; }
        .ul-upgrade-left h2 { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 12px; }
        .ul-upgrade-left p { font-size: 14px; color: #a1a1a1; line-height: 1.6; margin-bottom: 24px; }
        .ul-features-list { list-style: none; padding: 0; margin: 0; }
        .ul-features-list li { font-size: 14px; color: #a1a1a1; margin-bottom: 10px; display: flex; align-items: flex-start; gap: 10px; line-height: 1.5; }
        .ul-check-icon { width: 16px; height: 16px; flex-shrink: 0; color: #00ac4a; margin-top: 2px; }
        .ul-upgrade-right { background: #000; border: 1px solid #1f1f1f; border-radius: 10px; padding: 28px; }
        .ul-plan-name { font-size: 12px; color: #a1a1a1; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-bottom: 8px; }
        .ul-price-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
        .ul-price { font-size: 44px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }
        .ul-price-period { font-size: 14px; color: #a1a1a1; }
        .ul-price-note { font-size: 13px; color: #707070; margin-bottom: 24px; }
        .ul-billing-info { padding: 12px 0; border-top: 1px solid #1f1f1f; border-bottom: 1px solid #1f1f1f; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px; }
        .ul-billing-info-label { color: #a1a1a1; }
        .ul-billing-info-value { color: #ededed; font-weight: 500; font-family: 'Geist Mono', monospace; }
        .ul-btn-upgrade { width: 100%; justify-content: center; padding: 11px 16px; font-size: 14px; font-weight: 500; }
        .ul-btn-secondary-full { width: 100%; justify-content: center; padding: 9px 16px; margin-top: 8px; font-size: 13px; }
        .ul-footer-note { text-align: center; color: #707070; font-size: 12px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #1f1f1f; }
        .ul-footer-note a { color: #a1a1a1; text-decoration: none; }
        .ul-footer-note a:hover { color: #ededed; text-decoration: underline; }
        @media (max-width: 768px) {
          .ul-upgrade-grid { grid-template-columns: 1fr; gap: 24px; }
          .ul-page-title { font-size: 24px; }
          .ul-header-right .ul-header-link { display: none; }
          .ul-upgrade-card { padding: 24px 20px; }
        }
        @keyframes ulFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header className="ul-header">
        <div className="ul-header-top">
          <div className="ul-header-left">
            <div className="ul-logo" onClick={handleLogoClick}>
              <svg viewBox="0 0 76 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/>
              </svg>
            </div>
            <span className="ul-breadcrumb-sep">/</span>
            <div className="ul-team-pill">
              <div className="ul-team-avatar">A</div>
              <span className="ul-team-name">angelvilanova</span>
              <span className="ul-plan-badge">Hobby</span>
            </div>
          </div>
          <div className="ul-header-right">
            <a href="#" className="ul-header-link">Feedback</a>
            <a href="#" className="ul-header-link">Changelog</a>
            <a href="#" className="ul-header-link">Help</a>
            <a href="#" className="ul-header-link">Docs</a>
            <div className="ul-avatar">A</div>
          </div>
        </div>
        <nav className="ul-header-tabs">
          <a href="#" className="ul-tab">Overview</a>
          <a href="#" className="ul-tab">Integrations</a>
          <a href="#" className="ul-tab">Activity</a>
          <a href="#" className="ul-tab">Domains</a>
          <a href="#" className="ul-tab active">Usage</a>
          <a href="#" className="ul-tab">Monitoring</a>
          <a href="#" className="ul-tab">Storage</a>
          <a href="#" className="ul-tab">AI</a>
          <a href="#" className="ul-tab">Support</a>
          <a href="#" className="ul-tab">Settings</a>
        </nav>
      </header>

      <main className="ul-main">
        <h1 className="ul-page-title">Usage</h1>
        <p className="ul-page-subtitle">Current period: Apr 1, 2026 — Apr 30, 2026 · Resets in 0 days</p>

        <div className="ul-warning-banner">
          <div className="ul-warning-icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="ul-warning-title">Usage limits exceeded on the Hobby plan</div>
            <p className="ul-warning-text">
              Your team <strong>angelvilanova</strong> has surpassed one or more limits of the Hobby (Free) plan, which is intended for non-commercial, personal use only. To restore full functionality of your projects and avoid service interruption, an upgrade to the <strong>Pro plan</strong> is required.
            </p>
            <div className="ul-warning-actions">
              <a href="#" className="ul-btn ul-btn-primary" onClick={(e) => e.preventDefault()}>
                Upgrade to Pro
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
              <a href="#" className="ul-btn ul-btn-ghost" onClick={(e) => e.preventDefault()}>Learn more</a>
            </div>
          </div>
        </div>

        <div className="ul-usage-grid">
          <div className="ul-usage-card over-limit">
            <div className="ul-usage-card-header">
              <div>
                <div className="ul-usage-card-title">Bandwidth</div>
                <div className="ul-usage-card-value over">147.2 GB <span className="ul-usage-card-limit">/ 100 GB</span></div>
              </div>
              <svg className="ul-usage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
            <div className="ul-progress-bar"><div className="ul-progress-fill over" style={{ width: '100%' }}></div></div>
            <div className="ul-usage-percent"><span className="pct over">147% of limit</span><span>Resets in 0 days</span></div>
          </div>

          <div className="ul-usage-card over-limit">
            <div className="ul-usage-card-header">
              <div>
                <div className="ul-usage-card-title">Function Invocations</div>
                <div className="ul-usage-card-value over">1.84M <span className="ul-usage-card-limit">/ 1M</span></div>
              </div>
              <svg className="ul-usage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </div>
            <div className="ul-progress-bar"><div className="ul-progress-fill over" style={{ width: '100%' }}></div></div>
            <div className="ul-usage-percent"><span className="pct over">184% of limit</span><span>Resets in 0 days</span></div>
          </div>

          <div className="ul-usage-card over-limit">
            <div className="ul-usage-card-header">
              <div>
                <div className="ul-usage-card-title">Build Execution</div>
                <div className="ul-usage-card-value over">432 hrs <span className="ul-usage-card-limit">/ 100 hrs</span></div>
              </div>
              <svg className="ul-usage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="ul-progress-bar"><div className="ul-progress-fill over" style={{ width: '100%' }}></div></div>
            <div className="ul-usage-percent"><span className="pct over">432% of limit</span><span>Resets in 0 days</span></div>
          </div>

          <div className="ul-usage-card">
            <div className="ul-usage-card-header">
              <div>
                <div className="ul-usage-card-title">Edge Requests</div>
                <div className="ul-usage-card-value">782K <span className="ul-usage-card-limit">/ 1M</span></div>
              </div>
              <svg className="ul-usage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div className="ul-progress-bar"><div className="ul-progress-fill warn" style={{ width: '78%' }}></div></div>
            <div className="ul-usage-percent"><span className="pct">78% of limit</span><span>Resets in 0 days</span></div>
          </div>
        </div>

        <div className="ul-upgrade-card">
          <div className="ul-upgrade-grid">
            <div className="ul-upgrade-left">
              <h2>Continue building without limits.</h2>
              <p>Your projects have grown beyond the Hobby plan. Upgrade to the Pro plan to restore deployment access, scale your usage, and unlock advanced features for production workloads.</p>
              <ul className="ul-features-list">
                <li>
                  <svg className="ul-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span><strong style={{ color: '#ededed', fontWeight: 500 }}>1 TB</strong> of bandwidth included</span>
                </li>
                <li>
                  <svg className="ul-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span><strong style={{ color: '#ededed', fontWeight: 500 }}>Unlimited</strong> commercial deployments</span>
                </li>
                <li>
                  <svg className="ul-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Advanced analytics and observability</span>
                </li>
                <li>
                  <svg className="ul-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Password protection and preview deployments</span>
                </li>
                <li>
                  <svg className="ul-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Email support with 24-hour response time</span>
                </li>
              </ul>
            </div>
            <div className="ul-upgrade-right">
              <div className="ul-plan-name">Pro plan</div>
              <div className="ul-price-row">
                <span className="ul-price">$449</span>
                <span className="ul-price-period">/ year</span>
              </div>
              <div className="ul-price-note">Billed annually · ~$37.42 per month</div>
              <div className="ul-billing-info">
                <span className="ul-billing-info-label">Total due today</span>
                <span className="ul-billing-info-value">USD $449.00</span>
              </div>
              <a href="#" className="ul-btn ul-btn-primary ul-btn-upgrade" onClick={(e) => e.preventDefault()}>Upgrade now</a>
              <a href="#" className="ul-btn ul-btn-secondary ul-btn-secondary-full" onClick={(e) => e.preventDefault()}>Contact sales</a>
            </div>
          </div>
        </div>

        <p className="ul-footer-note">
          By upgrading, you agree to Vercel's <a href="#">Terms of Service</a> and <a href="#">Fair Use Policy</a>. <br/>
          Need help choosing a plan? <a href="#">Compare plans</a> or <a href="#">contact our team</a>.
        </p>
      </main>
    </div>
  );
}
