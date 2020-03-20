const INPUT_MODE = {
	NORMAL: "input_mode_normal",
	PERFORM_SELECTION: "input_mode_perform_selection"
};

class EditorUserInput {
	constructor(editor) {
		this.editor = editor;
		this.current_mode = INPUT_MODE.NORMAL;

		this.selector = null;

		this.mouse_down = this.mouse_down.bind(this);
		this.mouse_move = this.mouse_move.bind(this);
		this.mouse_up = this.mouse_up.bind(this);

		this.listen_element = null;
	}

	onload() {
		this.listen_element = this.editor.element;

		this.listen_element.addEventListener("mousedown", this.mouse_down);
		this.listen_element.addEventListener("mousemove", this.mouse_move);
		this.listen_element.addEventListener("mouseup", this.mouse_up);
	}

	canvas_mouse_offset(canvas, ev) {
		let rect = canvas.getBoundingClientRect();
		return {
			x: (ev.clientX - rect.left)|0,
			y: (ev.clientY - rect.top)|0
		};
	}

	mouse_down(ev) {
		if (this.current_mode == INPUT_MODE.NORMAL) {
			/* TODO some voodoo involving user controls */
			/* this is a selector action? */
			let elem = this.editor.canvas.screens[0].element;
			let mpos = this.canvas_mouse_offset(elem, ev);

			if (mpos.x > 0 && mpos.y > 0) {
				console.log(mpos.x, mpos.y);
				this.selector = this.editor.selections.active_layer.get_selector(mpos.x, mpos.y);
				this.current_mode = INPUT_MODE.PERFORM_SELECTION;
			}

		}
	}

	mouse_move(ev) {
		if (this.current_mode == INPUT_MODE.NORMAL) {
		} else if (this.current_mode == INPUT_MODE.PERFORM_SELECTION) {
			let elem = this.editor.canvas.screens[0].element;
			let mpos = this.canvas_mouse_offset(elem, ev);

			this.selector.update_pending(mpos.x, mpos.y);
		}
	}

	mouse_up(ev) {
		if (this.current_mode == INPUT_MODE.NORMAL) {
		} else if (this.current_mode == INPUT_MODE.PERFORM_SELECTION) {
			this.selector.finalize();
			this.selector = null;
			this.current_mode = INPUT_MODE.NORMAL;
		}
	}
}
