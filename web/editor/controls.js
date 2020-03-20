class Toolpane extends UIComponent {
	constructor(editor) {
		super();
		this.editor = editor;

		this.element = null;
		this.inner_element = null;

		this.bar_tools = new Toolbar(this);
		this.bar_context = new Toolbar(this);

		this.t_select_rect = new ToolbarSelectRect(this.bar_tools);
		this.t_select_ellipse = new ToolbarSelectEllipse(this.bar_tools);
		this.t_select_flood = new ToolbarSelectFlood(this.bar_tools);
		this.t_select_brush = new ToolbarSelectBrush(this.bar_tools);
		this.t_about = new ToolbarAbout(this.bar_tools);
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["display"] = "inline-block";

		this.inner_element = document.createElement("div");
		this.inner_element.style["position"] = "sticky";
		this.inner_element.style["top"] = "8px";
		this.inner_element.style["display"] = "flex";
		this.inner_element.style["flex-flow"] = "column";
		this.inner_element.style["height"] = "calc(100vh - 28px)";
		this.element.appendChild(this.inner_element);

		this.inner_element.appendChild(this.bar_tools.construct_node());
		this.inner_element.appendChild(this.bar_context.construct_node());

		this.bar_tools.add_item(this.t_select_rect);
		this.bar_tools.add_item(this.t_select_ellipse);
		this.bar_tools.add_item(this.t_select_flood);
		this.bar_tools.add_item(this.t_select_brush);
		this.bar_tools.add_item(this.t_about);

		this.bar_tools.tools[0].activate();

		return this.element;
	}

	onload() {
		super.onload();
		this.bar_tools.onload();
		this.bar_context.onload();

		this.t_select_rect.onload();
		this.t_select_ellipse.onload();
		this.t_select_flood.onload();
		this.t_select_brush.onload();
		this.t_about.onload();
	}
}

class Toolbar extends UIComponent {
	constructor(toolpane) {
		super();
		this.toolpane = toolpane;

		this.element = null;

		this.tools = [];
		this.active_tool = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["flex-grow"] = 1;
		this.element.style["flex-flow"] = "column";

		return this.element;
	}

	add_item(item) {
		this.tools.push(item);
		this.element.appendChild(item.construct_node());
	}

	clear() {
		while(this.tools.length) {
			let item = this.tools.pop();
			this.element.removeChild(item.element);
		}
		this.active_tool = null;
	}
}

class ToolbarItem extends UIComponent {
	constructor(toolbar, icon) {
		super();

		this.toolbar = toolbar;
		this.toolpane = toolbar.toolpane;
		this.icon_src = icon;

		this.element = null;
		this.icon = null;

		this.onclick = this.onclick.bind(this);
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["margin"] = "5px";
		this.element.style["border"] = "1px solid black";
		this.element.style["border-radius"] = "5px";
		this.element.style["user-select"] = "none";
		this.element.style["cursor"] = "pointer";

		this.icon = document.createElement("img");
		this.icon.src = this.icon_src;
		this.icon.style["width"] = "25px";
		this.icon.style["height"] = "25px";
		this.icon.style["padding"] = "5px";
		this.element.appendChild(this.icon);

		this.element.addEventListener("click", this.onclick);

		return this.element;
	}

	onclick(ev) {
		this.assert_ready();
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
			let settings = this.toolpane.editor.selections.settings;
			settings.set("active_mode", this.mode);
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
			let settings = this.toolpane.editor.selections.settings;
			settings.set("active_tool", tool);
			let context_bar = this.toolpane.bar_context;
			let ctx_tools = [
				ToolbarSelectModeReplace,
				ToolbarSelectModeAdd,
				ToolbarSelectModeSubtract,
				ToolbarSelectModeIntersect
			].concat(ctx_extras);
			ctx_tools.forEach((ToolC) => {
				let ctx_tool = new ToolC(context_bar);
				ctx_tool.onload();
				context_bar.add_item(ctx_tool);
				if (settings.get("active_mode") == ctx_tool.mode) {
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

class ToolbarSlider extends UIComponent {
	constructor(toolbar, slidermin, slidermax, sliderstep) {
		super();

		this.toolbar = toolbar;
		this.settings = toolbar.toolpane.editor.selections.settings;

		this.slidermin = slidermin;
		this.slidermax = slidermax;
		this.sliderstep = sliderstep;

		this.element = null;
		this.slider = null;
		this.textdisp = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["margin"] = "5px";
		this.element.style["display"] = "flex";
		this.element.style["flex-flow"] = "column";
		this.element.style["height"] = "100px";
		this.element.style["white-space"] = "normal";
		
		this.slider = document.createElement("input");
		this.slider.type = "range";
		this.slider.min = this.slidermin;
		this.slider.max = this.slidermax;
		this.slider.step = this.sliderstep;
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

		return this.element;
	}

	get_value() {
		/* stub! */
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
		return this.settings.get("brush_radius");
	}
	set_value(value) {
		super.set_value(value);
		this.settings.set("brush_radius", value);
	}
}

class ToolbarFloodSlider extends ToolbarSlider {
	constructor(toolbar) {
		super(toolbar, 0, 1, 0.01);
	}
	get_value() {
		return this.settings.get("flood_threshold");
	}
	set_value(value) {
		super.set_value(value);
		this.settings.set("flood_threshold", value);
	}
}

ToolbarSelectRect = toolbar_selector_toolgen("selection_tool_rectangle.svg", SELECTION_TOOL.RECTANGLE);
ToolbarSelectEllipse = toolbar_selector_toolgen("selection_tool_ellipse.svg", SELECTION_TOOL.ELLIPSE);
ToolbarSelectFlood = toolbar_selector_toolgen("selection_tool_flood.svg", SELECTION_TOOL.FLOOD, [ToolbarFloodSlider]);
ToolbarSelectBrush = toolbar_selector_toolgen("selection_tool_brush.svg", SELECTION_TOOL.BRUSH, [ToolbarBrushSlider]);


class ToolbarAbout extends ToolbarItem {
	constructor(toolbar) {
		super(toolbar, get_resource("about.svg"));
	}

	onclick(ev) {
		let parent_elem = this.toolbar.toolpane.editor.element;
		let about_modal = new AboutModal(this.toolbar, parent_elem);
		about_modal.construct_node();
		ev.stopPropagation();
	}
}

class LayerMenu extends UIComponent {
	constructor(selections) {
		super();
		this.selections = selections;

		this.element = null;
		this.add_button = null;
		this.active_layer = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["display"] = "flex";
		this.element.style["flex-flow"] = "column";
		this.element.style["border"] = "2px solid black";
		this.element.style["padding"] = "5px";
		this.element.style["margin"] = "5px";
		this.element.style["height"] = "max-content";

		this.add_button = document.createElement("div");
		this.add_button.style["margin"] = "4px";
		this.add_button.style["width"] = "100px";
		this.add_button.style["border"] = "1px solid black";
		this.add_button.style["cursor"] = "pointer";
		this.add_button.style["text-align"] = "center";
		this.element.appendChild(this.add_button);

		let img = document.createElement("img");
		img.src = get_resource("plus.svg");
		img.style["width"] = "10px";
		img.style["height"] = "10px";
		img.style["margin"] = "4px";
		this.add_button.appendChild(img);

		this.add_button.addEventListener("mousedown", (ev) => {
			ev.stopPropagation();
			let layer = this.selections.add_layer();
			let entry = new LayerMenuEntry(this, layer);
			this.add_layer(entry);
			entry.onload();
		});

		return this.element;
	}

	onload() {
		super.onload();
		this.selections.selection_layers.forEach((v, k, m) => {
			let entry = new LayerMenuEntry(this, v);

			this.add_layer(entry);
			entry.onload();
		});
	}

	add_layer(layer_entry) {
		this.assert_ready();
		this.element.insertBefore(layer_entry.construct_node(), this.add_button);
		this.change_active_layer(layer_entry);
	}

	change_active_layer(layer_entry) {
		if (this.active_layer !== null) {
			this.active_layer.deactivate();
		}
		this.active_layer = layer_entry;
		this.active_layer.activate();
	}
}

class LayerMenuEntry extends UIComponent {
	constructor(layer_menu, selection_layer) {
		super();

		this.layer_menu = layer_menu;
		this.selections = layer_menu.selections;
		this.selection_layer = selection_layer;

		this.element = null;
		this.name_box = null;
		this.del_button = null;
	}

	construct_node() {
		super.construct_node();

		this.element = document.createElement("div");
		this.element.style["display"] = "flex";
		this.element.style["flex-flow"] = "row";
		this.element.style["align-items"] = "center";
		this.element.style["width"] = "100px";
		this.element.style["border"] = "1px solid black";
		this.element.style["margin"] = "4px";
		this.element.style["cursor"] = "pointer";

		this.name_box = document.createElement("p");
		this.name_box.innerHTML = this.selection_layer.id;
		this.name_box.style["margin"] = "4px";
		this.element.appendChild(this.name_box);

		let spacer = document.createElement("div");
		spacer.style["flex-grow"] = 1;
		this.element.appendChild(spacer);

		this.del_button = document.createElement("img");
		this.del_button.src = get_resource("x.svg");
		this.del_button.style["width"] = "10px";
		this.del_button.style["height"] = "10px";
		this.del_button.style["margin"] = "4px";
		this.element.appendChild(this.del_button);

		this.element.addEventListener("mousedown", (ev) => {
			ev.stopPropagation();
			this.selections.change_active_layer(this.selection_layer.id);
			this.layer_menu.change_active_layer(this);
		});

		return this.element;
	}

	activate() {
		this.element.style["background-color"] = new RGBA(160, 160, 239, 90).toString();
	}

	deactivate() {
		this.element.style["background-color"] = new RGBA(255, 255, 255, 255).toString();
	}
}

const ABOUT = [
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/freepik\" title=\"Freepik\">Freepik</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\">www.flaticon.com</a>",
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/those-icons\" title=\"Those Icons\">Those Icons</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\">www.flaticon.com</a>",
	"Icons made by <a target=\"blank\" href=\"https://www.flaticon.com/authors/pixel-perfect\" title=\"Pixel perfect\">Pixel perfect</a> from <a target=\"blank\" href=\"https://www.flaticon.com/\" title=\"Flaticon\"> www.flaticon.com</a>"
];

class AboutModal extends ToolbarAbout {
	constructor(toolbar, parent_elem) {
		super(toolbar);
		this.parent_elem = parent_elem;
	}

	construct_node() {
		super.construct_node();

		let modal = document.createElement("div");
		modal.style["position"] = "absolute";
		modal.style["left"] = "0px";
		modal.style["top"] = "0px";
		modal.style["height"] = "100%";
		modal.style["width"] = "100%";
		modal.style["background-color"] = "#000000BB";

		let about_elem = document.createElement("div");
		about_elem.style["position"] = "absolute";
		about_elem.style["left"] = "50%";
		about_elem.style["top"] = "100px";
		about_elem.style["transform"] = "translate(-50%, 0)";
		about_elem.style["width"] = "fit-content";
		about_elem.style["max-width"] = "80%";
		about_elem.style["padding"] = "40px";
		about_elem.style["border-radius"] = "20px";
		about_elem.style["white-space"] = "normal";
		about_elem.style["background-color"] = "#EEEEEE";
		modal.appendChild(about_elem);

		for (let ii=0; ii<ABOUT.length; ii++) {
			let p = document.createElement("p");
			p.innerHTML = ABOUT[ii];
			about_elem.appendChild(p);
		}

		modal.addEventListener("mousedown", (ev) => {
			this.parent_elem.removeChild(modal);
			ev.stopPropagation();
		});

		about_elem.addEventListener("mousedown", (ev) => {
			ev.stopPropagation();
		});

		this.parent_elem.appendChild(modal);
	}
}
