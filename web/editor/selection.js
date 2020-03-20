/* General strategy: 
 *
 * We've (possibly) got a "pending" selection which is the selection
 * of the tool the user is currently working with,
 *
 * And a list of "finalized" selections which combine together to
 * form the selection layer
 *
 * (It's a list so that "undo" has a stack to work off of)
 * (Does this need to be turned into a global tool stack a la gimp?)
 * (Probably not yet)
 *
 * There may be many selection layers per image, at most one should
 * be actively editing at any time
 *
 * The idea is that each selection layer corresponds to a text box
 */

const SELECTION_MODE = {
	REPLACE: "selection_mode_replace",
	ADD: "selection_mode_add",
	SUBTRACT: "selection_mode_subtract",
	INTERSECT: "selection_mode_intersect"
};

class RGBA {
	constructor(r, g, b, a) {
		this.red = r;
		this.green = g;
		this.blue = b;
		this.alpha = a;
	}

	toString() {
		return "#" + [this.red, this.green, this.blue, this.alpha].map(
			(x) => x.toString(16).padStart(2, '0')
		).join('');
	}
}

const SELECTION_COLOR = {
	SELECTED: new RGBA(160, 160, 239, 255),
	INACTIVE: new RGBA(160, 239, 160, 90),
	MASK: new RGBA(160, 160, 239, 90)
};

class SelectionSet extends UIComponent {
	constructor(canvas) {
		super();
		this.canvas = canvas;

		this.selection_layers = new Map();
		this.id_counter = 1;
		this.active_layer = null;

		this.settings = new Map();
		this.settings.set("active_tool", SELECTION_TOOL.RECTANGLE);
		this.settings.set("active_mode", SELECTION_MODE.REPLACE);
		this.settings.set("brush_radius", 5);
		this.settings.set("flood_threshold", 0.08);
	}

	onload() {
		super.onload();
		this.add_layer();
	}

	add_layer() {
		this.assert_ready();

		let id = this.id_counter;
		this.id_counter += 1;

		let layer = new SelectionLayer(this.canvas, this.settings, id);
		layer.onload();

		this.selection_layers.set(id, layer);
		this.change_active_layer(id);

		return layer;
	}

	change_active_layer(id) {
		this.assert_ready();

		if (this.active_layer !== null) {
			this.active_layer.deactivate();
			this.active_layer.draw_mask();
		} 

		this.active_layer = this.selection_layers.get(id);
		this.active_layer.activate();
		this.active_layer.draw_mask();
	}
}

class SelectionLayer extends UIComponent {
	constructor(editor_canvas, settings, id) {
		super();

		this.ec = editor_canvas;
		this.settings = settings;
		this.id = id;

		this.mask = null;
		this.merge_screen = null;
		this.pending_selector = null;

		this.draw_color = SELECTION_COLOR.MASK;

		this.selector_stack = [];
		this.redo_stack = [];
	}

	onload() {
		super.onload();
		this.mask = empty_mask(this.ec.width, this.ec.height);
		this.merge_screen = this.ec.create_screen();
	}

	activate() {
		this.draw_color = SELECTION_COLOR.MASK;
	}

	deactivate() {
		this.draw_color = SELECTION_COLOR.INACTIVE;
	}

	undo() {
		this.assert_ready();
		if (this.selector_stack.length == 0) {
			return;
		}
		this.redo_stack.push(this.selector_stack.pop());
		this.combine_mask();
		this.draw_mask();
	}

	redo() {
		this.assert_ready();
		if (this.redo_stack.length == 0) {
			return;
		}
		let selector = this.redo_stack.pop();
		this.selector_stack.push(selector);
		this.merge_mask(selector);
		this.draw_mask();
	}

	get_selector(xpos, ypos) {
		this.assert_ready();

		if (this.pending_selector !== null) {
			throw "Starting new selection while another is active!";
		}

		let SelectorClass = this.settings.get("active_tool");
		this.pending_selector = new SelectorClass(this.ec, this.settings.get("active_mode"), this);
		this.pending_selector.onload();
		this.pending_selector.start_pending(xpos, ypos);
		return this.pending_selector;
	}

	finish_selection() {
		this.assert_ready();

		if (this.pending_selector === null) {
			throw "Finishing a selector that does not exist!";
		}
		this.redo_stack = [];
		this.selector_stack.push(this.pending_selector);
		this.merge_mask(this.pending_selector);
		this.draw_mask();

		this.pending_selector = null;
	}

	merge_mask(selector) {
		/* Add a new selector's mask to the current selection mask */
		this.assert_ready();

		let merge_fn = null;
		switch(selector.selection_mode) {
			case SELECTION_MODE.REPLACE:
				merge_fn = (a, b) => b; break;
			case SELECTION_MODE.ADD:
				merge_fn = (a, b) => a | b; break;
			case SELECTION_MODE.SUBTRACT:
				merge_fn = (a, b) => a & (~b); break;
			case SELECTION_MODE.INTERSECT:
				merge_fn = (a, b) => a & b; break;
		}
		this.mask = merge_masks(this.mask, selector.mask, merge_fn);
	}

	combine_mask() {
		/* Rebuild the current selection mask from scratch */
		this.assert_ready();
		/* Start with a clean mask, initialized to 0 */
		this.mask = empty_mask(this.ec.width, this.ec.height);
		if (this.selector_stack.length == 0) {
			return;
		}

		let idx = this.selector_stack.length - 1;
		/* Go back to the latest REPLACE mode selection --
		 * anything earlier has no effect on the result
		 */ 
		while(idx > 0) {
			let selector = this.selector_stack[idx];
			if(selector.selection_mode == SELECTION_MODE.REPLACE) {
				break;
			}
			idx--;
		}
		while(idx < this.selector_stack.length) {
			this.merge_mask(this.selector_stack[idx]);
			idx++;
		}
	}

	draw_mask() {
		/* Turn the mask into an image and draw it to the screen */
		this.assert_ready();
		this.merge_screen.clear();
		let ctx = this.merge_screen.ctx;
		let img_data = mask_to_imgdata(ctx, this.mask, this.draw_color);
		ctx.putImageData(img_data, 0, 0);
	}
}

class SelectionTool extends UIComponent {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super();
		this.ec = editor_canvas;
		this.selection_mode = selection_mode; 
		this.selection_layer = selection_layer;
		
		this.screen = null;
		this.ctx = null;
		this.width = null;
		this.height = null;

		this.mask = null;
	}

	start_pending(xpos, ypos) {
		this.screen = this.ec.create_screen();
		this.width = this.ec.width;
		this.height = this.ec.height;

		this.ctx = this.screen.ctx;
		this.ctx.fillStyle = SELECTION_COLOR.SELECTED.toString();
		this.screen.set_opacity(0.35);
	}

	update_pending(xpos, ypos) {
		/* stub */
	}

	finalize() {
		/* Remove the element from the canvas, and replace 
		 * the pending selection with a dense mask 
		 */
		this.screen.remove();

		let img_data = this.ctx.getImageData(0, 0, this.width, this.height);
		this.mask = imgdata_to_mask(img_data);
		this.selection_layer.finish_selection();
		this.screen = null;
		this.ctx = null;
	}
}

class SelectionRectangle extends SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super(editor_canvas, selection_mode, selection_layer);
		this.x1 = 0;
		this.y1 = 0;
		this.x2 = 0;
		this.y2 = 0;
	}

	start_pending(xpos, ypos) {
		super.start_pending(xpos, ypos);
		this.x1 = xpos;
		this.y1 = ypos;
	}

	update_pending(xpos, ypos) {
		this.x2 = xpos;
		this.y2 = ypos;
		this.ctx.clearRect(0, 0, this.width, this.height);
		this.ctx.fillRect(this.x1, this.y1, this.x2 - this.x1, this.y2 - this.y1);
	}
}

class SelectionEllipse extends SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super(editor_canvas, selection_mode, selection_layer);
		this.x1 = null;
		this.y1 = null;
		this.x2 = null;
		this.y2 = null;
	}
	start_pending(xpos, ypos) {
		super.start_pending(xpos, ypos);
		this.x1 = xpos;
		this.y1 = ypos;
	}

	update_pending(xpos, ypos) {
		this.x2 = xpos;
		this.y2 = ypos;

		let cx = ((this.x1 + this.x2) / 2)|0;
		let cy = ((this.y1 + this.y2) / 2)|0;
		let rx = Math.abs(this.x2 - cx);
		let ry = Math.abs(this.y2 - cy);
		
		this.ctx.clearRect(0, 0, this.width, this.height);
		this.ctx.beginPath();
		this.ctx.ellipse(cx, cy, rx, ry, 0, 0, 2*Math.PI);
		this.ctx.fill();
	}
}

class RGBPix {
	constructor(r, g, b, x, y) {
		this.red = r;
		this.green = g;
		this.blue = b;
		this.x = x;
		this.y = y;
	}
}

class SelectionFlood extends SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super(editor_canvas, selection_mode, selection_layer);
		this.settings = selection_layer.settings;
		this.width = null;
		this.height = null;
	}

	start_pending(xpos, ypos) {
		super.start_pending(xpos, ypos);
		if (xpos < 0 || ypos < 0) {
			return;
		}
		this.screen.set_opacity(0);
		let img_ctx = this.ec.image_screen.ctx;
		let img_data = img_ctx.getImageData(0, 0, this.width, this.height);
		let dest = this.ctx.createImageData(this.width, this.height);

		let source_pixel = this.pixel_at(img_data.data, xpos, ypos);
		let threshold = 1 + (this.settings.get("flood_threshold") * 255 * Math.sqrt(3))|0; // 3 diminsions

		/* DFS */
		let seen = Array(img_data.length).fill(false);
		let stack = [source_pixel];

		while (stack.length) {
			let pix = stack.pop();
			if (seen[pix.y * this.width + pix.x]) {
				continue;
			}
			seen[pix.y * this.width + pix.x] = true;
			if (this.distance(source_pixel, pix) >= threshold) {
				continue;
			} 
			dest.data[((pix.y * this.width) + pix.x) * 4 + 3] = 255;
			if (pix.x > 0) {
				stack.push(this.pixel_at(img_data.data, pix.x - 1, pix.y));
			}
			if (pix.y > 0) {
				stack.push(this.pixel_at(img_data.data, pix.x, pix.y - 1));
			}
			if (pix.x < this.width - 1) {
				stack.push(this.pixel_at(img_data.data, pix.x + 1, pix.y));
			}
			if (pix.y < this.height - 1) {
				stack.push(this.pixel_at(img_data.data, pix.x, pix.y + 1));
			}
		}

		this.ctx.putImageData(dest, 0, 0);
	}

	pixel_at(img_data, xpos, ypos) {
		let idx = ((ypos * this.width) + xpos) * 4;
		return new RGBPix(img_data[idx + 0], img_data[idx + 1], img_data[idx + 2], xpos, ypos);
	}

	draw_pixel(dest, xpos, ypos) {
		let idx = ((ypos * this.width) + xpos) * 4;
		dest[idx + 3] = 255;
	}

	distance(p1, p2) {
		let dr = p1.red - p2.red;
		let dg = p1.green - p2.green;
		let db = p1.blue - p2.blue;
		return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
	}

	update_pending(xpos, ypos) {
	}
}

class SelectionBrush extends SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super(editor_canvas, selection_mode, selection_layer);
		this.settings = selection_layer.settings;
		this.radius = null;
	}

	start_pending(xpos, ypos) {
		super.start_pending(xpos, ypos);
		this.radius = this.settings.get("brush_radius");
		this.ctx.lineWidth = this.radius * 2;
		this.ctx.strokeStyle = SELECTION_COLOR.SELECTED.toString();
		this.ctx.lineJoin = "round";

		/* draw a circle at the starting point, to cover the
		 * initial click
		 */
		this.ctx.beginPath();
		this.ctx.ellipse(xpos, ypos, this.radius, this.radius, 0, 0, 2*Math.PI);
		this.ctx.fill();

		this.ctx.beginPath();
		this.ctx.moveTo(xpos, ypos);
	}

	update_pending(xpos, ypos) {
		this.ctx.lineTo(xpos, ypos);
		this.ctx.stroke();
		this.ctx.beginPath();
		this.ctx.ellipse(xpos, ypos, this.radius, this.radius, 0, 0, 2*Math.PI);
		this.ctx.fill();
		this.ctx.beginPath();
		this.ctx.moveTo(xpos, ypos);
	}
}

const SELECTION_TOOL = {
	RECTANGLE: SelectionRectangle,
	ELLIPSE: SelectionEllipse,
	FLOOD: SelectionFlood,
	BRUSH: SelectionBrush
};
