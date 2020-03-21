function test() {
	/* not actually displayed -- just here to fetch the 
	 * image and turn it into a b64 string
	 */
	var test_image = new Image(0, 0);
	var test_canvas = document.createElement("canvas");
	var test_ctx = test_canvas.getContext("2d");

	test_image.onload = () => {
		test_canvas.width = 730;
		test_canvas.height = 1133;
		test_ctx.drawImage(test_image, 0, 0);
		test_b64 = test_canvas.toDataURL();
		test_b64 = test_b64.substr(1 + test_b64.search(","));

		editor.load("png", test_b64);
		setTimeout(test_loaded, 100);
	};

	test_image.src = "test/7.png";
}

function test_loaded() {
	editor.selections.settings.set("active_tool", SELECTION_TOOL.FLOOD);
	let sel = editor.selections.active_layer.get_selector(685, 174);
	sel.finalize();

	let mmask = editor.selections.active_layer.mask;
	opentype.load("test/wildwords.ttf", function(err, font) {
		typeset(editor, mmask, "This is a test! With some longer text and long words", font, 12, 5);
	});
}
