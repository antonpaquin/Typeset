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

class SelectionSet {
	constructor(editor) {
		this.editor = editor;

		this.selection_layers = [];
		this.active_layer = null;

		this.active_tool = SELECTION_TOOL.RECTANGLE;
		this.active_mode = SELECTION_MODE.REPLACE;

		this.brush_radius = 5;
		this.flood_threshold = 0.08;
	}

	add_layer() {
		let layer = new SelectionLayer(this);
		this.selection_layers.push(layer);
		this.active_layer = layer;
	}

	async change_active_layer(idx) {
		this.active_layer = this.selection_layers[idx];
	}
}

class SelectionLayer {
	constructor(selection_set) {
		this.selection_set = selection_set;
		this.editor_canvas = selection_set.editor.canvas;
		this.pending_selector = null;
		this.mask = null;
		this.merge_screen = null;

		this.selector_stack = [];
		this.redo_stack = [];

		this.undo = this.undo.bind(this);
		this.redo = this.redo.bind(this);
		this.get_selector = this.get_selector.bind(this);
		this.finish_selection = this.finish_selection.bind(this);
		this.merge_mask = this.merge_mask.bind(this);
		this.combine_mask = this.combine_mask.bind(this);
		this.draw_mask = this.draw_mask.bind(this);
	}

	async undo() {
		if (this.selector_stack.length == 0) {
			return;
		}
		this.redo_stack.push(this.selector_stack.pop());
		await this.combine_mask();
		await this.draw_mask();
	}

	async redo() {
		if (this.redo_stack.length == 0) {
			return;
		}
		let selector = this.redo_stack.pop();
		this.selector_stack.push(selector);
		await this.merge_mask(selector);
		await this.draw_mask();
	}

	async get_selector(xpos, ypos) {
		let SelectorClass = this.selection_set.active_tool;
		this.pending_selector = new SelectorClass(this.editor_canvas, this.selection_set.active_mode, this);
		await this.pending_selector.start_pending(xpos, ypos);
		return this.pending_selector;
	}

	async finish_selection() {
		this.redo_stack = [];
		this.selector_stack.push(this.pending_selector);
		if (this.merge_screen === null) {
			this.merge_screen = await this.editor_canvas.create_screen();
			await this.combine_mask();
		} else {
			await this.merge_mask(this.pending_selector);
		}
		await this.draw_mask();
	}

	async merge_mask(selector) {
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

	async combine_mask() {
		/* Start with a clean mask, initialized to 0, 
		 * cloned from the first layer we'll work with
		 */
		this.mask = empty_mask(this.editor_canvas.width, this.editor_canvas.height);
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
			await this.merge_mask(this.selector_stack[idx]);
			idx++;
		}
	}

	async draw_mask() {
		await this.merge_screen.clear();
		let ctx = this.merge_screen.ctx;
		let img_data = mask_to_imgdata(ctx, this.mask, SELECTION_COLOR.MASK, this.editor_canvas.width, this.editor_canvas.height);
		ctx.putImageData(img_data, 0, 0);
	}
}

class SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		this.editor_canvas = editor_canvas;
		this.selection_mode = selection_mode; 
		this.selection_layer = selection_layer;
		
		this.screen = null;
		this.ctx = null;
		this.width = null;
		this.height = null;

		this.mask = null;

		this.finalize = this.finalize.bind(this);
	}

	async start_pending(xpos, ypos) {
		this.screen = await this.editor_canvas.create_screen();
		this.ctx = this.screen.ctx;
		this.width = this.screen.element.width;
		this.height = this.screen.element.height;
		this.ctx.fillStyle = SELECTION_COLOR.SELECTED.toString();
		this.screen.set_opacity(0.35);
	}

	async update_pending(xpos, ypos) {
		/* stub */
	}

	async finalize() {
		/* Remove the element from the canvas, and replace 
		 * the pending selection with a solid mask 
		 */
		await this.screen.remove();

		let img_data = this.ctx.getImageData(0, 0, this.width, this.height);
		this.mask = imgdata_to_mask(img_data);
		await this.selection_layer.finish_selection();
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

	async start_pending(xpos, ypos) {
		await super.start_pending(xpos, ypos);
		this.x1 = xpos;
		this.y1 = ypos;
	}

	async update_pending(xpos, ypos) {
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
	async start_pending(xpos, ypos) {
		super.start_pending(xpos, ypos);
		this.x1 = xpos;
		this.y1 = ypos;
	}

	async update_pending(xpos, ypos) {
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
		this.width = null;
		this.height = null;
	}

	async start_pending(xpos, ypos) {
		await super.start_pending(xpos, ypos);
		if (xpos < 0 || ypos < 0) {
			return;
		}
		this.screen.set_opacity(0);
		let img_ctx = this.editor_canvas.screens[0].ctx;
		let img_data = img_ctx.getImageData(0, 0, this.width, this.height);
		let dest = this.ctx.createImageData(this.width, this.height);

		let source_pixel = this.pixel_at(img_data.data, xpos, ypos);
		let threshold = 1 + (this.selection_layer.selection_set.flood_threshold * 255 * Math.sqrt(3))|0; // 3 diminsions

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

	async update_pending(xpos, ypos) {
	}
}

class SelectionBrush extends SelectionTool {
	constructor(editor_canvas, selection_mode, selection_layer) {
		super(editor_canvas, selection_mode, selection_layer);
		this.radius = null;
	}

	async start_pending(xpos, ypos) {
		await super.start_pending(xpos, ypos);
		this.radius = this.selection_layer.selection_set.brush_radius;
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

	async update_pending(xpos, ypos) {
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

function imgdata_to_mask(img_data) {
	/* Dense bitwise format for storing image masks
	 *
	 * Besides just being memory-efficient, this makes
	 * combining layers with bitwise ops possible, which
	 * is really nice
	 */
	let mask = {
		data: [],
		length: img_data.data.length,
		width: img_data.width,
		height: img_data.height
	};
	let cur = 0;
	let nbits = 0;
	for (let ii=0; ii<img_data.data.length; ii+=4) {
		if (img_data.data[ii+3] >= 128) {
			cur |= 1;
		}
		nbits++;
		if (nbits === 32) {
			mask.data.push(cur);
			cur = 0;
			nbits = 0;
		} else {
			cur <<= 1;
		}
	}
	if (nbits != 0) {
		cur <<= (32 - nbits);
		mask.data.push(cur);
	}
	return mask;
}

function mask_to_imgdata(ctx, mask, color, width, height) {
	img_data = ctx.createImageData(width, height);
	for (let ii=0; ii<mask.length; ii++) {
		if (mask.data[(ii/32)|0] & (1 << (31 - (ii % 32)))) {
			img_data.data[(4*ii)+0] = color.red;
			img_data.data[(4*ii)+1] = color.green;
			img_data.data[(4*ii)+2] = color.blue;
			img_data.data[(4*ii)+3] = color.alpha;
		} else {
			img_data.data[(4*ii)+0] = 0;
			img_data.data[(4*ii)+1] = 0;
			img_data.data[(4*ii)+2] = 0;
			img_data.data[(4*ii)+3] = 0;
		}
	}
	return img_data;
}

function empty_mask(width, height) {
	return {
		data: Array(Math.ceil(width * height / 32)).fill(0),
		length: width * height
	};
}

function merge_masks(m1, m2, fn) {
	let out = {
		data: [],
		length: m1.length
	};
	for (let ii=0; ii<m1.data.length; ii++) {
		out.data.push(fn(m1.data[ii], m2.data[ii]));
	}
	return out;
}
