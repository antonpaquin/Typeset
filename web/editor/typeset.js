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

function typeset(mask, text) {
	let reduced_mask = mask_margin(mask, 10);
	let pcenter = mask_mean(reduced_mask);

	if (!mask_pix_at(mask, pcenter[0], pcenter[y])) {
		return null; // abort -- some kind of weird concave shape
	};
}

class TextObject {
}

class TextSegment {
	constructor(text) {
	}
}
