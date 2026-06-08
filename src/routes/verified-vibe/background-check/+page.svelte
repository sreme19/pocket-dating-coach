<script lang="ts">
  import { goto } from '$app/navigation';
</script>

<div class="bgcheck-page">
  <!-- Header -->
  <div class="bgcheck-header">
    <button class="back-btn" onclick={() => goto('/verified-vibe/profile?tab=boost')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <span class="header-label">Background Verification</span>
    <div style="width:32px"></div>
  </div>

  <!-- Coming soon body -->
  <div class="bgcheck-body">
    <div class="shield-icon">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M9 12l2 2 4-4"/>
        <path d="M12 2L3 7v5c0 5.25 3.75 10.2 9 11.4C17.25 22.2 21 17.25 21 12V7l-9-5z"/>
      </svg>
    </div>

    <h1 class="bgcheck-title">Background Check</h1>
    <p class="bgcheck-subtitle">Criminal records · Identity · Address history</p>

    <div class="coming-soon-badge">Coming soon</div>

    <div class="info-cards">
      <div class="info-card">
        <span class="info-icon">🔒</span>
        <div>
          <p class="info-title">Stays private</p>
          <p class="info-desc">Only a verified badge appears on your profile. The full report is yours alone.</p>
        </div>
      </div>
      <div class="info-card">
        <span class="info-icon">✅</span>
        <div>
          <p class="info-title">Builds trust fast</p>
          <p class="info-desc">Women shortlist background-verified men 3× more often.</p>
        </div>
      </div>
      <div class="info-card">
        <span class="info-icon">⚡</span>
        <div>
          <p class="info-title">Under 24 hours</p>
          <p class="info-desc">Results delivered digitally — no appointments, no paperwork.</p>
        </div>
      </div>
    </div>

    <button class="notify-btn" type="button" onclick={() => goto('/verified-vibe/profile?tab=boost')}>
      Notify me when it's live
    </button>
  </div>
</div>

<style>
  .bgcheck-page {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--bg-1);
  }

  .bgcheck-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--text-1);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .header-label {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  .bgcheck-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px 32px;
    gap: 0;
  }

  .shield-icon {
    width: 96px;
    height: 96px;
    border-radius: 24px;
    background: linear-gradient(135deg, rgba(255,59,107,0.15), rgba(255,59,107,0.06));
    border: 1px solid rgba(255,59,107,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #E11D54;
    margin-bottom: 20px;
  }

  .bgcheck-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--text-1);
    margin: 0 0 6px;
    text-align: center;
  }

  .bgcheck-subtitle {
    font-size: 13px;
    color: var(--text-3);
    margin: 0 0 20px;
    text-align: center;
  }

  .coming-soon-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 999px;
    background: rgba(255,59,107,0.15);
    border: 1px solid rgba(255,59,107,0.35);
    color: #E11D54;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 36px;
  }

  .info-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    margin-bottom: 36px;
  }

  .info-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
  }

  .info-icon {
    font-size: 22px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .info-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 3px;
  }

  .info-desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.5;
    margin: 0;
  }

  .notify-btn {
    width: 100%;
    padding: 15px;
    border-radius: 14px;
    background: linear-gradient(135deg, #FF3B6B, #FF7A4D);
    border: none;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .notify-btn:hover { opacity: 0.9; }
</style>
