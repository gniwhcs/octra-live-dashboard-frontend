const $ = id => document.getElementById(id);
const cpuHistory = [];
let address = '';

function num(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(number);
}

function fixed(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
}

function usdPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '$—';
  const digits = number < 0.1 ? 5 : number < 1 ? 4 : 2;
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number)}`;
}

function bytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const units = ['B', 'GB', 'TB'];
  const index = number > 1e12 ? 2 : number > 1e9 ? 1 : 0;
  return `${(number / Math.pow(1000, index * 3)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function duration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '—';
  const days = Math.floor(value / 86400);
  const hours = Math.floor(value % 86400 / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function renderParticipation(network) {
  const container = $('participation-marks');
  const low = Number(network.participation_low_epoch);
  const high = Number(network.participation_high_epoch);
  const marks = new Set((network.participation_marks || []).map(Number));
  const total = Number(network.participation_total || 32);
  const count = Number(network.participation_count);
  $('participation-count').textContent = Number.isFinite(count) ? `${num(count)} / ${num(total)}` : `— / ${num(total)}`;
  container.replaceChildren();
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    for (let index = 0; index < total; index++) {
      const mark = document.createElement('i');
      mark.className = 'unknown';
      container.append(mark);
    }
    return;
  }
  for (let epoch = low; epoch <= high; epoch++) {
    const mark = document.createElement('i');
    const participated = marks.has(epoch);
    mark.className = participated ? 'marked' : 'missed';
    mark.title = `Epoch ${num(epoch)} · ${participated ? 'participated' : 'no committed mark'}`;
    container.append(mark);
  }
}

function setGauge(id, value) {
  $(id).style.setProperty('--pct', Math.max(0, Math.min(100, value || 0)));
}

function setHealth(id, value, warning = 75, critical = 90) {
  const element = $(id);
  element.classList.toggle('warn', value >= warning && value < critical);
  element.classList.toggle('bad', value >= critical);
}

function drawCPUChart() {
  const canvas = $('cpu-chart');
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const padX = 0;
  const padY = 16;

  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#d9d9fa';
  context.fillStyle = '#696969';
  context.font = '9px "DM Mono", monospace';
  context.lineWidth = 1;
  context.setLineDash([2, 4]);
  for (const threshold of [80, 50]) {
    const y = height - padY - (height - padY * 2) * threshold / 100;
    context.beginPath();
    context.moveTo(padX, y);
    context.lineTo(width - padX, y);
    context.stroke();
    context.fillText(`${threshold}%`, padX + 2, y - 4);
  }
  context.setLineDash([]);
  if (cpuHistory.length < 2) return;

  const span = 30;
  context.beginPath();
  cpuHistory.forEach((value, index) => {
    const x = padX + (width - padX * 2) * (index + span - cpuHistory.length + 1) / span;
    const y = height - padY - (height - padY * 2) * Math.max(0, Math.min(100, value)) / 100;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  const latest = cpuHistory[cpuHistory.length - 1] || 0;
  const lineColor = latest >= 90 ? '#bc0019' : latest >= 75 ? '#c56700' : '#0000db';
  context.strokeStyle = lineColor;
  context.lineWidth = 2;
  context.stroke();

  const lastX = width - padX;
  context.lineTo(lastX, height - padY);
  context.lineTo(padX, height - padY);
  context.closePath();
  const gradient = context.createLinearGradient(0, padY, 0, height - padY);
  gradient.addColorStop(0, 'rgba(0,0,219,.18)');
  gradient.addColorStop(1, 'rgba(0,0,219,0)');
  context.fillStyle = gradient;
  context.fill();
}

function update(data) {
  const status = data.status || {};
  const metrics = data.metrics || {};
  const root = data.root || {};
  const host = data.host || {};
  const validator = data.validator || {};
  const enrollment = data.enrollment || {};
  const rewards = data.rewards || {};
  const price = data.price || {};
  const network = data.network || {};
  const performance = data.performance || {};
  const consensus = data.peers || {};
  const diagnostics = consensus.p2p_diagnostics || {};
  const peerCount = Number(diagnostics.connected ?? (consensus.peers || []).length);

  address = status.validator || root.validator || address;
  $('address').textContent = address || 'unknown identity';

  const activeMember = (validator.validators || []).find(item => item.address === address);
  const scheduledMember = ((validator.scheduled || {}).validators || []).find(item => item.address === address);
  const validatorState = activeMember ? 'active' : scheduledMember ? 'scheduled' : 'observer';
  const weight = (activeMember || scheduledMember || {}).weight;

  $('role-label').textContent = `${validatorState === 'observer' ? 'observer' : `${validatorState} validator`} / devnet`;
  $('validator-status').textContent = activeMember ? 'active consensus validator' : scheduledMember ? `scheduled for epoch ${num((validator.scheduled || {}).activate_epoch)}` : 'observer node';
  $('validator-strip').className = `validator-strip ${validatorState}`;
  $('validator-bond').textContent = enrollment.bond ? `${fixed(Number(enrollment.bond) / 1e6)} OCT` : '—';
  $('validator-weight').textContent = weight ? `${fixed(Number(weight) / 1e6)} OCT` : '—';
  $('validator-set-size').textContent = num(validator.n || (validator.validators || []).length);
  $('validator-quorum').textContent = num(validator.quorum);

  const roundState = consensus.round_state || {};
  const roundPeers = (consensus.round_peers || []).length;
  const round = roundState.round;
  const stage = String(roundState.step || 'waiting').toLowerCase();
  $('voting-status').textContent = consensus.voting ? 'voting enabled · live consensus' : 'voting unavailable';

  $('total-rewards').textContent = rewards.total !== undefined ? fixed(rewards.total) : '—';
  const rewardUpdated = rewards.updated_at ? new Date(rewards.updated_at) : null;
  const rewardAge = rewardUpdated ? Date.now() - rewardUpdated.getTime() : Infinity;
  $('reward-freshness').textContent = rewards.complete && rewardAge < 15000 ? 'live' : rewards.updated_at ? 'cached' : 'waiting';
  if (rewardUpdated) $('total-rewards').title = `Updated ${rewardUpdated.toLocaleString()}`;
  $('epoch').textContent = num(status.current_epoch || root.epoch);
  const cadence = Number(network.recent_cadence_seconds);
  $('recent-cadence').textContent = Number.isFinite(cadence) && cadence > 0 ? `${cadence.toFixed(1)} s` : '—';
  renderParticipation(network);
  $('accounts').textContent = num(status.total_accounts);
  $('active-accounts').textContent = `${num(status.active_accounts)} active`;
  $('tx-index').textContent = num(status.txid_hi);
  $('last-epoch-txs').textContent = `${num(metrics.last_epoch_txs)} in last epoch`;
  $('peak-tps').textContent = fixed(metrics.peak_tps);
  $('epoch-time').textContent = `${fixed(Number(metrics.last_epoch_duration || 0) * 1000)} ms execution`;

  const lag = Math.max(0, Number(status.current_epoch || 0) - Number(status.head_epoch || 0));
  $('peer-count').textContent = num(peerCount);
  const syncLabel = $('sync-label');
  syncLabel.textContent = activeMember ? '' : 'network sync';
  syncLabel.hidden = Boolean(activeMember);
  $('sync-state').textContent = activeMember && round !== undefined ? `ROUND ${num(round)}` : scheduledMember ? 'SCHEDULED' : lag <= 2 ? 'SYNCHRONIZED' : 'CATCHING UP';
  $('head-lag').textContent = activeMember ? `${stage} · ${roundPeers} participants` : lag ? `${lag} epoch behind head` : 'at network head';
  const quorumCoverage = Number(validator.quorum || 0) ? peerCount / Number(validator.quorum) * 100 : peerCount ? 100 : 12;
  $('sync-ring').style.setProperty('--pct', Math.min(100, quorumCoverage));

  $('memory-pct').textContent = `${num(host.memory_used_pct)}%`;
  $('memory-detail').textContent = `${bytes(host.memory_used_bytes)} / ${bytes(host.memory_total_bytes)}`;
  setGauge('memory-gauge', host.memory_used_pct);
  setHealth('memory-gauge', Number(host.memory_used_pct || 0));
  const diskFree = Math.max(0, Number(host.disk_total_bytes || 0) - Number(host.disk_used_bytes || 0));
  $('disk-pct').textContent = `${num(host.disk_used_pct)}%`;
  $('disk-detail').textContent = `${bytes(host.disk_used_bytes)} / ${bytes(diskFree)}`;
  setGauge('disk-gauge', host.disk_used_pct);
  setHealth('disk-gauge', Number(host.disk_used_pct || 0), 70, 85);
  const cpu = Number(host.cpu_used_pct || 0);
  $('cpu-pct').textContent = `${fixed(cpu)}%`;
  setHealth('cpu-pct', cpu);
  cpuHistory.push(cpu);
  if (cpuHistory.length > 31) cpuHistory.shift();
  drawCPUChart();
  $('load').textContent = Number(host.load_1m || 0).toFixed(2);
  $('uptime').textContent = duration(performance.node_uptime_seconds ?? host.uptime_seconds);
  $('epochs-validated').textContent = performance.epochs_validated !== undefined ? num(performance.epochs_validated) : '—';
  $('epochs-proposed').textContent = performance.epochs_proposed !== undefined ? num(performance.epochs_proposed) : '—';

  const change = Number(price.change_24h);
  $('oct-price').textContent = usdPrice(price.usd);
  $('price-change').textContent = Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${fixed(change)}%` : '—';
  $('price-change').className = Number.isFinite(change) ? (change >= 0 ? 'positive' : 'negative') : '';
  if (price.updated_at) $('oct-price').title = `Updated ${new Date(Number(price.updated_at) * 1000).toLocaleTimeString([], { hour12: false })}`;

  $('connection').textContent = data.online ? 'LIVE' : 'DEGRADED';
  $('live-dot').className = `live-dot ${data.online ? 'online' : 'offline'}`;
}

async function refresh() {
  try {
    const response = await fetch('/api/snapshot', { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status);
    update(await response.json());
  } catch (error) {
    $('connection').textContent = 'OFFLINE';
    $('live-dot').className = 'live-dot offline';
  }
}

$('copy').addEventListener('click', async () => {
  if (!address) return;
  await navigator.clipboard.writeText(address);
  $('copy').textContent = 'copied';
  setTimeout(() => { $('copy').textContent = 'copy'; }, 1200);
});

function tick() {
  $('clock').textContent = `${new Date().toISOString().slice(11, 19)} UTC`;
}

function formatSourceUpdated() {
  const element = $('source-updated');
  if (!element || !element.dateTime) return;
  const updated = new Date(element.dateTime);
  if (Number.isNaN(updated.getTime())) return;
  element.textContent = `${updated.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

window.addEventListener('resize', drawCPUChart);
formatSourceUpdated();
tick();
setInterval(tick, 1000);
refresh();
setInterval(refresh, 2000);
