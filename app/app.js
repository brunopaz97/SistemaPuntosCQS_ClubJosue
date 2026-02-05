/* ==========================
    MODELO (LocalStorage)
    ========================== */

const LS_KEY = "conquis_score_app_v1";

function uid(prefix = "id") {
    return prefix + "_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function nowISO() {
    return new Date().toISOString();
}
function safeInt(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
}
function fmtDate(iso) {
    if (!iso) return "—";
    // iso: YYYY-MM-DD
    return iso;
}
function escapeHtml(s) {
    return (s ?? "").toString()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function defaultState() {
    const D = window.APP_DEFAULTS;

    return {
        meta: {
            updatedAt: nowISO()
        },
        config: {
            seasonLabel: D.seasonLabel,
            points: {
                bible: D.points.bible,
                scarf: D.points.scarf,
                punctual: D.points.punctual,
                notebook: D.points.notebook,
                investedFriend: D.points.investedFriend,
                eventParticipation: D.points.eventParticipation
            },
            blockRedeemIfInsufficient: D.blockRedeemIfInsufficient
        },
        members: [
            { id: uid("m"), name: "Bruno Paz (demo)", unit: "Halcones", active: true }
        ],
        prizes: [
            { id: uid("p"), name: "Pulsera paracord con silbato y brújula", season: "sep", cost: 180, stock: 3, desc: "Útil para campamentos" },
            { id: uid("p"), name: "Gift card Temu", season: "dec", cost: 380, stock: 2, desc: "Premio grande" },
            { id: uid("p"), name: "Linterna profesional", season: "dec", cost: 280, stock: 2, desc: "" }
        ],
        home: {
            earnRules: [
                { label: "Biblia", points: 1 },
                { label: "Pañoleta", points: 1 },
                { label: "Puntualidad", points: 2 },
                { label: "Cuadernillo", points: 1 },
                { label: "Participación en evento", points: 10 },
                { label: "Amigo investido", points: 20 },
            ],
            loseRules: [
                { label: "Llegar tarde reiteradamente", points: -2 },
                { label: "Olvidar uniforme reiteradamente", points: -2 },
                { label: "No respetar indicaciones", points: -3 },
                { label: "Interrumpir actividades", points: -5 },
                { label: "Falta de respeto", points: -5 },
                { label: "Peleas", points: -10 },
            ]
        },
        upcomingEvents: [
            { id: uid("u"), date: "2026-03-14", name: "Servicio comunitario", place: "Parque", points: 10 },
            { id: uid("u"), date: "2026-04-11", name: "Caminata / Marcha", place: "Iglesia", points: 10 }
        ],

        auth: {
            // SOLO UI (no seguridad real). Para seguridad real, usar Worker.
            adminEnabled: false
        },

        ledger: [
            // movimientos: {id, at, date, type, memberId, points, detail, ref?}
            // type: meeting, event, invested, adjustment, redeem
        ]
    };
}

function loadState() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return defaultState();
        const obj = JSON.parse(raw);
        if (!obj || !obj.config || !obj.members || !obj.ledger || !obj.prizes) return defaultState();
        return obj;
    } catch (e) {
        return defaultState();
    }
}
function saveState() {
    state.meta.updatedAt = nowISO();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    renderAll();
}

let state = loadState();

/* ==========================
    CÁLCULOS
    ========================== */
function memberById(id) { return state.members.find(m => m.id === id); }

function computeTotals() {
    // acumulado: suma puntos (incluye positivos y negativos) EXCEPTO canjes (que son negativos también, pero los separaremos)
    const totals = {};
    for (const m of state.members) {
        totals[m.id] = { earned: 0, redeemed: 0, balance: 0 };
    }
    for (const mv of state.ledger) {
        if (!totals[mv.memberId]) totals[mv.memberId] = { earned: 0, redeemed: 0, balance: 0 };
        if (mv.type === "redeem") {
            totals[mv.memberId].redeemed += Math.abs(safeInt(mv.points, 0));
        } else {
            totals[mv.memberId].earned += safeInt(mv.points, 0);
        }
    }
    for (const id in totals) {
        totals[id].balance = totals[id].earned - totals[id].redeemed;
    }
    return totals;
}

function sortedRanking(unit = "all") {
    const totals = computeTotals();
    const members = state.members
        .filter(m => m.active)
        .filter(m => unit === "all" ? true : (m.unit || "").toLowerCase() === unit.toLowerCase());

    return members
        .map(m => ({
            ...m,
            earned: totals[m.id]?.earned ?? 0,
            redeemed: totals[m.id]?.redeemed ?? 0,
            balance: totals[m.id]?.balance ?? 0
        }))
        .sort((a, b) => (b.balance - a.balance) || (b.earned - a.earned) || a.name.localeCompare(b.name));
}

function clubTotalPoints() {
    const totals = computeTotals();
    let total = 0;
    for (const id in totals) {
        total += (totals[id].earned - totals[id].redeemed);
    }
    return total;
}

/* ==========================
    UI: TABS
    ========================== */
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(tab).classList.add("active");
});

/* ==========================
    RENDER HELPERS
    ========================== */
function fillMemberSelect(sel, includeAll = false) {
    const activeMembers = [...state.members].sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = "";
    if (includeAll) {
        const opt = document.createElement("option");
        opt.value = "all"; opt.textContent = "Todos";
        sel.appendChild(opt);
    }
    for (const m of activeMembers) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = `${m.name}${m.active ? "" : " (inactivo)"}${m.unit ? " — " + m.unit : ""}`;
        sel.appendChild(opt);
    }
}

function uniqueUnits() {
    const s = new Set();
    for (const m of state.members) {
        if (m.unit) s.add(m.unit.trim());
    }
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/* ==========================
    DASHBOARD
    ========================== */
function renderDashboard() {
    document.getElementById("seasonPill").textContent = `Temporada: ${state.config.seasonLabel || "—"}`;
    document.getElementById("kpiUpdated").textContent = new Date(state.meta.updatedAt).toLocaleString();
    const activeCount = state.members.filter(m => m.active).length;
    document.getElementById("kpiMembers").textContent = activeCount;
    document.getElementById("kpiTotalPoints").textContent = clubTotalPoints();

    // top10
    const rank = sortedRanking("all").slice(0, 10);
    const tbody = document.getElementById("top10Body");
    tbody.innerHTML = "";
    rank.forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${idx + 1}</td>
<td>${escapeHtml(m.name)}</td>
<td>${escapeHtml(m.unit || "—")}</td>
<td class="right">${m.earned}</td>
<td class="right">${m.redeemed}</td>
<td class="right"><b>${m.balance}</b></td>
`;
        tbody.appendChild(tr);
    });

    // recent
    const recent = [...state.ledger]
        .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
        .slice(0, 15);

    const rbody = document.getElementById("recentBody");
    rbody.innerHTML = "";
    for (const mv of recent) {
        const m = memberById(mv.memberId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${escapeHtml(mv.type)}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml(mv.detail || "")}</td>
<td class="right">${safeInt(mv.points, 0)}</td>
`;
        rbody.appendChild(tr);
    }
}

function renderAdminStatus() {
    const st = document.getElementById("adminStatus");
    if (st) st.textContent = state.auth?.adminEnabled ? "Admin" : "Lectura";

    // opcional: habilitar/deshabilitar botones de edición globalmente
    // (por ahora solo afecta Upcoming Admin porque ahí ya pones disabled)
}

function renderHome() {
    // banner opcional (si existe)
    const banner = document.getElementById("homeBanner");
    banner.onerror = () => banner.style.display = "none";
    banner.onload = () => banner.style.display = "block";
    banner.src = "assets/banner.jpg"; // si no existe, se oculta

    // Earn table
    const earnBody = document.getElementById("earnTable");
    earnBody.innerHTML = "";
    (state.home?.earnRules || []).forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(r.label)}</td><td class="right"><b>${safeInt(r.points, 0)}</b></td>`;
        earnBody.appendChild(tr);
    });

    // Lose table
    const loseBody = document.getElementById("loseTable");
    loseBody.innerHTML = "";
    (state.home?.loseRules || []).forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(r.label)}</td><td class="right"><b>${safeInt(r.points, 0)}</b></td>`;
        loseBody.appendChild(tr);
    });

    renderUpcoming();
    renderAdminStatus();
}

function renderUpcoming() {
    const limit = safeInt(document.getElementById("homeUpcomingLimit")?.value, 10);
    const today = todayISO();

    const rows = (state.upcomingEvents || [])
        .filter(e => (e.date || "") >= today)  // solo futuros
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .slice(0, limit);

    const tbody = document.getElementById("upcomingBody");
    tbody.innerHTML = "";
    if (rows.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="4" class="muted">No hay eventos próximos configurados.</td>`;
        tbody.appendChild(tr);
        return;
    }
    rows.forEach(ev => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${fmtDate(ev.date)}</td>
        <td>${escapeHtml(ev.name)}</td>
        <td>${escapeHtml(ev.place || "—")}</td>
        <td class="right">${safeInt(ev.points, 0)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Admin list (ajustes)
    renderUpcomingAdmin();
}

function renderUpcomingAdmin() {
    const tbody = document.getElementById("upcomingAdminBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const rows = [...(state.upcomingEvents || [])]
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    rows.forEach(ev => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
        <td>${fmtDate(ev.date)}</td>
        <td>${escapeHtml(ev.name)}</td>
        <td>${escapeHtml(ev.place || "—")}</td>
        <td class="right">${safeInt(ev.points, 0)}</td>
        <td class="right">
            <button class="btn small danger" data-del-up="${ev.id}" ${state.auth?.adminEnabled ? "" : "disabled"}>Borrar</button>
        </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById("homeUpcomingLimit")?.addEventListener("change", renderUpcoming);

document.getElementById("btnAddUpcoming")?.addEventListener("click", () => {
    if (!state.auth?.adminEnabled) {
        alert("Modo administración requerido para editar.");
        return;
    }
    const date = document.getElementById("uDate").value || todayISO();
    const name = (document.getElementById("uName").value || "").trim();
    const place = (document.getElementById("uPlace").value || "").trim();
    const points = safeInt(document.getElementById("uPts").value, state.config.points.eventParticipation);

    if (!name) { alert("Evento obligatorio."); return; }

    state.upcomingEvents.push({ id: uid("u"), date, name, place, points });

    document.getElementById("uName").value = "";
    document.getElementById("uPlace").value = "";
    document.getElementById("uPts").value = "";

    saveState();
});

document.getElementById("upcomingAdminBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.delUp;
    if (!id) return;
    if (!state.auth?.adminEnabled) {
        alert("Modo administración requerido.");
        return;
    }
    if (!confirm("¿Borrar este evento?")) return;
    state.upcomingEvents = state.upcomingEvents.filter(x => x.id !== id);
    saveState();
});

// ==========================
// ADMIN MODE (solo UI)
// ==========================
document.getElementById("btnAdminLogin")?.addEventListener("click", () => {
    const key = (document.getElementById("adminKey").value || "").trim();
    if (key === (window.ADMIN_KEY || "")) {
        state.auth.adminEnabled = true;
        saveState();
    } else {
        alert("Clave incorrecta.");
    }
});

document.getElementById("btnAdminLogout")?.addEventListener("click", () => {
    state.auth.adminEnabled = false;
    saveState();
});


/* ==========================
    MIEMBROS
    ========================== */
let editingMemberId = null;

function renderMembers() {
    const q = (document.getElementById("memberSearch").value || "").toLowerCase().trim();
    const filter = document.getElementById("memberFilter").value;

    const list = state.members
        .filter(m => {
            if (filter === "active" && !m.active) return false;
            if (filter === "inactive" && m.active) return false;
            return true;
        })
        .filter(m => {
            if (!q) return true;
            return (m.name || "").toLowerCase().includes(q) || (m.unit || "").toLowerCase().includes(q);
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const tbody = document.getElementById("memberBody");
    tbody.innerHTML = "";
    for (const m of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${escapeHtml(m.name)}</td>
<td>${escapeHtml(m.unit || "—")}</td>
<td>${m.active ? `<span class="tag"><span class="dot ok"></span>Activo</span>` : `<span class="tag"><span class="dot warn"></span>Inactivo</span>`}</td>
<td class="right">
<button class="btn small" data-act="edit" data-id="${m.id}">Editar</button>
<button class="btn small danger" data-act="toggle" data-id="${m.id}">${m.active ? "Inactivar" : "Activar"}</button>
</td>
`;
        tbody.appendChild(tr);
    }

    // refresh selects
    fillMemberSelect(document.getElementById("meetMember"));
    fillMemberSelect(document.getElementById("eventMember"));
    fillMemberSelect(document.getElementById("invMember"));
    fillMemberSelect(document.getElementById("adjMember"));
    fillMemberSelect(document.getElementById("redeemMember"));
    fillMemberSelect(document.getElementById("meetFilterMember"), true);
    fillMemberSelect(document.getElementById("eventFilterMember"), true);
}

document.getElementById("btnSaveMember").addEventListener("click", () => {
    const name = (document.getElementById("mName").value || "").trim();
    const unit = (document.getElementById("mUnit").value || "").trim();
    const active = document.getElementById("mActive").value === "true";
    if (!name) { alert("Nombre es obligatorio."); return; }

    if (editingMemberId) {
        const m = memberById(editingMemberId);
        if (!m) { editingMemberId = null; return; }
        m.name = name; m.unit = unit; m.active = active;
        editingMemberId = null;
    } else {
        state.members.push({ id: uid("m"), name, unit, active });
    }

    document.getElementById("mName").value = "";
    document.getElementById("mUnit").value = "";
    document.getElementById("mActive").value = "true";
    saveState();
});

document.getElementById("memberBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const m = memberById(id);
    if (!m) return;

    if (act === "edit") {
        editingMemberId = id;
        document.getElementById("mName").value = m.name;
        document.getElementById("mUnit").value = m.unit || "";
        document.getElementById("mActive").value = m.active ? "true" : "false";
        alert("Editando miembro. Ajusta y presiona Guardar.");
    }
    if (act === "toggle") {
        m.active = !m.active;
        saveState();
    }
});

document.getElementById("memberSearch").addEventListener("input", renderMembers);
document.getElementById("memberFilter").addEventListener("change", renderMembers);

/* ==========================
    REUNIONES
    ========================== */
function refreshMeetingPointsUI() {
    const pts = state.config.points;
    document.getElementById("pBible").textContent = pts.bible;
    document.getElementById("pScarf").textContent = pts.scarf;
    document.getElementById("pPunctual").textContent = pts.punctual;
    document.getElementById("pNotebook").textContent = pts.notebook;

    const meetingPoints = computeMeetingPoints();
    document.getElementById("meetPoints").textContent = meetingPoints;
}

function computeMeetingPoints() {
    const pts = state.config.points;
    let total = 0;
    if (document.getElementById("chkBible").checked) total += pts.bible;
    if (document.getElementById("chkScarf").checked) total += pts.scarf;
    if (document.getElementById("chkPunctual").checked) total += pts.punctual;
    if (document.getElementById("chkNotebook").checked) total += pts.notebook;

    const b = document.getElementById("meetBonus").value;
    if (b && b !== "0") {
        const n = parseInt(b, 10);
        if (Number.isFinite(n)) total += n;
        else {
            // values like 5b, 5c
            const n2 = parseInt(b.replace(/[^\d]/g, ""), 10);
            if (Number.isFinite(n2)) total += n2;
        }
    }
    return total;
}

["chkBible", "chkScarf", "chkPunctual", "chkNotebook", "meetBonus"].forEach(id => {
    document.getElementById(id).addEventListener("change", refreshMeetingPointsUI);
});

document.getElementById("btnAddMeeting").addEventListener("click", () => {
    const date = document.getElementById("meetDate").value || todayISO();
    const type = document.getElementById("meetType").value;
    const memberId = document.getElementById("meetMember").value;
    if (!memberId) { alert("Selecciona un conquistador."); return; }

    const pts = computeMeetingPoints();
    if (pts === 0) { if (!confirm("Puntos 0. ¿Registrar igual?")) return; }

    const detailParts = [];
    if (document.getElementById("chkBible").checked) detailParts.push("Biblia");
    if (document.getElementById("chkScarf").checked) detailParts.push("Pañoleta");
    if (document.getElementById("chkPunctual").checked) detailParts.push("Puntual");
    if (document.getElementById("chkNotebook").checked) detailParts.push("Cuadernillo");
    const bonusVal = document.getElementById("meetBonus").value;
    if (bonusVal !== "0") detailParts.push("Bono");
    const notes = (document.getElementById("meetNotes").value || "").trim();
    const detail = `${type === "sabado" ? "Reunión sábado" : "Reunión domingo"} — ${detailParts.join(", ")}${notes ? " | " + notes : ""}`;

    state.ledger.push({
        id: uid("mv"),
        at: nowISO(),
        date,
        type: "meeting",
        memberId,
        points: pts,
        detail
    });

    // reset checks
    ["chkBible", "chkScarf", "chkPunctual", "chkNotebook"].forEach(id => document.getElementById(id).checked = false);
    document.getElementById("meetBonus").value = "0";
    document.getElementById("meetNotes").value = "";
    refreshMeetingPointsUI();

    saveState();
});

function renderMeetings() {
    const from = document.getElementById("meetFrom").value;
    const to = document.getElementById("meetTo").value;
    const memberFilter = document.getElementById("meetFilterMember").value;

    const rows = state.ledger
        .filter(mv => mv.type === "meeting")
        .filter(mv => memberFilter === "all" ? true : mv.memberId === memberFilter)
        .filter(mv => !from || mv.date >= from)
        .filter(mv => !to || mv.date <= to)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const tbody = document.getElementById("meetBody");
    tbody.innerHTML = "";
    for (const mv of rows) {
        const m = memberById(mv.memberId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${escapeHtml((mv.detail || "").includes("domingo") ? "domingo" : "sábado")}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml(mv.detail || "")}</td>
<td class="right">${safeInt(mv.points, 0)}</td>
<td class="right"><button class="btn small danger" data-del="${mv.id}">Borrar</button></td>
`;
        tbody.appendChild(tr);
    }
}

document.getElementById("meetBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.del;
    if (!id) return;
    if (!confirm("¿Borrar este registro de reunión?")) return;
    state.ledger = state.ledger.filter(mv => mv.id !== id);
    saveState();
});

["meetFrom", "meetTo", "meetFilterMember"].forEach(id => {
    document.getElementById(id).addEventListener("change", renderMeetings);
});

/* ==========================
    EVENTOS
    ========================== */
document.getElementById("btnAddEvent").addEventListener("click", () => {
    const name = (document.getElementById("eventName").value || "").trim();
    const date = document.getElementById("eventDate").value || todayISO();
    const memberId = document.getElementById("eventMember").value;
    const points = safeInt(document.getElementById("eventPoints").value, state.config.points.eventParticipation);
    const notes = (document.getElementById("eventNotes").value || "").trim();

    if (!name) { alert("Nombre del evento es obligatorio."); return; }
    if (!memberId) { alert("Selecciona un conquistador."); return; }

    state.ledger.push({
        id: uid("mv"),
        at: nowISO(),
        date,
        type: "event",
        memberId,
        points,
        detail: `${name}${notes ? " | " + notes : ""}`
    });

    document.getElementById("eventName").value = "";
    document.getElementById("eventNotes").value = "";
    saveState();
});

function renderEvents() {
    const q = (document.getElementById("eventSearch").value || "").toLowerCase().trim();
    const memberFilter = document.getElementById("eventFilterMember").value;

    const rows = state.ledger
        .filter(mv => mv.type === "event")
        .filter(mv => memberFilter === "all" ? true : mv.memberId === memberFilter)
        .filter(mv => !q || (mv.detail || "").toLowerCase().includes(q))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const tbody = document.getElementById("eventBody");
    tbody.innerHTML = "";
    for (const mv of rows) {
        const m = memberById(mv.memberId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${escapeHtml((mv.detail || "").split("|")[0].trim())}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml(mv.detail || "")}</td>
<td class="right">${safeInt(mv.points, 0)}</td>
<td class="right"><button class="btn small danger" data-del="${mv.id}">Borrar</button></td>
`;
        tbody.appendChild(tr);
    }
}

document.getElementById("eventBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.del;
    if (!id) return;
    if (!confirm("¿Borrar este registro de evento?")) return;
    state.ledger = state.ledger.filter(mv => mv.id !== id);
    saveState();
});
document.getElementById("eventSearch").addEventListener("input", renderEvents);
document.getElementById("eventFilterMember").addEventListener("change", renderEvents);

/* ==========================
    INVESTIDOS
    ========================== */
document.getElementById("btnAddInv").addEventListener("click", () => {
    const memberId = document.getElementById("invMember").value;
    const date = document.getElementById("invDate").value || todayISO();
    const friendName = (document.getElementById("invFriendName").value || "").trim();
    const points = safeInt(document.getElementById("invPoints").value, state.config.points.investedFriend);

    if (!memberId) { alert("Selecciona un conquistador."); return; }

    state.ledger.push({
        id: uid("mv"),
        at: nowISO(),
        date,
        type: "invested",
        memberId,
        points,
        detail: friendName ? `Amigo: ${friendName}` : "Amigo investido"
    });

    document.getElementById("invFriendName").value = "";
    saveState();
});

function renderInvested() {
    const rows = state.ledger
        .filter(mv => mv.type === "invested")
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const tbody = document.getElementById("invBody");
    tbody.innerHTML = "";
    for (const mv of rows) {
        const m = memberById(mv.memberId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml(mv.detail?.replace("Amigo:", "").trim() || "—")}</td>
<td class="right">${safeInt(mv.points, 0)}</td>
<td class="right"><button class="btn small danger" data-del="${mv.id}">Borrar</button></td>
`;
        tbody.appendChild(tr);
    }
}
document.getElementById("invBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.del;
    if (!id) return;
    if (!confirm("¿Borrar este registro de investido?")) return;
    state.ledger = state.ledger.filter(mv => mv.id !== id);
    saveState();
});

/* ==========================
    BONOS / DESCUENTOS
    ========================== */
document.getElementById("btnAddAdj").addEventListener("click", () => {
    const memberId = document.getElementById("adjMember").value;
    const date = document.getElementById("adjDate").value || todayISO();
    const type = document.getElementById("adjType").value;
    const pointsRaw = safeInt(document.getElementById("adjPoints").value, 0);
    const reason = (document.getElementById("adjReason").value || "").trim();

    if (!memberId) { alert("Selecciona un conquistador."); return; }
    if (!reason) { alert("Motivo es obligatorio."); return; }
    if (pointsRaw === 0) { alert("Puntos no puede ser 0."); return; }

    const points = (type === "deduction") ? -Math.abs(pointsRaw) : Math.abs(pointsRaw);

    state.ledger.push({
        id: uid("mv"),
        at: nowISO(),
        date,
        type: "adjustment",
        memberId,
        points,
        detail: `${type === "deduction" ? "Descuento" : "Bono"} — ${reason}`
    });

    document.getElementById("adjPoints").value = "";
    document.getElementById("adjReason").value = "";
    saveState();
});

function renderAdjustments() {
    const rows = state.ledger
        .filter(mv => mv.type === "adjustment")
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const tbody = document.getElementById("adjBody");
    tbody.innerHTML = "";
    for (const mv of rows) {
        const m = memberById(mv.memberId);
        const isNeg = safeInt(mv.points, 0) < 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${isNeg ? `<span class="tag"><span class="dot danger"></span>Descuento</span>` : `<span class="tag"><span class="dot ok"></span>Bono</span>`}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml(mv.detail || "")}</td>
<td class="right">${safeInt(mv.points, 0)}</td>
<td class="right"><button class="btn small danger" data-del="${mv.id}">Borrar</button></td>
`;
        tbody.appendChild(tr);
    }
}
document.getElementById("adjBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.del;
    if (!id) return;
    if (!confirm("¿Borrar este bono/descuento?")) return;
    state.ledger = state.ledger.filter(mv => mv.id !== id);
    saveState();
});

/* ==========================
    PREMIOS + CANJE
    ========================== */
document.getElementById("btnAddPrize").addEventListener("click", () => {
    const name = (document.getElementById("prizeName").value || "").trim();
    const season = document.getElementById("prizeSeason").value;
    const cost = safeInt(document.getElementById("prizeCost").value, 0);
    const stock = safeInt(document.getElementById("prizeStock").value, 0);
    const desc = (document.getElementById("prizeDesc").value || "").trim();

    if (!name) { alert("Nombre del premio es obligatorio."); return; }
    if (cost <= 0) { alert("Costo debe ser > 0."); return; }
    if (stock < 0) { alert("Stock inválido."); return; }

    // si existe mismo nombre + season, actualiza (simple)
    const existing = state.prizes.find(p => p.name.toLowerCase() === name.toLowerCase() && p.season === season);
    if (existing) {
        existing.cost = cost;
        existing.stock = stock;
        existing.desc = desc;
    } else {
        state.prizes.push({ id: uid("p"), name, season, cost, stock, desc });
    }

    document.getElementById("prizeName").value = "";
    document.getElementById("prizeCost").value = "";
    document.getElementById("prizeStock").value = "";
    document.getElementById("prizeDesc").value = "";
    saveState();
});

function renderPrizes() {
    const seasonFilter = document.getElementById("prizeFilterSeason").value;
    const memberId = document.getElementById("redeemMember").value;
    const totals = computeTotals();
    const bal = totals[memberId]?.balance ?? 0;

    const rows = [...state.prizes]
        .filter(p => seasonFilter === "all" ? true : p.season === seasonFilter)
        .sort((a, b) => (a.season.localeCompare(b.season)) || (a.cost - b.cost) || a.name.localeCompare(b.name));

    const tbody = document.getElementById("prizeBody");
    tbody.innerHTML = "";
    for (const p of rows) {
        const seasonTxt = p.season === "sep" ? "Septiembre" : "Diciembre";
        const canRedeem = p.stock > 0 && (!state.config.blockRedeemIfInsufficient || bal >= p.cost);

        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${seasonTxt}</td>
<td>${escapeHtml(p.name)}<div class="muted">${escapeHtml(p.desc || "")}</div></td>
<td>${p.stock}</td>
<td class="right"><b>${p.cost}</b></td>
<td class="right">
<button class="btn small ${canRedeem ? "good" : "danger"}" data-redeem="${p.id}" ${canRedeem ? "" : "disabled"}>
    Canjear
</button>
</td>
`;
        tbody.appendChild(tr);
    }
}

document.getElementById("prizeBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const prizeId = btn.dataset.redeem;
    if (!prizeId) return;

    const memberId = document.getElementById("redeemMember").value;
    const prize = state.prizes.find(p => p.id === prizeId);
    const m = memberById(memberId);
    if (!prize || !m) { alert("Selecciona miembro y premio."); return; }
    if (prize.stock <= 0) { alert("Sin stock."); return; }

    const totals = computeTotals();
    const bal = totals[memberId]?.balance ?? 0;

    if (state.config.blockRedeemIfInsufficient && bal < prize.cost) {
        alert(`Saldo insuficiente. Saldo: ${bal}, costo: ${prize.cost}`);
        return;
    }

    if (!confirm(`Confirmar canje:\n${m.name}\nPremio: ${prize.name}\nCosto: ${prize.cost} pts`)) return;

    // reduce stock
    prize.stock -= 1;

    // movimiento de canje (redeem)
    state.ledger.push({
        id: uid("mv"),
        at: nowISO(),
        date: todayISO(),
        type: "redeem",
        memberId,
        points: -Math.abs(prize.cost),
        detail: `Canje — ${prize.name}`
    });

    saveState();
});

function renderRedeems() {
    const rows = state.ledger
        .filter(mv => mv.type === "redeem")
        .sort((a, b) => (b.at || "").localeCompare(a.at || ""));

    const tbody = document.getElementById("redeemBody");
    tbody.innerHTML = "";
    for (const mv of rows) {
        const m = memberById(mv.memberId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${fmtDate(mv.date)}</td>
<td>${escapeHtml(m?.name || "—")}</td>
<td>${escapeHtml((mv.detail || "").replace("Canje — ", ""))}</td>
<td class="right">${Math.abs(safeInt(mv.points, 0))}</td>
<td class="right"><button class="btn small danger" data-del="${mv.id}">Borrar</button></td>
`;
        tbody.appendChild(tr);
    }
}

document.getElementById("redeemBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.del;
    if (!id) return;
    const mv = state.ledger.find(x => x.id === id);
    if (!mv) return;

    // al borrar canje, devolvemos stock si encontramos premio por nombre
    if (!confirm("¿Borrar este canje? (devolverá 1 stock si existe el premio)")) return;

    const prizeName = (mv.detail || "").replace("Canje — ", "").trim();
    const prize = state.prizes.find(p => p.name.trim().toLowerCase() === prizeName.toLowerCase());
    if (prize) prize.stock += 1;

    state.ledger = state.ledger.filter(x => x.id !== id);
    saveState();
});

document.getElementById("prizeFilterSeason").addEventListener("change", renderPrizes);
document.getElementById("redeemMember").addEventListener("change", renderPrizes);

/* ==========================
    RANKING
    ========================== */
function renderRanking() {
    const unit = document.getElementById("rankUnit").value;
    const totals = computeTotals();
    const rows = sortedRanking(unit);

    const tbody = document.getElementById("rankBody");
    tbody.innerHTML = "";
    rows.forEach((m, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
<td>${idx + 1}</td>
<td>${escapeHtml(m.name)}</td>
<td>${escapeHtml(m.unit || "—")}</td>
<td class="right">${m.earned}</td>
<td class="right">${m.redeemed}</td>
<td class="right"><b>${m.balance}</b></td>
<td class="right"><button class="btn small" data-detail="${m.id}">Ver</button></td>
`;
        tbody.appendChild(tr);
    });

    // units dropdown
    const unitSel = document.getElementById("rankUnit");
    const units = uniqueUnits();
    const current = unitSel.value || "all";
    unitSel.innerHTML = `<option value="all">Todas</option>` + units.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
    unitSel.value = units.includes(current) ? current : "all";
}

document.getElementById("rankUnit").addEventListener("change", renderRanking);
document.getElementById("rankBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const memberId = btn.dataset.detail;
    if (!memberId) return;

    const m = memberById(memberId);
    if (!m) return;
    const rows = state.ledger
        .filter(mv => mv.memberId === memberId)
        .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
        .slice(0, 25);

    const lines = rows.map(mv => `${mv.date} | ${mv.type} | ${mv.points} | ${mv.detail}`).join("\n");
    alert(`Últimos 25 movimientos de ${m.name}:\n\n${lines || "Sin movimientos"}`);
});

/* ==========================
    AJUSTES
    ========================== */
function renderConfig() {
    const p = state.config.points;
    document.getElementById("cfgBible").value = p.bible;
    document.getElementById("cfgScarf").value = p.scarf;
    document.getElementById("cfgPunctual").value = p.punctual;
    document.getElementById("cfgNotebook").value = p.notebook;
    document.getElementById("cfgInvested").value = p.investedFriend;
    document.getElementById("cfgEvent").value = p.eventParticipation;
    document.getElementById("cfgBlockRedeem").value = String(state.config.blockRedeemIfInsufficient);
    document.getElementById("cfgSeasonLabel").value = state.config.seasonLabel || "—";

    // sync defaults
    document.getElementById("eventPoints").value = p.eventParticipation;
    document.getElementById("invPoints").value = p.investedFriend;

    refreshMeetingPointsUI();
}

document.getElementById("btnSaveCfg").addEventListener("click", () => {
    const p = state.config.points;
    p.bible = safeInt(document.getElementById("cfgBible").value, p.bible);
    p.scarf = safeInt(document.getElementById("cfgScarf").value, p.scarf);
    p.punctual = safeInt(document.getElementById("cfgPunctual").value, p.punctual);
    p.notebook = safeInt(document.getElementById("cfgNotebook").value, p.notebook);
    p.investedFriend = safeInt(document.getElementById("cfgInvested").value, p.investedFriend);
    p.eventParticipation = safeInt(document.getElementById("cfgEvent").value, p.eventParticipation);
    state.config.blockRedeemIfInsufficient = document.getElementById("cfgBlockRedeem").value === "true";
    state.config.seasonLabel = (document.getElementById("cfgSeasonLabel").value || "").trim() || state.config.seasonLabel;

    saveState();
    alert("Ajustes guardados.");
});

/* ==========================
    EXPORT / IMPORT / RESET
    ========================== */
document.getElementById("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `puntajes_conquistadores_${state.config.seasonLabel || "temporada"}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById("btnImport").addEventListener("click", () => {
    document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const txt = await file.text();
        const obj = JSON.parse(txt);
        // validación básica
        if (!obj.config || !obj.members || !obj.ledger || !obj.prizes) throw new Error("Estructura inválida");
        state = obj;
        saveState();
        alert("Importación exitosa.");
    } catch (err) {
        alert("Error al importar: " + err.message);
    } finally {
        e.target.value = "";
    }
});

document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Esto borrará los datos locales y cargará demo. ¿Continuar?")) return;
    state = defaultState();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    renderAll();
});

/* ==========================
    RENDER ALL
    ========================== */
function renderAll() {
    // selects
    fillMemberSelect(document.getElementById("meetMember"));
    fillMemberSelect(document.getElementById("eventMember"));
    fillMemberSelect(document.getElementById("invMember"));
    fillMemberSelect(document.getElementById("adjMember"));
    fillMemberSelect(document.getElementById("redeemMember"));
    fillMemberSelect(document.getElementById("meetFilterMember"), true);
    fillMemberSelect(document.getElementById("eventFilterMember"), true);

    // default dates if empty
    if (!document.getElementById("meetDate").value) document.getElementById("meetDate").value = todayISO();
    if (!document.getElementById("eventDate").value) document.getElementById("eventDate").value = todayISO();
    if (!document.getElementById("invDate").value) document.getElementById("invDate").value = todayISO();
    if (!document.getElementById("adjDate").value) document.getElementById("adjDate").value = todayISO();

    // render sections
    renderConfig();
    renderDashboard();
    renderMembers();
    renderMeetings();
    renderEvents();
    renderInvested();
    renderAdjustments();
    renderPrizes();
    renderRedeems();
    renderRanking();
    renderHome();
}

renderAll();