(function () {
	"use strict";
	var root = document.getElementById("app");
	if (!root) return;
	var tier = root.dataset.tier || "free";
	var paid = tier !== "free";
	var FREE_EXAMS = +root.dataset.freeExams || 1;
	var FREE_CARDS = +root.dataset.freeCards || 20;
	var KEY = "bf-study-v1";
	var DAY = 86400000;
	var BOXES = [0, 1, 2, 4, 8]; // Leitner intervals in days

	// ---------- storage ----------
	function load() {
		try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.exams)) return s; } catch (e) {}
		return { exams: [], view: "today", current: null };
	}
	var state = load();
	function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

	// ---------- dates ----------
	function iso(d) { var x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
	function today() { return iso(Date.now()); }
	function addDays(isoDate, n) { return iso(new Date(isoDate + "T12:00:00").getTime() + n * DAY); }
	function daysBetween(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / DAY); }
	function nice(isoDate) { return new Date(isoDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

	// ---------- plan builder ----------
	// Learn each topic once across the first ~65% of the days, review it 1, 3
	// and 7 days later, and keep the final days for mixed review.
	function buildPlan(exam) {
		var start = exam.start || today();
		var span = Math.max(1, daysBetween(start, exam.date));
		var topics = exam.topics.length ? exam.topics : ["Your notes"];
		var learnDays = Math.max(1, Math.min(span, Math.ceil(span * 0.65)));
		var days = {};
		function push(d, text) { if (daysBetween(d, exam.date) > 0) (days[d] = days[d] || []).push(text); }
		topics.forEach(function (t, i) {
			var d = addDays(start, Math.floor((i * learnDays) / topics.length));
			push(d, "Learn: " + t);
			[1, 3, 7].forEach(function (gap) { push(addDays(d, gap), "Review: " + t); });
		});
		var finalDays = Math.max(1, Math.min(3, span - learnDays));
		for (var k = finalDays; k >= 1; k--) push(addDays(exam.date, -k), k === 1 ? "Light review + flashcards. Sleep early." : "Mixed practice: all topics, test conditions");
		return Object.keys(days).sort().map(function (d) { return { date: d, items: days[d] }; });
	}

	// ---------- tiny DOM helper ----------
	function h(tag, attrs, kids) {
		var el = document.createElement(tag);
		for (var k in attrs || {}) {
			if (k === "on") for (var ev in attrs.on) el.addEventListener(ev, attrs.on[ev]);
			else if (k === "text") el.textContent = attrs[k];
			else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
		}
		(kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
		return el;
	}

	function upsell(reason) {
		return h("div", { class: "upsell" }, [
			h("p", {}, [h("strong", { text: reason })]),
			h("p", { class: "muted", text: "The full version unlocks unlimited exams and flashcards for a one-time $19. Everything you've made stays." }),
			h("a", { class: "btn primary", href: "/#pricing", text: "Unlock the full app – $19" }),
		]);
	}

	function currentExam() {
		return state.exams.find(function (e) { return e.id === state.current; }) || state.exams[0] || null;
	}

	// ---------- views ----------
	function render() {
		root.textContent = "";
		var exam = currentExam();
		if (!state.exams.length) state.view = "new";
		var tabs = h("div", { class: "tabs no-print", role: "group", "aria-label": "Views" }, [
			tab("today", "Today"), tab("plan", "Full plan"), tab("cards", "Flashcards"), tab("new", "+ Add exam"),
		]);
		root.appendChild(h("div", { class: "row no-print" }, [
			h("h1", { text: paid ? "Your study planner" : "Your study planner (free)" }),
		]));
		if (state.exams.length > 1) {
			var sel = h("select", { "aria-label": "Choose exam", on: { change: function (e) { state.current = e.target.value; save(); render(); } } },
				state.exams.map(function (e) { return h("option", { value: e.id, selected: exam && e.id === exam.id, text: e.name + " – " + nice(e.date) }); }));
			root.appendChild(h("div", { class: "no-print", style: "margin-bottom:12px" }, [sel]));
		}
		root.appendChild(tabs);
		var v = state.view;
		if (v === "new" || !exam) root.appendChild(newExamView());
		else if (v === "plan") root.appendChild(planView(exam, false));
		else if (v === "cards") root.appendChild(cardsView(exam));
		else root.appendChild(planView(exam, true));
		if (tier === "classroom" || tier === "team") root.appendChild(h("p", { class: "note", text: (tier === "team" ? "Business" : "Classroom") + " licence active." }));
		root.appendChild(h("p", { class: "note no-print" }, [
			"Missing something? ", h("a", { href: "/survey", text: "Tell us what you need" }), " · ", h("a", { href: "/support", text: "Get help" }),
		]));
	}

	function tab(id, label) {
		return h("button", { class: "btn small", type: "button", "aria-pressed": String(state.view === id),
			on: { click: function () { state.view = id; save(); render(); } } }, [label]);
	}

	function newExamView() {
		var wrap = h("div", { class: "card" });
		if (!paid && state.exams.length >= FREE_EXAMS) {
			wrap.appendChild(upsell("The free version holds " + FREE_EXAMS + " exam. Add every subject with the full app."));
			return wrap;
		}
		var name = h("input", { id: "ex-name", required: true, maxlength: 80, placeholder: "Biology final" });
		var date = h("input", { id: "ex-date", type: "date", required: true, min: addDays(today(), 1), value: addDays(today(), 14) });
		var mins = h("input", { id: "ex-min", type: "number", min: 10, max: 600, value: 45 });
		var topics = h("textarea", { id: "ex-topics", placeholder: "Cells\nGenetics\nEvolution\nEcology" });
		var err = h("p", { role: "alert", class: "note" });
		var form = h("form", { class: "form", on: { submit: function (e) {
			e.preventDefault();
			var list = topics.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 200);
			if (!name.value.trim() || !date.value) { err.textContent = "Add a name and a date."; return; }
			if (daysBetween(today(), date.value) < 1) { err.textContent = "Pick a date after today."; return; }
			var ex = { id: "e" + Date.now(), name: name.value.trim(), date: date.value, start: today(), minutes: +mins.value || 45, topics: list, done: {}, cards: [] };
			state.exams.push(ex); state.current = ex.id; state.view = "today"; save(); render();
		} } }, [
			h("h2", { text: "Add an exam" }),
			h("label", { for: "ex-name", text: "Exam name" }), name,
			h("div", { class: "row" }, [
				h("div", {}, [h("label", { for: "ex-date", text: "Exam date" }), date]),
				h("div", {}, [h("label", { for: "ex-min", text: "Minutes a day" }), mins]),
			]),
			h("label", { for: "ex-topics", text: "Topics (one per line)" }), topics,
			err,
			h("button", { class: "btn primary", type: "submit", text: "Build my plan" }),
		]);
		wrap.appendChild(form);
		return wrap;
	}

	// Days in a row (ending today, or yesterday if today isn't started) with at least one session ticked.
	function streak() {
		var days = {};
		state.exams.forEach(function (e) { Object.keys(e.done).forEach(function (k) { days[k.split("|")[0]] = 1; }); });
		var d = today(), n = 0;
		if (!days[d]) d = addDays(d, -1);
		while (days[d]) { n++; d = addDays(d, -1); }
		return n;
	}

	function planView(exam, onlyToday) {
		var plan = buildPlan(exam);
		var t = today();
		var left = daysBetween(t, exam.date);
		var total = 0, done = 0;
		plan.forEach(function (d) { d.items.forEach(function (it) { total++; if (exam.done[d.date + "|" + it]) done++; }); });
		var box = h("div", { class: "card" }, [
			h("h2", { text: exam.name }),
			h("p", { class: "muted", text: (left > 0 ? left + " day" + (left === 1 ? "" : "s") + " to go" : left === 0 ? "Exam day. You've got this." : "Exam date has passed") + " · " + exam.minutes + " min a day · " + done + " of " + total + " sessions done" }),
			h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": done }, [h("span", { style: "width:" + (total ? Math.round((done / total) * 100) : 0) + "%" })]),
		]);
		var st = streak();
		if (onlyToday) box.appendChild(h("p", { class: "streak", text: st ? "🔥 " + st + "-day study streak. Keep it going today." : "Tick one session today to start a streak." }));
		var days = onlyToday ? plan.filter(function (d) { return d.date === t || (d.date < t && d.items.some(function (it) { return !exam.done[d.date + "|" + it]; })); }) : plan;
		var openToday = days.some(function (d) { return d.items.some(function (it) { return !exam.done[d.date + "|" + it]; }); });
		if (onlyToday && !openToday) box.appendChild(h("p", { text: "Nothing left for today. Drill a few flashcards or rest." }));
		if (onlyToday && days.length > 1) box.appendChild(h("p", { class: "note", text: "Includes sessions you missed on earlier days." }));
		days.forEach(function (d) {
			var per = Math.max(5, Math.round(exam.minutes / d.items.length));
			box.appendChild(h("div", { class: "day" + (d.date === t ? " today" : "") }, [h("h4", { text: (d.date === t ? "Today · " : "") + nice(d.date) })].concat(
				d.items.map(function (it, i) {
					var k = d.date + "|" + it, id = "c" + d.date + i;
					return h("label", { class: "item" + (exam.done[k] ? " done" : ""), for: id }, [
						h("input", { type: "checkbox", id: id, checked: !!exam.done[k], on: { change: function (e) { if (e.target.checked) exam.done[k] = 1; else delete exam.done[k]; save(); render(); } } }),
						h("span", { text: it + " (" + per + " min)" }),
					]);
				}))));
		});
		box.appendChild(h("div", { class: "ctas no-print" }, [
			!onlyToday ? h("button", { class: "btn small", type: "button", text: "Print plan", on: { click: function () { window.print(); } } }) : null,
			h("button", { class: "btn small", type: "button", text: "Delete this exam", on: { click: function () {
				if (!confirm("Delete " + exam.name + " and its flashcards?")) return;
				state.exams = state.exams.filter(function (e) { return e.id !== exam.id; }); state.current = null; save(); render();
			} } }),
		]));
		if (!paid) box.appendChild(upsell("Studying for more than one exam?"));
		return box;
	}

	function cardsView(exam) {
		var box = h("div", { class: "card" }, [h("h2", { text: "Flashcards · " + exam.name })]);
		var now = Date.now();
		var due = exam.cards.filter(function (c) { return (c.due || 0) <= now; });
		var allCards = state.exams.reduce(function (n, e) { return n + e.cards.length; }, 0);
		box.appendChild(h("p", { class: "muted", text: exam.cards.length + " cards · " + due.length + " due now" }));
		if (due.length) {
			var c = due.sort(function (a, b) { return a.box - b.box; })[0];
			var shown = false;
			var face = h("div", { class: "card flash", "aria-live": "polite", text: c.q });
			var controls = h("div", { class: "ctas" });
			function grade(ok) { c.box = ok ? Math.min(BOXES.length - 1, c.box + 1) : 0; c.due = Date.now() + BOXES[c.box] * DAY; save(); render(); }
			var reveal = h("button", { class: "btn primary", type: "button", text: "Show answer", on: { click: function () {
				if (shown) return; shown = true; face.textContent = c.a; controls.textContent = "";
				controls.appendChild(h("button", { class: "btn primary", type: "button", text: "Got it", on: { click: function () { grade(true); } } }));
				controls.appendChild(h("button", { class: "btn", type: "button", text: "Again", on: { click: function () { grade(false); } } }));
			} } });
			controls.appendChild(reveal);
			box.appendChild(face); box.appendChild(controls);
		} else if (exam.cards.length) {
			box.appendChild(h("p", { text: "All caught up. Cards you got right come back in a few days." }));
		}
		if (!paid && allCards >= FREE_CARDS) { box.appendChild(upsell("The free version holds " + FREE_CARDS + " flashcards.")); return box; }
		var q = h("input", { id: "fq", maxlength: 300, required: true, placeholder: "What does mitochondria do?" });
		var a = h("textarea", { id: "fa", maxlength: 1000, required: true, placeholder: "Makes energy (ATP) for the cell" });
		box.appendChild(h("form", { class: "form", on: { submit: function (e) {
			e.preventDefault(); if (!q.value.trim() || !a.value.trim()) return;
			exam.cards.push({ q: q.value.trim(), a: a.value.trim(), box: 0, due: 0 }); save(); render();
			var f = document.getElementById("fq"); if (f) f.focus();
		} } }, [h("h3", { text: "Add a card" }), h("label", { for: "fq", text: "Question" }), q, h("label", { for: "fa", text: "Answer" }), a, h("button", { class: "btn", type: "submit", text: "Add card" })]));
		return box;
	}

	render();
})();
