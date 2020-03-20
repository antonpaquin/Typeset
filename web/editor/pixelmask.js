function sparse_to_mask(iter, test_fn, width, height) {
	/* Dense bitwise format for storing image masks
	 *
	 * Besides just being memory-efficient, this makes
	 * combining layers with bitwise ops possible, which
	 * is really nice
	 */
	let mask = {
		data: [],
		length: width * height,
		width: width,
		height: height
	};
	let cur = 0;
	let nbits = 0;
	for (let ii=0; ii<mask.length; ii++) {
		let x = iter.next();
		if (test_fn(x)) {
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

function imgdata_to_mask(img_data) {
	let iter = {
		data: img_data.data,
		idx: 0,
		next: function() {
			let res = this.data[this.idx+3]; // Alpha channel
			this.idx += 4;
			return res;
		}
	};
	let test_fn = (alpha) => (alpha >= 128);
	return sparse_to_mask(iter, test_fn, img_data.width, img_data.height);
}

function mask_to_imgdata(ctx, mask, color) {
	let img_data = ctx.createImageData(mask.width, mask.height);
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
		length: width * height,
		width: width,
		height: height
	};
}

function merge_masks(m1, m2, fn) {
	let out = {
		data: [],
		length: m1.length,
		width: m1.width,
		height: m1.height
	};
	for (let ii=0; ii<m1.data.length; ii++) {
		out.data.push(fn(m1.data[ii], m2.data[ii]));
	}
	return out;
}

function mask_pix_at(mask, x, y) {
	let idx = (y * mask.width) + x;
	let idx_hi = idx >> 5; /* (idx / 32)|0; */
	let idx_lo = 1 << (31 - (idx % 32));
	return (mask.data[idx_hi] & idx_lo) !== 0;
}

function mask_iter(mask) {
	return {
		mask: mask,
		idx_hi: 0,
		idx_lo: 1<<31,
		next: function() {
			let res = this.mask.data[idx_hi] & idx_lo;
			if (this.idx_lo == 1) {
				this.idx_lo = 1 << 31;
				this.idx_hi += 1;
			} else {
				this.idx_lo >>= 1;
			}
			return res;
		}
	};
}

function mask_margin(mask, margin) {
	// Dijkstra's, kinda?
	let dist = new Array(mask.length).fill(margin);
	let queue = {
		// Crappy queue that doesn't garbage collect its data
		// For our purposes this is fine
		data: new Array(),
		ptr: 0,
		length: 0,
		push: function(x) {
			this.data.push(x);
			this.length += 1;
		},
		shift: function() {
			this.length -= 1;
			return this.data[this.ptr++];
		}
	};
		
	for (let ii=0; ii<mask.height; ii++) {
		for (let jj=0; jj<mask.width; jj++) {
			if (!mask_pix_at(mask, jj, ii)) {
				dist[ii*mask.width + jj] = 0;

				if (ii > 0 && mask_pix_at(mask, jj, ii-1)) {
					queue.push([jj, ii-1, 1]);
				}
				if (jj > 0 && mask_pix_at(mask, jj-1, ii)) {
					queue.push([jj-1, ii, 1]);
				}
				if (ii < (mask.height - 1) && mask_pix_at(mask, jj, ii+1)) {
					queue.push([jj, ii+1, 1]);
				}
				if (jj < (mask.width - 1) && mask_pix_at(mask, jj+1, ii)) {
					queue.push([jj+1, ii, 1]);
				}
			}
		}
	}

	while(queue.length) {
		let pt = queue.shift();
		let x = pt[0];
		let y = pt[1];
		let d = pt[2];
		if (dist[y*mask.width + x] <= d) {
			continue;
		}
		dist[y*mask.width + x] = d;
		if (x > 0) {
			queue.push([x-1, y, d+1]);
		}
		if (y > 0) {
			queue.push([x, y-1, d+1]);
		}
		if (x < (mask.width - 1)) {
			queue.push([x+1, y, d+1]);
		}
		if (y < (mask.height - 1)) {
			queue.push([x, y+1, d+1]);
		}
	}

	// algorithm is done (results in dist), now just formatting the output
	let iter = {
		idx: 0,
		data: dist,
		next: function() { return this.data[this.idx++]; }
	};
	let test_fn = (x) => (x == margin);
	return sparse_to_mask(iter, test_fn, mask.width, mask.height);
}

function mask_mean(mask) {
	let xsum = 0;
	let ysum = 0;
	let count = 0;

	let iter = mask_iter(mask);

	for (let ii=0; ii<mask.height; ii++) {
		for (let jj=0; jj<mask.width; jj++) {
			if (iter.next()) {
				xsum += jj;
				ysum += ii;
				count += 1;
			}
		}
	}

	return [(xsum / count)|0, (ysum / count)|0];
}
