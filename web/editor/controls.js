class Toolpane {
	constructor(editor) {
		this.editor = editor;

		this.element = document.createElement("div");
		this.element.style["display"] = "inline-block";

		this.inner_element = document.createElement("div");
		this.inner_element.style["position"] = "sticky";
		this.inner_element.style["top"] = "8px";
		this.inner_element.style["display"] = "flex";
		this.inner_element.style["flex-flow"] = "column";
		this.inner_element.style["height"] = "calc(100vh - 28px)";
		this.element.appendChild(this.inner_element);

		this.bar_tools = new Toolbar(this);
		this.bar_context = new Toolbar(this);

		this.inner_element.appendChild(this.bar_tools.element);
		this.inner_element.appendChild(this.bar_context.element);

		this.bar_tools.add_item(new ToolbarSelectRect(this.bar_tools));
		this.bar_tools.add_item(new ToolbarSelectEllipse(this.bar_tools));
		this.bar_tools.add_item(new ToolbarSelectFlood(this.bar_tools));
		this.bar_tools.add_item(new ToolbarSelectBrush(this.bar_tools));
		this.bar_tools.add_item(new ToolbarAbout(this.bar_tools));
		this.bar_tools.tools[0].activate();
	}
}

class Toolbar {
	constructor(toolpane) {
		this.toolpane = toolpane;

		this.element = document.createElement("div");
		this.element.style["flex-grow"] = 1;
		this.element.style["flex-flow"] = "column";

		this.tools = [];
		this.active_tool = null;
	}

	add_item(item) {
		this.tools.push(item);
		this.element.appendChild(item.element);
	}

	clear() {
		while(this.tools.length) {
			let item = this.tools.pop();
			this.element.removeChild(item.element);
		}
		this.active_tool = null;
	}
}

class ToolbarItem {
	constructor(toolbar, icon) {
		this.toolbar = toolbar;
		this.toolpane = toolbar.toolpane;

		this.element = document.createElement("div");
		this.element.style["margin"] = "5px";
		this.element.style["border"] = "1px solid black";
		this.element.style["border-radius"] = "5px";
		this.element.style["user-select"] = "none";

		this.icon = document.createElement("img");
		this.icon.src = icon;
		this.icon.style["width"] = "25px";
		this.icon.style["height"] = "25px";
		this.icon.style["padding"] = "5px";
		this.element.appendChild(this.icon);

		this.onclick = this.onclick.bind(this);
		this.activate = this.activate.bind(this);

		this.element.addEventListener("click", this.onclick);
	}

	onclick(ev) {
		this.activate();
		ev.stopPropagation();
	}

	activate() {
		if (this.toolbar.active_tool != null) {
			this.toolbar.active_tool.deactivate(this);
		}
		this.toolbar.active_tool = this;
		this.element.style["background"] = "#00000088";
	}

	deactivate(next) {
		this.element.style["background"] = "#00000000";
	}
}

function toolbar_selector_modegen(icon, mode) {
	class T extends ToolbarItem {
		constructor(toolbar) {
			super(toolbar, get_resource(icon));
			this.mode = mode;
		}

		activate() {
			super.activate();
			let selections = this.toolpane.editor.selections;
			selections.active_mode = this.mode;
		}
	}
	return T;
}

ToolbarSelectModeReplace = toolbar_selector_modegen("selection_mode_replace.svg", SELECTION_MODE.REPLACE);
ToolbarSelectModeAdd = toolbar_selector_modegen("selection_mode_add.svg", SELECTION_MODE.ADD);
ToolbarSelectModeSubtract = toolbar_selector_modegen("selection_mode_subtract.svg", SELECTION_MODE.SUBTRACT);
ToolbarSelectModeIntersect = toolbar_selector_modegen("selection_mode_intersect.svg", SELECTION_MODE.INTERSECT);

function toolbar_selector_toolgen(icon, tool, ctx_extras) {
	if (ctx_extras == undefined) {
		ctx_extras = [];
	}
	class C extends ToolbarItem {
		constructor(toolbar) {
			super(toolbar, get_resource(icon));
		}
		activate() {
			super.activate();
			let selections = this.toolpane.editor.selections;
			selections.active_tool = tool;
			let context_bar = this.toolpane.bar_context;
			let ctx_tools = [
				ToolbarSelectModeReplace,
				ToolbarSelectModeAdd,
				ToolbarSelectModeSubtract,
				ToolbarSelectModeIntersect
			].concat(ctx_extras);
			ctx_tools.forEach((ToolC) => {
				let ctx_tool = new ToolC(context_bar);
				context_bar.add_item(ctx_tool);
				if (selections.active_mode == ctx_tool.mode) {
					ctx_tool.activate();
				}
			});
		}
		deactivate(next) {
			super.deactivate(next);
			let context_bar = this.toolpane.bar_context;
			context_bar.clear();
		}
	}
	return C;
}

class ToolbarSlider{
	constructor(toolbar, slidermin, slidermax, sliderstep) {
		this.toolbar = toolbar;
		this.selections = toolbar.toolpane.editor.selections;

		this.element = document.createElement("div");
		this.element.style["margin"] = "5px";
		this.element.style["display"] = "flex";
		this.element.style["flex-flow"] = "column";
		this.element.style["height"] = "100px";
		this.element.style["white-space"] = "normal";
		
		this.slider = document.createElement("input");
		this.slider.type = "range";
		this.slider.min = slidermin;
		this.slider.max = slidermax;
		this.slider.step = sliderstep;
		this.slider.style["width"] = "25px";
		this.slider.style["margin"] = "5px";
		this.slider.style["padding"] = "0px";
		this.slider.style["flex-grow"] = "1";
		this.slider.style["overflow"] = "hidden";
		this.slider.style["-webkit-appearance"] = "slider-vertical";
		this.slider.setAttribute("orient", "vertical");
		this.slider.value = this.get_value();
		this.element.appendChild(this.slider);

		this.textdisp = document.createElement("input");
		this.textdisp.type = "number";
		this.textdisp.style["width"] = "25px";
		this.textdisp.style["margin"] = "5px";
		this.textdisp.style["font-size"] = "10px";
		this.textdisp.style["text-align"] = "center";
		this.textdisp.style["border"] = "1px solid black";
		this.textdisp.style["border-radius"] = "3px";
		this.textdisp.value = this.get_value();
		this.element.appendChild(this.textdisp);

		this.slider.addEventListener("input", (ev) => {
			this.set_value(this.slider.value);
		});

		this.textdisp.addEventListener("input", (ev) => {
			this.set_value(this.textdisp.value);
		});
	}

	get_value() {
	}

	set_value(value) {
		this.textdisp.value = value;
		this.slider.value = value;
	}
}

class ToolbarBrushSlider extends ToolbarSlider {
	constructor(toolbar) {
		super(toolbar, 1, 100, 1);
	}
	get_value() {
		return this.selections.brush_radius;
	}
	set_value(value) {
		super.set_value(value);
		this.selections.brush_radius = value;
	}
}

class ToolbarFloodSlider extends ToolbarSlider {
	constructor(toolbar) {
		super(toolbar, 0, 1, 0.01);
	}
	get_value() {
		return this.selections.flood_threshold;
	}
	set_value(value) {
		super.set_value(value);
		this.selections.flood_threshold = value;
	}
}

ToolbarSelectRect = toolbar_selector_toolgen("selection_tool_rectangle.svg", SELECTION_TOOL.RECTANGLE);
ToolbarSelectEllipse = toolbar_selector_toolgen("selection_tool_ellipse.svg", SELECTION_TOOL.ELLIPSE);
ToolbarSelectFlood = toolbar_selector_toolgen("selection_tool_flood.svg", SELECTION_TOOL.FLOOD, [ToolbarFloodSlider]);
ToolbarSelectBrush = toolbar_selector_toolgen("selection_tool_brush.svg", SELECTION_TOOL.BRUSH, [ToolbarBrushSlider]);

const ABOUT = [
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/freepik\" title=\"Freepik\">Freepik</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\">www.flaticon.com</a>",
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/those-icons\" title=\"Those Icons\">Those Icons</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\">www.flaticon.com</a>",
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/pixel-perfect\" title=\"Pixel perfect\">Pixel perfect</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\"> www.flaticon.com</a>"
];

class ToolbarAbout extends ToolbarItem {
	constructor(toolbar) {
		super(toolbar, get_resource("about.svg"));
	}

	onclick(ev) {
		let parentElem = this.toolbar.toolpane.editor.element;

		let aboutModal = document.createElement("div");
		aboutModal.style["position"] = "absolute";
		aboutModal.style["left"] = "0px";
		aboutModal.style["top"] = "0px";
		aboutModal.style["height"] = "100%";
		aboutModal.style["width"] = "100%";
		aboutModal.style["background-color"] = "#000000BB";
		parentElem.appendChild(aboutModal);

		let aboutElem = document.createElement("div");
		aboutElem.style["position"] = "absolute";
		aboutElem.style["left"] = "50%";
		aboutElem.style["top"] = "100px";
		aboutElem.style["transform"] = "translate(-50%, 0)";
		aboutElem.style["width"] = "fit-content";
		aboutElem.style["max-width"] = "80%";
		aboutElem.style["padding"] = "40px";
		aboutElem.style["border-radius"] = "20px";
		aboutElem.style["white-space"] = "normal";
		aboutElem.style["background-color"] = "#EEEEEE";
		aboutModal.appendChild(aboutElem);

		for (let ii=0; ii<ABOUT.length; ii++) {
			let p = document.createElement("p");
			p.innerHTML = ABOUT[ii];
			aboutElem.appendChild(p);
		}
		aboutModal.addEventListener("mousedown", function(ev) {
			parentElem.removeChild(aboutModal);
			ev.stopPropagation();
		});
		aboutElem.addEventListener("mousedown", function(ev) {
			ev.stopPropagation();
		});
		ev.stopPropagation();
	}
}

class LayerMenu {
	constructor() {
	}
}
