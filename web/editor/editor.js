class EditorCanvasScreen {
	constructor(editor_canvas) {
		this.editor_canvas = editor_canvas;
		this.element = document.createElement("canvas");
		this.element.style["position"] = "absolute";
		this.element.style["top"] = "0px";
		this.element.style["left"] = "0px";
		this.element.width = editor_canvas.width;
		this.element.height = editor_canvas.height;


		this.ctx = this.element.getContext("2d");

		this.clear = this.clear.bind(this);
		this.destroy = this.destroy.bind(this);
		this.remove = this.remove.bind(this);
	}

	set_opacity(opacity) {
		this.element.style["opacity"] = opacity;
	}

	async clear() {
		this.ctx.clearRect(0, 0, this.element.width, this.element.height);
	}

	async remove() {
		this.editor_canvas.element.removeChild(this.element);
	}

	async destroy() {
		this.editor_canvas.element.removeChild(this.element);
		this.element = null;
		this.ctx = null;
	}
}

class EditorCanvas {
	constructor(editor) {
		this.editor = editor;
		this.element = document.createElement("div");
		this.element.style["display"] = "inline-block";
		this.element.style["position"] = "relative";

		/* An EditorCanvas screen is actually just a thin
		 * wrapper around a canvas.
		 * The "Layers" that a user sees will probably
		 * be managed at a higher level than these.
		 */
		this.screens = [];

		this.width = null;
		this.height = null;
		
		this.create_screen = this.create_screen.bind(this);
		this.load = this.load.bind(this);
	}

	async create_screen() {
		let screen = new EditorCanvasScreen(this);
		this.screens.push(screen);
		this.element.appendChild(screen.element);
		return screen;
	}

	async load(image_format, image_base64) {
		/* image_format: 'png', for example */
		let img = new Image(0, 0);
		let load_complete = new Promise((resolve) => {
			img.onload = () => {
				this.width = img.naturalWidth;
				this.height = img.naturalHeight;
				this.element.style["width"] = this.width;
				this.element.style["height"] = this.height;
				resolve(null);
			};
		});
		img.src = "data:image/" + image_format + ";base64, " + image_base64;
		await load_complete;
		let base_screen = await this.create_screen();
		base_screen.ctx.drawImage(img, 0, 0);
	};

	async reset() {
		for (let ii=0; ii<this.screens.length; ii++) {
			await this.screens[ii].destroy();
		}
		this.screens = [];
	}
}

class Editor {
	constructor(editor_id) {
		this.element = document.getElementById(editor_id);
		this.element.style["white-space"] = "nowrap";
		this.element.style["position"] = "relative";
		this.element.style["display"] = "flex";
		this.element.className = "Editor";

		this.canvas = new EditorCanvas(this);
		this.selections = new SelectionSet(this);
		this.toolbar = new Toolpane(this);
		this.user_input = new EditorUserInput(this);

		this.element.appendChild(this.toolbar.element);
		this.element.appendChild(this.canvas.element);

		this.reset = this.reset.bind(this);
		this.load = this.load.bind(this);
	}

	async reset() {
		await this.canvas.clear();
		this.canvas.width = null;
		this.canvas.height = null;
	}

	async load(image_format, image_b64) {
		await this.canvas.load(image_format, image_b64);
	}
}

function get_resource(name) {
	return "editor/resources/" + name;
}
