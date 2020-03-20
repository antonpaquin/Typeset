class Editor extends UIComponent {
	constructor(editor_id) {
		super();

		this.editor_id = editor_id;

		this.element = null;

		this.canvas = new EditorCanvas();
		this.selections = new SelectionSet(this.canvas);
		this.toolbar = new Toolpane(this);
		this.layer_menu = new LayerMenu(this.selections);
		this.user_input = new EditorUserInput(this);

		this.construct_node();
	}

	construct_node() {
		super.construct_node();

		this.element = document.getElementById(this.editor_id);
		this.element.style["white-space"] = "nowrap";
		this.element.style["position"] = "relative";
		this.element.style["display"] = "flex";
		this.element.style["height"] = "100%";
		this.element.className = "Editor";

		this.element.appendChild(this.toolbar.construct_node());
		this.element.appendChild(this.canvas.construct_node());
		this.element.appendChild(this.layer_menu.construct_node());

		return this.element;
	}

	onload() {
		this.canvas.onload();
		this.selections.onload();
		this.toolbar.onload();
		this.layer_menu.onload();
		this.user_input.onload();
		super.onload();
	}

	load(image_format, image_base64) {
		/* image_format: 'png', for example */
		let img = new Image(0, 0);
		img.onload = () => {
			this.canvas.load(img);
			this.onload();
		};
		img.src = "data:image/" + image_format + ";base64, " + image_base64;
	};

	reset() {
		this.assert_ready();
		this.canvas.clear();
		this.canvas.width = null;
		this.canvas.height = null;
	}
}

class EditorCanvas extends UIComponent {
	constructor() {
		super();

		this.element = null;
		this.screens = [];
		this.image_screen = null;

		this.width = null;
		this.height = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["display"] = "inline-block";
		this.element.style["position"] = "relative";
		this.element.style["flex-grow"] = 1;
		this.element.style["overflow"] = "scroll";

		return this.element;
	}

	load(img) {
		this.width = img.naturalWidth;
		this.height = img.naturalHeight;

		this.image_screen = this.create_screen();
		this.image_screen.ctx.drawImage(img, 0, 0);
	}

	create_screen() {
		let screen = new EditorCanvasScreen(this);
		this.screens.push(screen);
		this.element.appendChild(screen.construct_node());
		screen.onload();
		return screen;
	}

	remove_screen(screen) {
		this.element.removeChild(screen.element);
	}

	reset() {
		for (let ii=0; ii<this.screens.length; ii++) {
			this.screens[ii].destroy();
		}
		this.screens = [];
	}
}

class EditorCanvasScreen extends UIComponent {
	constructor(editor_canvas) {
		super();
		this.editor_canvas = editor_canvas;

		this.ctx = null;
		this.element = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("canvas");
		this.element.style["position"] = "absolute";
		this.element.style["top"] = "0px";
		this.element.style["left"] = "0px";

		return this.element;
	}

	onload() {
		super.onload();
		this.element.width = this.editor_canvas.width;
		this.element.height = this.editor_canvas.height;
		this.ctx = this.element.getContext("2d");
	}

	set_opacity(opacity) {
		this.assert_ready();
		this.element.style["opacity"] = opacity;
	}

	clear() {
		this.assert_ready();
		this.ctx.clearRect(0, 0, this.element.width, this.element.height);
	}

	remove() {
		this.assert_ready();
		this.editor_canvas.remove_screen(this);
	}

	destroy() {
		this.assert_ready();
		this.remove();
		// Maybe I also need to remove it from ec.screens?
		this.element = null;
		this.ctx = null;
	}
}
