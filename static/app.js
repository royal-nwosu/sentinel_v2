document.addEventListener('DOMContentLoaded', () => {

    let chartInstance   = null;
    let donutChart      = null;
    let countryChart    = null;
    let timelineChart   = null;
    let scatterChart    = null;
    let currentRecords  = [];

    // Check Auth Status on Load
    fetch('/api/check_auth')
        .then(r => r.json())
        .then(data => {
            if (data.logged_in) {
                showDashboard();
            } else {
                showLogin();
            }
        });

    // Auth form toggles
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toRegisterBtn = document.getElementById('show-register');
    const toLoginBtn = document.getElementById('show-login');
    const authMsg = document.getElementById('auth-msg');

    function setAuthMsg(msg, isError = true) {
        authMsg.textContent = msg;
        authMsg.className = `auth-msg ${isError ? 'error' : 'success'}`;
        authMsg.style.display = 'block';
    }

    toRegisterBtn.addEventListener('click', () => {
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        authMsg.style.display = 'none';
    });

    toLoginBtn.addEventListener('click', () => {
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
        authMsg.style.display = 'none';
    });

    // Login Form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                authMsg.style.display = 'none';
                showDashboard();
            } else {
                setAuthMsg(data.message || 'Login failed');
            }
        } catch (err) {
            setAuthMsg('Server error');
        }
    });

    // Register Form
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const confirm  = document.getElementById('reg-confirm').value;

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, confirm })
            });
            const data = await res.json();

            if (data.success) {
                setAuthMsg(data.message, false);
                // Switch back to login
                setTimeout(() => {
                    registerForm.classList.remove('active');
                    loginForm.classList.add('active');
                }, 1500);
            } else {
                setAuthMsg(data.message || 'Registration failed');
            }
        } catch (err) {
            setAuthMsg('Server error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    });

    // Navigation — fix page title on tab switch
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById('tab-' + tabId).classList.add('active');

            const titles = { overview: 'Dashboard Overview', analytics: 'Analytics', records: 'Records' };
            document.getElementById('page-title').textContent = titles[tabId] || 'Dashboard';

            if (tabId === 'overview')  loadDashboard();
            if (tabId === 'analytics') loadAnalytics();
            if (tabId === 'records')   loadRecords();
        });
    });

    // Modal logic
    const modal = document.getElementById('modal');
    document.getElementById('add-btn').addEventListener('click', () => {
        document.getElementById('record-form').reset();
        document.getElementById('f-id').readOnly = false;
        document.getElementById('event-type-prefix').disabled = false;
        document.getElementById('event-id-suffix').readOnly = false;
        document.getElementById('event-id-preview-text').textContent = '—';
        document.getElementById('modal-title').textContent = 'Add Disaster';
        modal.classList.add('active');
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    function setupEventIdBuilder() {
        const prefixSelect = document.getElementById('event-type-prefix');
        const suffixInput  = document.getElementById('event-id-suffix');
        const hiddenIdInput = document.getElementById('f-id');
        const previewText   = document.getElementById('event-id-preview-text');

        if (!prefixSelect || !suffixInput || !hiddenIdInput || !previewText) return;

        const updateEventId = () => {
            const prefix = prefixSelect.value.trim();
            const suffix = suffixInput.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .trim();

            suffixInput.value = suffix;

            if (prefix && suffix) {
                const finalId = `${prefix}${suffix}`;
                hiddenIdInput.value = finalId;
                previewText.textContent = finalId;
            } else {
                hiddenIdInput.value = '';
                previewText.textContent = '—';
            }
        };

        prefixSelect.addEventListener('change', updateEventId);
        suffixInput.addEventListener('input', updateEventId);

        // Sync main type field with prefix
        const disasterTypeSelect = document.getElementById('f-type');
        if (disasterTypeSelect && prefixSelect) {
            const typeToPrefix = {
                Earthquake: 'EQ',
                Hurricane: 'HU',
                Wildfire: 'WF',
                Flood: 'FL',
                Tornado: 'TO',
                'Volcanic Eruption': 'VO',
                Blizzard: 'BL',
                Drought: 'DR'
            };

            disasterTypeSelect.addEventListener('change', () => {
                const mappedPrefix = typeToPrefix[disasterTypeSelect.value] || '';
                prefixSelect.value = mappedPrefix;
                updateEventId();
            });
        }

        updateEventId();
    }

    setupEventIdBuilder();

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        filterAndRenderRecords();
    });

    // Type filter
    document.getElementById('type-filter').addEventListener('change', () => {
        filterAndRenderRecords();
    });

    function getFilteredRecords() {
        const search = document.getElementById('search-input').value.toLowerCase();
        const type   = document.getElementById('type-filter').value;
        return currentRecords.filter(d => {
            const matchType   = !type   || d.type === type;
            const matchSearch = !search || Object.values(d).some(v => String(v).toLowerCase().includes(search));
            return matchType && matchSearch;
        });
    }

    function filterAndRenderRecords() {
        renderRecordsTable(getFilteredRecords());
    }

    // Form Submission (Add/Edit)
    document.getElementById('record-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const event_id = document.getElementById('f-id').value;
        const payload = {
            event_id,
            name:       document.getElementById('f-name').value,
            type:       document.getElementById('f-type').value,
            region:     document.getElementById('f-region').value,
            country:    document.getElementById('f-country').value,
            date:       document.getElementById('f-date').value,
            magnitude:  document.getElementById('f-mag').value,
            casualties: document.getElementById('f-cas').value,
            status:     document.getElementById('f-status').value
        };

        const isEdit = document.getElementById('f-id').readOnly;
        const url    = isEdit ? `/api/disasters/${event_id}` : '/api/disasters';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res  = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                modal.classList.remove('active');
                loadDashboard();
                loadRecords();
            } else {
                alert(data.message || 'Operation failed');
            }
        } catch (err) {
            alert('Server error');
        }
    });

    // ─────────────────────────────────────────
    function showLogin() {
        document.getElementById('dashboard-view').classList.remove('active');
        document.getElementById('login-view').classList.add('active');
    }

    function showDashboard() {
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('dashboard-view').classList.add('active');
        loadDashboard();
        loadRecords();
        loadAnalytics();
    }

    // ─────────────────────────────────────────
    async function loadDashboard() {
        const res = await fetch('/api/dashboard');
        if (res.status === 401) return showLogin();
        const data = await res.json();

        document.getElementById('stat-total').textContent  = data.total;
        document.getElementById('stat-active').textContent = data.active;

        if (data.highest_magnitude) {
            document.getElementById('stat-mag').textContent      = data.highest_magnitude.magnitude;
            document.getElementById('stat-mag-name').textContent = data.highest_magnitude.name;
        } else {
            document.getElementById('stat-mag').textContent      = '-';
            document.getElementById('stat-mag-name').textContent = '-';
        }

        document.getElementById('stat-region').textContent = data.most_affected_region;

        // Deadliest table
        const tbody = document.getElementById('deadliest-tbody');
        tbody.innerHTML = '';
        data.deadliest.forEach(d => {
            if (!d) return;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.name}</td>
                <td>${d.type}</td>
                <td>${d.date}</td>
                <td>${d.casualties.toLocaleString()}</td>
                <td><span class="status-badge ${d.status === 'Active' ? 'status-active' : 'status-inactive'}">${d.status}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // ── BAR CHART: casualties by disaster type ──
        renderBarChart(data.deadliest);
    }

    // ─────────────────────────────────────────
    function renderBarChart(deadliest) {
        const ctx = document.getElementById('casualties-chart');
        if (!ctx) return;

        // Aggregate casualties by type
        const typeMap = {};
        deadliest.forEach(d => {
            if (!d) return;
            typeMap[d.type] = (typeMap[d.type] || 0) + d.casualties;
        });

        const labels = Object.keys(typeMap);
        const values = Object.values(typeMap);

        const colors = [
            '#72baff',
            '#6ce0a3',
            '#ffb347',
            '#b794f4',
            '#f6ad55',
        ];

        // Destroy old chart if exists
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Total Casualties',
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderRadius: 10,
                    maxBarThickness: 90,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.y.toLocaleString()} casualties`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9fb0cf', font: { family: 'Inter' } },
                        grid:  { color: 'rgba(255,255,255,0.04)' }
                    },
                    y: {
                        ticks: {
                            color: '#9fb0cf',
                            font: { family: 'Inter' },
                            callback: v => v.toLocaleString()
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
    }

    // ─────────────────────────────────────────
    async function loadRecords(search = '') {
        const url = '/api/disasters';
        const res = await fetch(url);
        if (res.status === 401) return showLogin();
        currentRecords = await res.json();
        filterAndRenderRecords();
    }

    function renderRecordsTable(data) {
        const tbody = document.getElementById('records-tbody');
        tbody.innerHTML = '';

        document.getElementById('rec-total').textContent    = currentRecords.length;
        document.getElementById('rec-active').textContent   = currentRecords.filter(r => r.status === 'Active').length;
        document.getElementById('rec-inactive').textContent = currentRecords.filter(r => r.status === 'Inactive').length;

        if (!data.length) {
            document.getElementById('empty-state').hidden = false;
        } else {
            document.getElementById('empty-state').hidden = true;
            data.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d.event_id}</td>
                    <td>${d.name}</td>
                    <td>${d.type}</td>
                    <td>${d.region}</td>
                    <td>${d.magnitude}</td>
                    <td><span class="status-badge ${d.status === 'Active' ? 'status-active' : 'status-inactive'}">${d.status}</span></td>
                    <td>
                        <button class="action-btn edit"   data-id="${d.event_id}">Edit</button>
                        <button class="action-btn delete" data-id="${d.event_id}">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', e => editRecord(e.target.getAttribute('data-id'), currentRecords));
        });
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', e => deleteRecord(e.target.getAttribute('data-id')));
        });
    }

    // ─────────────────────────────────────────
    async function loadAnalytics() {
        const res = await fetch('/api/disasters');
        if (res.status === 401) return showLogin();
        const data = await res.json();

        renderDonutChart(data);
        renderCountryChart(data);
        renderTimelineChart(data);
        renderScatterChart(data);
    }

    const CHART_COLORS = [
        '#56a8ff','#25d18a','#f7b941','#b794f4','#ff6b6b',
        '#4cc6ff','#6ce0a3','#ffb347','#a78bfa','#fc8181',
        '#38bdf8','#34d399'
    ];

    const CHART_DEFAULTS = {
        plugins: { legend: { labels: { color: '#8ea2c7', font: { family: 'Inter', size: 12 } } } },
        scales: {
            x: { ticks: { color: '#8ea2c7', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { ticks: { color: '#8ea2c7', font: { family: 'Inter' }, callback: v => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
        },
        responsive: true,
        maintainAspectRatio: false
    };

    function destroyChart(ref) { if (ref) { ref.destroy(); } return null; }

    function renderDonutChart(data) {
        donutChart = destroyChart(donutChart);
        const typeMap = {};
        data.forEach(d => { typeMap[d.type] = (typeMap[d.type] || 0) + 1; });
        const labels = Object.keys(typeMap);
        const values = Object.values(typeMap);
        donutChart = new Chart(document.getElementById('chart-donut'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: CHART_COLORS.slice(0, labels.length), borderWidth: 0, hoverOffset: 8 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#8ea2c7', font: { family: 'Inter', size: 11 }, padding: 14, boxWidth: 12 } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} events` } }
                }
            }
        });
    }

    function renderCountryChart(data) {
        countryChart = destroyChart(countryChart);
        const map = {};
        data.forEach(d => { map[d.country] = (map[d.country] || 0) + d.casualties; });
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const labels = sorted.map(e => e[0]);
        const values = sorted.map(e => e[1]);
        countryChart = new Chart(document.getElementById('chart-country'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Total Casualties', data: values, backgroundColor: '#56a8ff55', borderColor: '#56a8ff', borderWidth: 1.5, borderRadius: 8, maxBarThickness: 50, borderSkipped: false }]
            },
            options: {
                ...CHART_DEFAULTS, indexAxis: 'y',
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()} casualties` } } },
                scales: {
                    x: { ticks: { color: '#8ea2c7', font: { family: 'Inter' }, callback: v => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { ticks: { color: '#8ea2c7', font: { family: 'Inter' } }, grid: { display: false } }
                }
            }
        });
    }

    function renderTimelineChart(data) {
        timelineChart = destroyChart(timelineChart);
        const decadeMap = {};
        data.forEach(d => {
            const year = parseInt(d.date.split('-')[0]);
            const decade = Math.floor(year / 10) * 10;
            const label = `${decade}s`;
            decadeMap[label] = (decadeMap[label] || 0) + 1;
        });
        const sorted = Object.entries(decadeMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        const labels = sorted.map(e => e[0]);
        const values = sorted.map(e => e[1]);
        timelineChart = new Chart(document.getElementById('chart-timeline'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Disasters', data: values,
                    borderColor: '#25d18a', backgroundColor: 'rgba(37,209,138,0.10)',
                    pointBackgroundColor: '#25d18a', pointRadius: 5, pointHoverRadius: 7,
                    fill: true, tension: 0.4, borderWidth: 2
                }]
            },
            options: {
                ...CHART_DEFAULTS,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} disaster${ctx.parsed.y !== 1 ? 's' : ''}` } } },
                scales: {
                    x: { ticks: { color: '#8ea2c7', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { ticks: { color: '#8ea2c7', font: { family: 'Inter' }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    function renderScatterChart(data) {
        scatterChart = destroyChart(scatterChart);
        const typeColors = {};
        let ci = 0;
        const points = data.map(d => {
            if (!typeColors[d.type]) typeColors[d.type] = CHART_COLORS[ci++ % CHART_COLORS.length];
            return { x: d.magnitude, y: d.casualties, label: d.name, type: d.type, color: typeColors[d.type] };
        });
        const datasets = Object.keys(typeColors).map(type => ({
            label: type,
            data: points.filter(p => p.type === type).map(p => ({ x: p.x, y: p.y, label: p.label })),
            backgroundColor: typeColors[type] + 'bb',
            borderColor: typeColors[type],
            borderWidth: 1, pointRadius: 6, pointHoverRadius: 9
        }));
        scatterChart = new Chart(document.getElementById('chart-scatter'), {
            type: 'scatter',
            data: { datasets },
            options: {
                ...CHART_DEFAULTS,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#8ea2c7', font: { family: 'Inter', size: 11 }, padding: 12, boxWidth: 10 } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.raw.label}: mag ${ctx.raw.x}, ${ctx.raw.y.toLocaleString()} casualties` } }
                },
                scales: {
                    x: { title: { display: true, text: 'Magnitude', color: '#8ea2c7' }, ticks: { color: '#8ea2c7', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { title: { display: true, text: 'Casualties', color: '#8ea2c7' }, ticks: { color: '#8ea2c7', font: { family: 'Inter' }, callback: v => v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // ─────────────────────────────────────────
    function editRecord(id, dataList) {
        const record = dataList.find(d => d.event_id === id);
        if (!record) return;

        // Split ID into prefix and suffix
        const prefixes = ['EQ','HU','WF','FL','TO','VO','BL','DR'];
        let prefix = '';
        let suffix = id;

        for (const p of prefixes) {
            if (id.startsWith(p)) {
                prefix = p;
                suffix = id.substring(p.length);
                break;
            }
        }

        document.getElementById('event-type-prefix').value = prefix;
        document.getElementById('event-id-suffix').value = suffix;
        document.getElementById('event-id-preview-text').textContent = id;

        document.getElementById('f-id').value      = record.event_id;
        document.getElementById('f-id').readOnly   = true;
        document.getElementById('event-type-prefix').disabled = true;
        document.getElementById('event-id-suffix').readOnly = true;

        document.getElementById('f-name').value    = record.name;
        document.getElementById('f-type').value    = record.type;
        document.getElementById('f-region').value  = record.region;
        document.getElementById('f-country').value = record.country;
        document.getElementById('f-date').value    = record.date;
        document.getElementById('f-mag').value     = record.magnitude;
        document.getElementById('f-cas').value     = record.casualties;
        document.getElementById('f-status').value  = record.status;

        document.getElementById('modal-title').textContent = 'Edit Disaster';
        modal.classList.add('active');
    }

    // ─────────────────────────────────────────
    async function deleteRecord(id) {
        if (!confirm(`Are you sure you want to delete ${id}?`)) return;

        try {
            const res  = await fetch(`/api/disasters/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadDashboard();
                loadRecords(document.getElementById('search-input').value);
            } else {
                alert(data.message || 'Delete failed');
            }
        } catch (err) {
            alert('Server error');
        }
    }
});
