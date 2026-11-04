document.querySelectorAll("[data-copy]").forEach(function (b) {
	b.addEventListener("click", function () {
		var t = document.getElementById(b.dataset.copy).textContent;
		var label = b.textContent;
		if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () {
			b.textContent = "Copied";
			setTimeout(function () { b.textContent = label; }, 2000);
		}, function () {});
	});
});
