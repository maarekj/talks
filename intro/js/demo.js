// Live demo slides

class Demo {
	constructor(slide) {
		this.slide = slide;
		this.isolated = this.slide.classList.contains("isolated");
		this.element = this.sourceElement = $("[data-edit]", this.slide) || this.slide;

		this.edit = this.sourceElement.getAttribute("data-edit");
		this.sourceStyles = $$("style[data-slide]", this.slide);
		this.html = this.css = "";
		this.editors = {};

		if (this.isolated) {
			this.iframe = $.create("iframe", {
				name: "iframe-" + slide.id,
				inside: this.slide
			});

			this.loaded = new Promise (r => this.iframe.addEventListener("load", r, {once:true}));
		}

		this.editorContainer = $.create({
			className: "editor-container",
			inside: this.slide
		});

		var editHTML = this.edit.match(/\b(html|contents)\b/);

		if (editHTML) {
			// HTML editor
			if (editHTML[0] == "html") {
				this.sourceElement.removeAttribute("data-edit");

				this.element = this.sourceElement = $.create("div", {
					around: this.sourceElement,
					"data-edit": this.edit.replace("html", "contents")
				});
			}

			this.html = this.element.innerHTML;

			this.editors.contents = Demo.createEditor(slide, "contents", {
				lang: "html",
				fromSource: () => Demo.fixCode(this.element.innerHTML, "html"),
				toSource: () => {
					var value = this.html = this.editors.contents.value;

					if (this.isolated) {
						this.iframe.contentDocument.body.innerHTML = value;
					}
					else {
						this.element.innerHTML = value;
					}

				},
				container: this.editorContainer
			});

			if (this.isolated) {
				this.element.remove();
			}
		}

		if (this.edit.indexOf("css") > -1) {
			this.style = $("style[data-slide]", slide) || $.create("style", {
				"data-slide": "",
				inside: slide
			});

			this.editors.css = Demo.createEditor(slide, "css", {
				fromSource: () => Demo.fixCode(this.style.textContent),
				toSource: () => {
					this.css[0] = this.style.textContent = this.editors.css.value;

					if (!this.isolated) {
						if (!this.style.sheet) {
							// Stupid Chrome bug
							this.style.textContent = this.style.textContent + "/**/";
						}

						if (this.style.sheet) {
							let scope = this.style.getAttribute("data-scope") || `#${slide.id}`;

							for (let rule of this.style.sheet.cssRules) {
								scopeRule(rule, this.slide, scope);
							}
						}
						else {
							console.log("FAIL on", this.slide.id, this.style.outerHTML, this.style.media);
						}
					}
				},
				container: this.editorContainer
			});

			this.css = $$("style[data-slide]", slide).map(s => {
				if (this.isolated) {
					s.remove();
				}

				return s.textContent;
			});
		}

		this.slide.addEventListener("slidechange", evt => {
			for (let id in this.editors) {
				this.editors[id].textarea.dispatchEvent(new InputEvent("input"));
			}
		});

		if (this.isolated) {
			this.iframe.srcdoc = Demo.getHTMLPage(this.html, this.css, this.slide.title || "Demo");

			this.iframe.onload = () => {
				this.style = $("style#live", this.iframe.contentDocument);
			};

			// Open in new Tab button
			if (this.editors.contents) {
				var a = $.create("a", {
					className: "button new-tab",
					textContent: "Open in new Tab",
					inside: slide,
					target: "_blank",
					events: {
						click: evt => {
							var title = slide.title || slide.dataset.title || "Demo";

							a.href = createURL(Demo.getHTMLPage(this.html, this.css, title));
						}
					}
				});
			}
		}

		var editorKeys = Object.keys(this.editors);

		if (editorKeys.length > 1) {
			// More than 1 editors, need the ability to toggle
			editorKeys.forEach((id, i) => {
				var editor = this.editors[id];

				var label = $.create("label", {
					htmlFor: editor.textarea.id,
					inside: editor.wrapper,
					textContent: editor.textarea.dataset.lang,
					tabIndex: "0",
					onclick: evt => this.openEditor(id)
				});

				editor.textarea.addEventListener("focus", evt => this.openEditor(id));

				if (i == 0) {
					this.openEditor(id);
				}
			});
		}

		// Next button
		$.create("a", {
			className: "button next",
			textContent: "Next ▸",
			inside: slide,
			events: {
				click: evt => slideshow.nextItem()
			}
		});
	}

	openEditor(id) {
		for (let i in this.editors) {
			this.editors[i].wrapper.classList.toggle("collapsed", i !== id);
		}

		resizeTextarea(this.editors[id].textarea);
	}

	static fixCode(code, lang) {
		code = Prism.plugins.NormalizeWhitespace.normalize(code);

		if (lang == "html") {
			code = code.replace(/=""(?=\s|>)/g, "");
		}

		return code;
	}

	static createEditor(slide, label, o = {}) {
		var lang = o.lang || label;

		var textarea = $.create("textarea", {
			id: `${slide.id}-${label}-editor`,
			className: `language-${lang} editor`,
			"data-lang": lang,
			inside: o.container || slide,
			value: o.fromSource(),
			events: {
				input: o.toSource
			}
		});

		return new Prism.Live(textarea);
	}

	static getHTMLPage(html, css="", title="Demo") {
		if (Array.isArray(css)) {
			css = css.join("</style><style>");
		}

		if (css) {
			css = `<style id=live>${css}</style>`;
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">
<title>${title}</title>
<style>
body {
font-size: 200%;
}

input, select, textarea, button {
font: inherit;
}
</style>
${css}
</head>
<body>
${html}
</body>
</html>`;
	}
}

(function() {
	document.addEventListener("keydown", evt => {
		var code = evt.keyCode;

		if ((evt.metaKey || evt.ctrlKey) && [48, 187, 189].includes(code)) {
			var editor = evt.target.closest("div.editor");

			if (editor) {
				evt.preventDefault();

				if (code == 48) {
					var multiplier = 1;
				}
				else {
					var multiplier = +getComputedStyle(editor).getPropertyValue("--font-size-multiplier") || 1;
					multiplier *= code == 189? .9 : 10/9;
				}

				editor.style.setProperty("--font-size-multiplier", multiplier);

				resizeTextarea(editor);
			}
		}
	});

	$.events(document.documentElement, "slidechange input", resizeTextarea);
	window.addEventListener("load", evt => {
		requestAnimationFrame(() => resizeTextarea(slideshow.currentSlide));
	});

})();

function resizeTextarea(textarea) {
	textarea = textarea.target || textarea;

	if (textarea.nodeName != "TEXTAREA") {
		textarea = $("textarea.editor", textarea);
	}

	if (textarea && textarea.matches(".demo.slide.horizontal div.editor > textarea.editor")) {
		textarea.style.height = "0";
		textarea.parentNode.style.fontSize = "";

		textarea.style.height = textarea.scrollHeight + 16 + "px";

		var cs = getComputedStyle(textarea);

		// if (cs.height == cs.maxHeight) {
		// 	var ratio = Math.min(2, textarea.scrollHeight/textarea.offsetHeight) - 1;
		// 	textarea.parentNode.style.fontSize = 100 - Math.round(50 * ratio) + "%";
		// }
	}
};