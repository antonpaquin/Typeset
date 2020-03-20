function get_resource(name) {
	return "editor/resources/" + name;
}

class UIComponent {
	constructor() {
		this.uicomponent_ready = false;
	}

	construct_node() {
	}

	onload() {
		this.uicomponent_ready = true;
	}

	assert_ready() {
		if (!this.uicomponent_ready) {
			throw "Not ready!";
		}
	}
}


function editor_load_module(callback) {
	/* todo par the download but serialize the eval */
	let src_files = [
		"editor/pixelmask.js",
		"editor/editor.js",
		"editor/selection.js",
		"editor/controls.js",
		"editor/userinput.js",
		"lib/opentype.js",
		"editor/typeset.js"
	];

	let load_src = (src) => {
		console.log(src);
		let script = document.createElement("script");
		script.onload = function() {
			if (src_files.length == 0) {
				callback();
			} else {
				load_src(src_files.shift());
			}
		};
		script.src = src;
		document.head.appendChild(script);
	};

	load_src(src_files.shift());
}
