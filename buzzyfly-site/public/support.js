(function () {
	var box = document.getElementById("chat"), form = document.getElementById("chat-form"), input = document.getElementById("chat-q");
	if (!box || !form) return;
	var history = [];
	function add(role, text) {
		var p = document.createElement("p");
		p.className = role === "user" ? "chat-user" : "chat-bot";
		p.textContent = (role === "user" ? "You: " : "Help: ") + text;
		box.appendChild(p);
		box.scrollTop = box.scrollHeight;
	}
	form.addEventListener("submit", function (e) {
		e.preventDefault();
		var q = input.value.trim();
		if (!q) return;
		input.value = "";
		add("user", q);
		history.push({ role: "user", content: q });
		var btn = form.querySelector("button");
		btn.disabled = true;
		fetch("/api/support/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }) })
			.then(function (r) { return r.json(); })
			.then(function (d) { var a = d.reply || "Please open a ticket below."; add("assistant", a); history.push({ role: "assistant", content: a }); })
			.catch(function () { add("assistant", "I couldn't connect. Please open a ticket below."); })
			.then(function () { btn.disabled = false; input.focus(); });
	});
})();
