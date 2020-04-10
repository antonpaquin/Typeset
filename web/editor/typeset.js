/* 
 * Typesetting algorithm -- notes 
 *
 * find the blob
 * 	Probably set of pixels that are not within some 
 * 	range (n=10? user set?) of an unmasked pixel
 *
 * calculate the median (mean?) x, y of the blob
 * is that point outside the blob?
 * 	abort -- some kind of weird concave shape
 * 
 *
 * try method 1:
 * 	compute line limit of blob 
 * 		== (max y - min y) / line height
 * 	compute possible split points
 * 		1st iteration: ' ' char
 * 		2nd iteration: ' ' or '-'
 * 		3rd iteration: maybe try to break up long words?
 * 	for nlines 1..n
 * 		for each line:
 * 			line #x has y in range ymin, ymax
 * 			compute line width bounds for each line
 * 				== intersection x over all pixel rows from ymin to ymax
 * 			compute center-justified width limit
 * 				== 2 * min distance of x bound to center x line
 * 		compute all possible splits of the text into nlines lines
 * 		evaluate each by criteria:
 * 			any line exceeds center-justified limit?
 * 				reject
 * 			calculate average distance beneath cjl
 * 			sum abs distance to that average
 * 			lowest score wins
 * 		any split accepted?
 * 			return best split
 * 		otherwise, continue to next nlines
 *
 * failed? retry, but allow splits on '-'
 * failed? retry, but reduce blob margin
 *
 *
 * try method 2:
 * 	find the first yrow that has space for at least 1 word
 * 	place words until out of space
 * 	repeat until finished
 *
 * abort, auto typeset failed
 */

function typeset(editor, mask, text, font, fontsize, line_gap) {
	let reduced_mask = mask_margin(mask, 10);
	let pcenter = mask_mean(mask);
	console.log("Start typeset!");

	if (!mask_pix_at(reduced_mask, pcenter.x, pcenter.y)) {
		console.log("Abort typeset, concave");
		return null; // abort -- some kind of weird concave shape
	};

	let font_height_pt = (font.ascender - font.descender) / font.unitsPerEm;
	let line_height = Math.round(line_gap + (fontsize * font_height_pt), 1);

	let place_lines = pick_split(font, fontsize, reduced_mask, text, line_height, pcenter);
	if (place_lines !== null) {
		let screen = editor.canvas.create_screen();
		for (let ii=0; ii<place_lines.split.length; ii++) {
			let line = place_lines.split[ii];
			let path = font.getPath(line, 0, 0, fontsize);
			let bbox = path.getBoundingBox();
			let base_x = Math.round(pcenter.x - ((bbox.x2 - bbox.x1) / 2), 1);
			let base_y = place_lines.line_info[ii].line_base;
			font.draw(screen.ctx, line, base_x, base_y, fontsize);
		}
	} else {
		console.log("Giving up!");
	}
}

function pick_split(font, fontsize, mask, text, line_height, pcenter) {
	let bbox = mask_bbox(mask);
	let ydelta = bbox.ymax - bbox.ymin;

	let split_positions = get_split_positions(text);

	let line_limit = (ydelta / line_height)|0;

	for (let nlines = 1; nlines <= line_limit; nlines++) {
		if (nlines > (split_positions.length + 1)) {
			return null; // abort -- will never fit
		}
		let line_info = typeset_line_info(mask, bbox, nlines, line_height, pcenter);
		if (line_info == null) {
			continue;
		}
		let splits_iter = get_splits(text, split_positions, nlines - 1);

		let best_score = null;
		let best_split = null;
		let line_split = splits_iter.next();

		while (line_split !== null) {
			let score = score_typeset(font, fontsize, line_info, pcenter, line_split);
			if (score !== null) {
				if (best_score === null || score < best_score) {
					best_split = line_split;
					best_score = score;
				}
			}
			line_split = splits_iter.next();
		}

		if (best_split !== null) {
			return {
				split: best_split,
				line_info: line_info,
			};
		}
	}
	return null;
}

function typeset_line_info(mask, bbox, nlines, line_height, pcenter) {
	let line_info = [];
	for (let ii=0; ii<nlines; ii++) {
		let line_base = Math.round(pcenter.y - (line_height * nlines / 2) + ((ii + 1) * line_height), 1);
		let xbounds = line_xbounds(mask, bbox, line_base - line_height, line_base);
		if (xbounds == null) {
			return null;
		}
		// center-justified width limit
		let cjwl = 2 * Math.min(pcenter.x - xbounds.left, xbounds.right - pcenter.x);
		if (cjwl < 0) {
			return null;
		}
		line_info.push({
			line_base: line_base,
			xbounds: xbounds,
			cjwl: cjwl,
		});
	}
	return line_info;
}

function score_typeset(font, fontsize, line_info, pcenter, lines) {
	let margin = [];
	for (let ii=0; ii<lines.length; ii++) {
		let path = font.getPath(lines[ii], 0, 0, fontsize);
		let bbox = path.getBoundingBox();
		let path_width = bbox.x2 - bbox.x1;
		if (path_width > line_info[ii].cjwl) {
			return null;
		}
		margin.push(line_info[ii].cjwl - path_width);
	}

	let sum_margin = margin.reduce((x, y) => x + y);
	let mean_margin = sum_margin / lines.length;
	let sum_delta_margin = margin.map((x) => Math.abs(x - mean_margin)).reduce((x, y) => x + y);

	return sum_delta_margin;
}

function get_split_positions(text) {
	let res = [];
	for (let ii=0; ii<text.length; ii++) {
		if (text[ii] == ' ') {
			res.push(ii);
		}
	}
	return res;
}

function get_splits(text, split_positions, nsplits) {
	return {
		c_iter: combinatoric_iter(split_positions.length, nsplits),
		next: function() {
			let idx = this.c_iter.next();
			if (idx === null) {
				return null;
			} 

			let res = [];
			let acc = 0;
			for (let ii=0; ii<idx.length; ii++) {
				let split = split_positions[idx[ii]];
				res.push(text.substring(acc, split));
				acc = split + 1;
			}
			res.push(text.substring(acc));
			return res;
		}
	};
}

function line_xbounds(mask, bbox, ymin, ymax) {
	// ymin inclusive, ymax exclusive
	let lbound = null;
	// Sweep from left to right, and return the x of the first column where 
	// all y in [ymin, ymax) are in the mask
	for (let ii=bbox.xmin; ii<bbox.xmax; ii++) {
		let all_y = true;
		for (let jj=ymin; jj<ymax; jj++) {
			if (!mask_pix_at(mask, ii, jj)) {
				all_y = false;
				break;
			}
		}
		if (all_y) {
			lbound = ii;
			break;
		}
	}
	if (lbound === null) {
		return null;
	}

	let rbound = null;
	// Same, in reverse for rbound
	for (let ii=bbox.xmax-1; ii>=bbox.xmin; ii--) {
		let all_y = true;
		for (let jj=ymin; jj<ymax; jj++) {
			if (!mask_pix_at(mask, ii, jj)) {
				all_y = false;
				break;
			}
		}
		if (all_y) {
			rbound = ii;
			break;
		}
	}

	// If an lbound exists (not null), then an rbound surely also exists
	return {
		left: lbound,
		right: rbound,
	};
}

function combinatoric_iter(n, m) {
	if (m > n) {
		return null;
	}
	let state_base = [];
	for (let ii=0; ii<m; ii++) {
		state_base.push(ii);
	}
	return {
		state: state_base,
		next: function() {
			if (this.state === null) {
				return null;
			}
			let res = this.state.slice();
			for (let ii=m-1; ii>=0; ii--) {
				if (this.state[ii] < ii + n - m) {
					this.state[ii] += 1;
					for (let jj=ii+1; jj<m; jj++) {
						this.state[jj] = this.state[jj - 1] + 1;
					}
					return res;
				}
			}
			this.state = null;
			return res;
		}
	};
}

